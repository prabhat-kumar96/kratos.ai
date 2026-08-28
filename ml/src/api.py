# ===================================================
# Kratos.ai - FastAPI Model Server
# ===================================================
import os
import json
import math
import subprocess
import sys
import asyncio
import pandas as pd
import numpy as np
from fastapi import FastAPI, HTTPException
from contextlib import asynccontextmanager

# ---------------------------------------------------------------------------
# Optional heavy imports — only loaded when LIGHTWEIGHT_MODE is off
# ---------------------------------------------------------------------------
LIGHTWEIGHT_MODE = os.getenv("LIGHTWEIGHT_MODE", "true").lower() in ("true", "1", "yes")

_torch = None
_AutoTokenizer = None
_FinancialIntelligencePipeline = None

if not LIGHTWEIGHT_MODE:
    try:
        import torch as _torch
        from transformers import AutoTokenizer as _AutoTokenizer
        from src.models.pipeline import FinancialIntelligencePipeline as _FinancialIntelligencePipeline
        print("INFO: Heavy ML mode enabled (PyTorch + FinBERT).", flush=True)
    except ImportError as e:
        print(f"WARNING: Heavy ML imports failed ({e}). Falling back to LIGHTWEIGHT_MODE.", flush=True)
        LIGHTWEIGHT_MODE = True

# Lightweight engine is always available
from src.models.lightweight_engine import run_lightweight_inference

# Redis — optional, non-fatal if missing
try:
    import redis as _redis_lib
except ImportError:
    _redis_lib = None

import yfinance as yf
import random

# ---------------------------------------------------------------------------
# Global State
# ---------------------------------------------------------------------------
market_data = None
narratives_data = {}
model = None
tokenizer = None
is_retraining = False
expected_tabular_dim = 0
training_process = None
redis_client = None

# Ticker price cache — pre-built from market_data.csv at startup, refreshed async
_ticker_price_cache: dict = {}   # {ticker: {"price": float, "change": float}}


# ---------------------------------------------------------------------------
# Redis Connection (non-fatal)
# ---------------------------------------------------------------------------
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
ENABLE_BROADCAST = os.getenv("ENABLE_BROADCAST", "false").lower() in ("true", "1", "yes")
ENABLE_AUTO_RETRAIN = os.getenv("ENABLE_AUTO_RETRAIN", "false").lower() in ("true", "1", "yes")

if _redis_lib is not None:
    try:
        redis_client = _redis_lib.Redis(host=REDIS_HOST, port=REDIS_PORT, db=0, decode_responses=True, socket_connect_timeout=2)
        try:
            redis_client.ping()
            print(f"INFO: Connected to Redis at {REDIS_HOST}:{REDIS_PORT}", flush=True)
        except Exception:
            redis_client = None
            print(f"WARNING: Redis at {REDIS_HOST}:{REDIS_PORT} unreachable. Broadcasting disabled.", flush=True)
    except Exception as e:
        redis_client = None
        print(f"WARNING: Redis connection failed: {e}", flush=True)

# ---------------------------------------------------------------------------
# Market Data Broadcast (optional background task)
# ---------------------------------------------------------------------------
def fetch_market_data_snapshot(tickers_list):
    """Blocking function to fetch market data snapshot via yfinance."""
    tickers_str = " ".join(tickers_list)
    updates = {}
    try:
        ticker_objects = yf.Tickers(tickers_str)
        for ticker in tickers_list:
            try:
                info = ticker_objects.tickers[ticker].fast_info
                if hasattr(info, "last_price") and info.last_price:
                    price = info.last_price
                    prev_close = info.previous_close
                    change_pct = round(((price - prev_close) / prev_close) * 100, 2) if prev_close else 0.0
                    updates[ticker] = {
                        "price": round(price, 2),
                        "change_percent": change_pct,
                        "timestamp": str(pd.Timestamp.now()),
                        "news": [],
                    }
            except Exception:
                continue
    except Exception as e:
        print(f"Error fetching batch: {e}", flush=True)
    return updates


async def broadcast_market_data():
    """Background task to broadcast live market data to Redis (optional)."""
    print("INFO: Starting Market Data Broadcast Service...", flush=True)
    while True:
        try:
            BASE_TICKERS = [
                "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "AMD", "INTC", "TSM", "ORCL",
                "TSLA", "PLTR", "SNOW", "CRWD", "ARM", "COIN", "SHOP", "UBER", "ABNB", "SPOT", "RBLX", "RIVN",
                "IBN", "HDB", "INFY", "WIT", "HSBC", "JPM", "V", "MA",
                "NFLX", "DIS", "WMT", "KO", "LLY", "BA"
            ]
            ALL_TICKERS = list(set(BASE_TICKERS + (market_data["ticker"].unique().tolist() if market_data is not None else [])))
            updates = await asyncio.to_thread(fetch_market_data_snapshot, ALL_TICKERS)
            if updates and redis_client:
                redis_client.publish("market_updates", json.dumps(updates))
                print(f"DEBUG: Published updates for {len(updates)} tickers", flush=True)
        except Exception as e:
            print(f"ERROR in Broadcast Loop: {e}", flush=True)
        await asyncio.sleep(30)  # Throttled: every 30s instead of 5s


# ---------------------------------------------------------------------------
# Feature Pruner (for heavy-mode compatibility)
# ---------------------------------------------------------------------------
class FeaturePruner:
    """Intersects incoming feature columns with expected model weights."""
    @staticmethod
    def prune(input_tensor, current_dim, expected_dim):
        if not LIGHTWEIGHT_MODE and _torch is not None:
            if current_dim == expected_dim:
                return input_tensor
            if current_dim > expected_dim:
                return input_tensor[:, :expected_dim]
            padding_size = expected_dim - current_dim
            zeros = _torch.zeros((input_tensor.shape[0], padding_size), dtype=input_tensor.dtype)
            return _torch.cat([input_tensor, zeros], dim=1)
        return input_tensor


# ---------------------------------------------------------------------------
# Heavy-Mode Helpers
# ---------------------------------------------------------------------------
def run_data_alignment_check(csv_cols, model_weights_shape):
    print("============================================")
    print("      DATA-MODEL ALIGNMENT CHECK            ")
    print("============================================")
    print(f"CSV Columns detected:       {len(csv_cols)}")
    print(f"Model Tabular Weights:      {model_weights_shape}")
    if len(csv_cols) != model_weights_shape:
        print("STATUS: MISMATCH DETECTED — FeaturePruner ACTIVATED")
    else:
        print("STATUS: ALIGNMENT CONFIRMED")
    print("============================================")


def load_state_with_strict_fix(model_obj, state_dict):
    clean_state_dict = {(k[6:] if k.startswith("model.") else k): v for k, v in state_dict.items()}
    model_state = model_obj.state_dict()
    filtered = {k: v for k, v in clean_state_dict.items() if k in model_state and v.shape == model_state[k].shape}
    discarded = set(clean_state_dict.keys()) - set(filtered.keys())
    if discarded:
        print(f"Warning: Discarded {len(discarded)} parameters due to shape mismatch.")
    model_obj.load_state_dict(filtered, strict=False)


def trigger_retraining():
    """Triggers the training script in a separate process (only if ENABLE_AUTO_RETRAIN=true)."""
    global is_retraining, training_process
    if not ENABLE_AUTO_RETRAIN:
        print("INFO: Auto-retraining is disabled (ENABLE_AUTO_RETRAIN=false). Skipping.", flush=True)
        return
    if is_retraining and training_process is not None:
        if training_process.poll() is None:
            print("INFO: Training already in progress.", flush=True)
            return
    print("INFO: Triggering background retraining...", flush=True)
    is_retraining = True
    training_process = subprocess.Popen([sys.executable, "train.py"])


async def monitor_training_process():
    """Polls the training process and reloads model when finished (heavy mode only)."""
    global is_retraining, training_process
    while True:
        if ENABLE_AUTO_RETRAIN and is_retraining and training_process:
            ret_code = training_process.poll()
            if ret_code is not None:
                training_process = None
                if ret_code == 0:
                    print("INFO: Training finished. Reloading model...", flush=True)
                    try:
                        await load_resources()
                        is_retraining = False
                    except Exception as e:
                        print(f"ERROR: Failed to reload after training: {e}", flush=True)
                        is_retraining = False
                else:
                    print("ERROR: Training failed.", flush=True)
                    is_retraining = False
        await asyncio.sleep(10)


# ---------------------------------------------------------------------------
# Resource Loading
# ---------------------------------------------------------------------------
def load_resources_blocking():
    """Heavy-mode: load PyTorch model and tokenizer."""
    global expected_tabular_dim
    base_dir = os.getcwd()

    # Priority 1: slim checkpoint committed in checkpoints/
    slim_path = os.path.join(base_dir, "checkpoints", "kratos_slim.ckpt")
    # Priority 2: legacy mlruns checkpoint
    def find_latest_checkpoint(mlruns_dir):
        best_ckpt, best_time = None, 0
        if not os.path.exists(mlruns_dir):
            return None
        for root, dirs, files in os.walk(mlruns_dir):
            for file in files:
                if file.endswith(".ckpt"):
                    full_path = os.path.join(root, file)
                    mtime = os.path.getmtime(full_path)
                    if mtime > best_time:
                        best_time = mtime
                        best_ckpt = full_path
        return best_ckpt

    if os.path.exists(slim_path):
        checkpoint_path = slim_path
        print(f"INFO: Using committed slim checkpoint: {checkpoint_path}", flush=True)
    else:
        checkpoint_path = (find_latest_checkpoint(os.path.join(base_dir, "mlruns"))
                           or os.getenv("CHECKPOINT_PATH", ""))
        if checkpoint_path:
            print(f"INFO: Detected legacy checkpoint at {checkpoint_path}", flush=True)
        else:
            print("WARNING: No checkpoint found. Model will be uninitialized.", flush=True)

    # Detect tabular_dim from checkpoint hyper_parameters if available
    _tabular_dim = 12  # default matching trained slim checkpoint
    if checkpoint_path and os.path.exists(checkpoint_path):
        try:
            _ckpt_meta = _torch.load(checkpoint_path, map_location="cpu")
            hp = _ckpt_meta.get("hyper_parameters", {})
            if "tabular_dim" in hp:
                _tabular_dim = int(hp["tabular_dim"])
                print(f"INFO: tabular_dim={_tabular_dim} from checkpoint hyper_parameters", flush=True)
        except Exception:
            pass

    expected_tabular_dim = _tabular_dim
    model_instance = _FinancialIntelligencePipeline(temporal_dim=8, tabular_dim=_tabular_dim, latent_dim=128)

    _needs_retraining = True
    if checkpoint_path and os.path.exists(checkpoint_path):
        try:
            checkpoint = _torch.load(checkpoint_path, map_location=_torch.device("cpu"))
            load_state_with_strict_fix(model_instance, checkpoint["state_dict"])
            model_instance.eval()
            print(f"INFO: Model loaded from {checkpoint_path}", flush=True)
            _needs_retraining = False
        except Exception as e:
            print(f"WARNING: Failed to load checkpoint: {e}", flush=True)

    print("INFO: Loading Tokenizer (ProsusAI/finbert)...", flush=True)
    tokenizer_instance = None
    try:
        tokenizer_instance = _AutoTokenizer.from_pretrained("ProsusAI/finbert")
    except Exception as e:
        print(f"WARNING: Tokenizer download failed: {e}", flush=True)

    return model_instance, tokenizer_instance, _needs_retraining


def load_data_blocking():
    """Fast data loader — reads CSV + JSON from app working directory."""
    base_dir = os.getcwd()
    market_csv_path = os.path.join(base_dir, "market_data.csv")
    narratives_json_path = os.path.join(base_dir, "narratives.json")

    _market_data = None
    if os.path.exists(market_csv_path):
        df = pd.read_csv(market_csv_path)
        df = df.ffill().bfill().fillna(0)
        if "ticker" in df.columns:
            df["ticker"] = df["ticker"].astype(str).str.strip().str.upper()
        if "date" in df.columns:
            df["date"] = df["date"].astype(str)
        df.columns = [c.lower() for c in df.columns]
        _market_data = df
        print(f"INFO: Loaded market data ({len(df)} rows).", flush=True)
    else:
        print("WARNING: market_data.csv not found.", flush=True)

    _narratives_data = {}
    if os.path.exists(narratives_json_path):
        with open(narratives_json_path, "r") as f:
            narratives_list = json.load(f)
        _narratives_data = {item["ticker"]: item for item in narratives_list}
        print(f"INFO: Loaded {len(_narratives_data)} narrative records.", flush=True)
    else:
        print("WARNING: narratives.json not found.", flush=True)

    return _market_data, _narratives_data


def _seed_price_cache_from_csv():
    """Pre-fill _ticker_price_cache with the latest close/change from market_data.csv (instant, no network)."""
    global _ticker_price_cache
    if market_data is None:
        return
    try:
        latest = (
            market_data.sort_values("date")
            .groupby("ticker")
            .tail(1)
            .set_index("ticker")
        )
        cache = {}
        for ticker, row in latest.iterrows():
            close = float(row.get("close", 0))
            open_ = float(row.get("open", close))
            change = round((close - open_) / (open_ + 1e-9) * 100, 2) if open_ else 0.0
            cache[str(ticker).upper()] = {"price": round(close, 2), "change": change}
        _ticker_price_cache = cache
        print(f"INFO: Seeded price cache with {len(cache)} tickers from CSV.", flush=True)
    except Exception as e:
        print(f"WARNING: Price cache seed failed: {e}", flush=True)


async def _refresh_price_cache_from_yfinance():
    """Background task: refresh _ticker_price_cache with live yfinance prices (slow, runs once after startup)."""
    global _ticker_price_cache
    ALL_TICKERS = list(_ticker_price_cache.keys()) or [
        "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "AMD", "INTC", "TSM", "ORCL",
        "TSLA", "PLTR", "SNOW", "CRWD", "ARM", "COIN", "SHOP", "UBER", "ABNB", "SPOT", "RBLX", "RIVN",
        "IBN", "HDB", "INFY", "WIT", "HSBC", "JPM", "V", "MA",
        "NFLX", "DIS", "WMT", "KO", "LLY", "BA"
    ]
    print(f"INFO: Background live price refresh started for {len(ALL_TICKERS)} tickers…", flush=True)
    try:
        def _fetch():
            updated = {}
            for ticker in ALL_TICKERS:
                try:
                    info = yf.Ticker(ticker).fast_info
                    price = info.last_price
                    prev = info.previous_close
                    if price and price > 0:
                        chg = round((price - prev) / (prev + 1e-9) * 100, 2) if prev else 0.0
                        updated[ticker] = {"price": round(price, 2), "change": chg}
                except Exception:
                    pass  # keep CSV fallback value
            return updated
        live = await asyncio.to_thread(_fetch)
        _ticker_price_cache.update(live)
        print(f"INFO: Live price cache refreshed — {len(live)}/{len(ALL_TICKERS)} tickers updated.", flush=True)
    except Exception as e:
        print(f"WARNING: Live price refresh failed: {e}", flush=True)


async def load_resources():
    """Loads all resources. In lightweight mode, skips PyTorch/FinBERT."""
    global market_data, narratives_data, model, tokenizer, is_retraining

    print("INFO: Loading data...", flush=True)
    try:
        data_res = await asyncio.to_thread(load_data_blocking)
        market_data = data_res[0]
        narratives_data = data_res[1]
        print("INFO: Data loading COMPLETE.", flush=True)
    except Exception as e:
        print(f"CRITICAL: Data loading failed: {e}", flush=True)

    if LIGHTWEIGHT_MODE:
        print("INFO: LIGHTWEIGHT_MODE=true — skipping PyTorch/FinBERT load.", flush=True)
        # Seed the price cache immediately from market_data so /tickers is instant
        _seed_price_cache_from_csv()
        # Then refresh live prices in background (non-blocking)
        asyncio.create_task(_refresh_price_cache_from_yfinance())
        return


    print("INFO: Loading PyTorch model + FinBERT tokenizer...", flush=True)
    try:
        ai_res = await asyncio.to_thread(load_resources_blocking)
        model = ai_res[0]
        tokenizer = ai_res[1]
        needs_retraining = ai_res[2]
        print("INFO: AI loading COMPLETE.", flush=True)
        if needs_retraining:
            trigger_retraining()
    except Exception as e:
        print(f"CRITICAL: AI loading failed: {e}", flush=True)


# ---------------------------------------------------------------------------
# FastAPI App
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start loading resources in background to unblock startup health checks."""
    asyncio.create_task(load_resources())
    if not LIGHTWEIGHT_MODE:
        asyncio.create_task(monitor_training_process())
    if ENABLE_BROADCAST and redis_client is not None:
        asyncio.create_task(broadcast_market_data())
    yield


app = FastAPI(title="Kratos.ai ML Service", lifespan=lifespan)


# ---------------------------------------------------------------------------
# /predict/{ticker}
# ---------------------------------------------------------------------------
@app.get("/predict/{ticker}")
async def get_prediction(ticker: str):
    ticker = ticker.upper()

    if is_retraining:
        return {
            "status": "training",
            "message": "Model is currently retraining. Please check back shortly.",
            "reliability_score": 0,
            "regime": "System Calibration",
            "prediction": 0,
            "history": [],
            "narrative_summary": "System is calibrating to new data...",
        }

    try:
        if market_data is None:
            return {
                "status": "training",
                "message": "Market data is initializing...",
                "reliability_score": 0,
                "regime": "System Calibration",
                "prediction": 0,
                "history": [],
                "narrative_summary": "Loading data...",
            }

        # --- Fetch ticker data ---
        ticker_df = market_data[market_data["ticker"] == ticker].copy()

        if ticker_df.empty:
            # Fallback: live YFinance data
            try:
                print(f"INFO: Fetching live fallback history for {ticker}...", flush=True)

                def fetch_history_sync():
                    yf_ticker = yf.Ticker(ticker)
                    return yf_ticker.history(period="3mo")

                try:
                    hist = await asyncio.wait_for(asyncio.to_thread(fetch_history_sync), timeout=15.0)
                except asyncio.TimeoutError:
                    hist = pd.DataFrame()

                if not hist.empty:
                    hist.reset_index(inplace=True)
                    hist.columns = [c.lower() for c in hist.columns]
                    if "date" not in hist.columns and "datetime" in hist.columns:
                        hist.rename(columns={"datetime": "date"}, inplace=True)
                    for col in ["rsi", "macd", "macd_signal", "atr", "ema_20"]:
                        hist[col] = 0.0
                    ticker_df = hist
                    if pd.api.types.is_datetime64_any_dtype(ticker_df["date"]):
                        ticker_df["date"] = ticker_df["date"].dt.strftime("%Y-%m-%d")
                    else:
                        ticker_df["date"] = ticker_df["date"].astype(str)
                else:
                    raise Exception("Empty history from YFinance.")
            except Exception as e:
                print(f"INFO: Live fallback failed for {ticker}: {e}", flush=True)
                raise HTTPException(status_code=404, detail=f"Ticker {ticker} not found.")

        # --- Narrative ---
        narrative_info = narratives_data.get(ticker) or narratives_data.get(ticker.upper()) or {}
        if not narrative_info:
            # Try case-insensitive lookup
            for k, v in narratives_data.items():
                if k.upper() == ticker:
                    narrative_info = v
                    break
        if not narrative_info:
            narrative_info = {"transcript": "", "sentiment": None, "alignment_flag": None}

        # --- Lightweight Inference ---
        if LIGHTWEIGHT_MODE or model is None or tokenizer is None:
            result = run_lightweight_inference(ticker, ticker_df, narrative_info)
            return result

        # --- Heavy-Mode Inference (PyTorch + FinBERT) ---
        model_ready = (model is not None and tokenizer is not None)
        is_analyzed = not ticker_df.empty

        window_size = 5
        window_df = ticker_df.tail(window_size) if len(ticker_df) >= window_size else ticker_df

        temporal_features = ["close", "high", "low", "volume", "rsi", "macd", "atr", "ema_20"]
        temp_data = window_df[temporal_features].values.astype(np.float32)
        temp_data = np.nan_to_num(temp_data, nan=0.0, posinf=0.0, neginf=0.0)
        if temp_data.shape[0] < window_size:
            pad = np.zeros((window_size - temp_data.shape[0], 8), dtype=np.float32)
            temp_data = np.vstack([pad, temp_data])
        temp_input = _torch.tensor(temp_data, dtype=_torch.float).unsqueeze(0)

        exclude = temporal_features + ["ticker", "date", "return_5d_forward", "return_20d_forward", "volatility_5d", "trend_label", "bb_middle"]
        tabular_features = [col for col in market_data.columns if col not in exclude]
        last_row = ticker_df.iloc[-1]
        tab_array = last_row[tabular_features].values.astype(np.float32)
        tab_array = np.nan_to_num(tab_array, nan=0.0, posinf=0.0, neginf=0.0)
        tab_input = _torch.tensor([tab_array], dtype=_torch.float)
        tab_input = FeaturePruner.prune(tab_input, tab_input.shape[1], expected_tabular_dim)

        text = narrative_info.get("transcript", "")
        encoding = tokenizer.encode_plus(
            text,
            add_special_tokens=True,
            max_length=64,
            padding="max_length",
            truncation=True,
            return_attention_mask=True,
            return_tensors="pt",
        )

        prediction_val = 0.0
        rel_score = 0.0
        regime_id = 1
        is_consistent = False
        regime_label = "Live Tracking Only"

        if is_analyzed and model_ready:
            with _torch.no_grad():
                outputs = model({
                    "temporal": temp_input,
                    "tabular": tab_input,
                    "text_input_ids": encoding["input_ids"],
                    "text_attn_mask": encoding["attention_mask"],
                })
            prediction_val = outputs["prediction"].item()
            rel_score = outputs["reliability_score"].item()
            regime_id = outputs["regime_id"]
            is_consistent = bool(outputs["is_consistent"].item())
            regimes = ["Stable Growth", "Volatile", "Crisis"]
            regime_label = regimes[regime_id] if regime_id < len(regimes) else "Unknown"

        if math.isnan(prediction_val) or math.isnan(rel_score):
            prediction_val = 0.0
            rel_score = 0.0

        history_df = ticker_df.tail(30).copy()
        if "date" in history_df.columns:
            history_df = history_df[["date", "close"]].copy()
            history_df["date"] = history_df["date"].astype(str)
        else:
            history_df = history_df[["close"]].copy()
            history_df["date"] = pd.Timestamp.now().isoformat()
        history_df.rename(columns={"close": "price"}, inplace=True)
        history = history_df.to_dict(orient="records")

        return {
            "reliability_score": round(rel_score * 100, 2),
            "regime": regime_label,
            "regime_id": regime_id,
            "prediction": round(prediction_val, 4),
            "history": history,
            "narrative_summary": text,
            "is_consistent": is_consistent,
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"CRITICAL INFERENCE ERROR for {ticker}: {e}", flush=True)
        import traceback
        traceback.print_exc()
        return {
            "status": "training",
            "message": "System detected an anomaly and is recalibrating.",
            "reliability_score": 0,
            "regime": "System Calibration",
            "prediction": 0,
            "history": [],
            "narrative_summary": "System recalibration in progress...",
        }


# ---------------------------------------------------------------------------
# GET / — root health check (Render pings this)
# ---------------------------------------------------------------------------
@app.get("/")
def root():
    return {"status": "ok", "service": "Kratos.ai ML Service"}


# ---------------------------------------------------------------------------
# /tickers — instant response from price cache
# ---------------------------------------------------------------------------
@app.get("/tickers")
def get_tickers():
    """Returns all available tickers instantly from the pre-built price cache.
    Prices start from market_data.csv values and are replaced by live yfinance
    values once the background refresh completes (a few seconds after startup).
    """
    CANONICAL_TICKERS = [
        "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "AMD", "INTC", "TSM", "ORCL",
        "TSLA", "PLTR", "SNOW", "CRWD", "ARM", "COIN", "SHOP", "UBER", "ABNB", "SPOT", "RBLX", "RIVN",
        "IBN", "HDB", "INFY", "WIT", "HSBC", "JPM", "V", "MA",
        "NFLX", "DIS", "WMT", "KO", "LLY", "BA"
    ]

    # Merge: canonical list + anything in market_data not already covered
    extra_from_csv = (
        [t for t in market_data["ticker"].unique().tolist() if t not in CANONICAL_TICKERS]
        if market_data is not None else []
    )
    all_tickers = CANONICAL_TICKERS + extra_from_csv

    summary = []
    for ticker in all_tickers:
        cached = _ticker_price_cache.get(ticker)
        if cached:
            summary.append({
                "ticker": ticker,
                "name": ticker,
                "price": cached["price"],
                "change": cached["change"],
                "is_analyzed": True,
            })
        else:
            # Ticker not in CSV at all — emit with zeroes so UI still shows it
            summary.append({
                "ticker": ticker,
                "name": ticker,
                "price": 0.0,
                "change": 0.0,
                "is_analyzed": False,
            })

    return summary




# ---------------------------------------------------------------------------
# /news/{ticker}
# ---------------------------------------------------------------------------
@app.get("/news/{ticker}")
def get_news(ticker: str):
    """Fetches latest news for a ticker via Yahoo Finance."""
    try:
        ticker_obj = yf.Ticker(ticker.upper())
        news = ticker_obj.news

        if news:
            print(f"DEBUG NEWS: {json.dumps(news[0], default=str)}", flush=True)

        formatted_news = []
        for item in news:
            data_source = item.get("content", item)
            title = data_source.get("title") or data_source.get("headline") or data_source.get("summary") or "No Title"
            formatted_news.append({
                "id": item.get("id", str(hash(title))),
                "headline": title,
                "source": data_source.get("publisher", "Yahoo Finance"),
                "published_at": str(data_source.get("pubDate") or data_source.get("providerPublishTime") or pd.Timestamp.now()),
                "sentiment": "Neutral",
                "link": data_source.get("clickThroughUrl") or data_source.get("link") or "#",
            })

        return {"news": formatted_news}
    except Exception as e:
        print(f"Error fetching news for {ticker}: {e}", flush=True)
        return {"news": []}


# ---------------------------------------------------------------------------
# /health
# ---------------------------------------------------------------------------
@app.get("/health")
def health():
    return {
        "status": "ok",
        "lightweight_mode": LIGHTWEIGHT_MODE,
        "data_loaded": market_data is not None,
        "narratives_loaded": len(narratives_data) > 0,
        "model_loaded": model is not None,
        "redis_connected": redis_client is not None,
    }
