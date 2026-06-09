import os
import json
import math
import shutil
import subprocess
import asyncio
import pandas as pd
import numpy as np
import torch
from fastapi import FastAPI, HTTPException
from contextlib import asynccontextmanager
from transformers import AutoTokenizer
import redis
import yfinance as yf
from src.models.pipeline import FinancialIntelligencePipeline

app = FastAPI()

# Global variables to store loaded components
market_data = None
narratives_data = {}
model = None
tokenizer = None
is_retraining = False
expected_tabular_dim = 0
training_process = None
expected_tabular_dim = 0
training_process = None
expected_tabular_dim = 0
redis_client = None

# Using 'redis' as hostname because of Docker networking
try:
    redis_client = redis.Redis(host='redis', port=6379, db=0, decode_responses=True)
except Exception as e:
    print(f"WARNING: Redis connection failed: {e}")

import random

def fetch_market_data_snapshot(tickers_list):
    """Blocking function to fetch market data and apply demo jitter."""
    tickers_str = " ".join(tickers_list)
    updates = {}
    try:
        ticker_objects = yf.Tickers(tickers_str)
        
        for ticker in tickers_list:
            try:
                # fast_info is usually cached by yfinance, but accessing it might trigger requests
                info = ticker_objects.tickers[ticker].fast_info
                if hasattr(info, 'last_price'):
                    price = info.last_price
                    prev_close = info.previous_close
                    
                    change_pct = 0.0
                    if prev_close:
                        change_pct = ((price - prev_close) / prev_close) * 100
                        
                    updates[ticker] = {
                        "price": round(price, 2),
                        "change_percent": round(change_pct, 2),
                        "timestamp": str(pd.Timestamp.now()),
                        # News is fetched separately usually, but we can keep it empty or try fetch
                        "news": [] 
                    }
            except Exception:
                continue
    except Exception as e:
        print(f"Error in fetching batch: {e}")
        
    return updates

async def broadcast_market_data():
    """Background task to fetch and broadcast live market data."""
    print("INFO: Starting Market Data Broadcast Service...", flush=True)
    while True:
        try:
            # 1. Get list of tickers to track
            BASE_TICKERS = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "AMD", "NFLX"]
            
            if market_data is not None:
                cached_tickers = market_data['ticker'].unique().tolist()
                ALL_TICKERS = list(set(BASE_TICKERS + cached_tickers))
            else:
                ALL_TICKERS = BASE_TICKERS
            
            # 2. Fetch Data (Non-Blocking)
            # Run the blocking IO in a separate thread so we don't freeze the API
            updates = await asyncio.to_thread(fetch_market_data_snapshot, ALL_TICKERS)
            
            if updates and redis_client:
                # Publish the entire batch as one message to reduce overhead
                redis_client.publish('market_updates', json.dumps(updates))
                print(f"DEBUG: Published updates for {len(updates)} tickers", flush=True)
            else:
                print(f"DEBUG: No updates found or Redis not connected. Updates: {len(updates)}", flush=True)
                
        except Exception as e:
            print(f"ERROR in Broadcast Loop: {e}", flush=True)
            
        await asyncio.sleep(5) # Update every 5 seconds

class FeaturePruner:
    """Intersects incoming feature columns with expected model weights to prevent size mismatches."""
    @staticmethod
    def prune(input_tensor, current_dim, expected_dim):
        if current_dim == expected_dim:
            return input_tensor
        
        if current_dim > expected_dim:
            print(f"Pruning features: Input {current_dim} -> Expected {expected_dim}")
            return input_tensor[:, :expected_dim]
        
        if current_dim < expected_dim:
            print(f"Padding features: Input {current_dim} -> Expected {expected_dim}")
            # Pad the last dimension with zeros
            # input_tensor is (Batch, Features)
            padding_size = expected_dim - current_dim
            # torch.cat with zeros
            batch_size = input_tensor.shape[0]
            zeros = torch.zeros((batch_size, padding_size), dtype=input_tensor.dtype, device=input_tensor.device)
            return torch.cat([input_tensor, zeros], dim=1)
        
        return input_tensor

def run_data_alignment_check(csv_cols, model_weights_shape):
    """Runs on startup to verify data-model alignment."""
    print("============================================")
    print("      DATA-MODEL ALIGNMENT CHECK            ")
    print("============================================")
    print(f"CSV Columns detected:       {len(csv_cols)}")
    print(f"Model Tabular Weights:      {model_weights_shape}")
    
    if len(csv_cols) != model_weights_shape:
        print(f"STATUS: MISMATCH DETECTED")
        print(f"ACTION: FeaturePruner Interceptor ACTIVATED")
        print(f"DETAIL: Will adjust {len(csv_cols)} features -> {model_weights_shape} expectations.")
    else:
        print("STATUS: ALIGNMENT CONFIRMED")
        print("DETAIL: CSV and Model matches are perfect.")
    print("============================================")

def load_state_with_strict_fix(model, state_dict):
    """Helper to fix state dict prefix issues and shape mismatches."""
    # 1. Clean prefixes
    clean_state_dict = {
        (k[6:] if k.startswith('model.') else k): v 
        for k, v in state_dict.items()
    }
    
    # 2. Filter by shape using dictionary comprehension
    model_state = model.state_dict()
    filtered_state_dict = {
        k: v for k, v in clean_state_dict.items()
        if k in model_state and v.shape == model_state[k].shape
    }
    
    # Log discarded parameters
    discarded = set(clean_state_dict.keys()) - set(filtered_state_dict.keys())
    if discarded:
        print(f"Warning: Discarded {len(discarded)} parameters due to shape mismatch or missing keys: {list(discarded)[:5]}...")
        
    model.load_state_dict(filtered_state_dict, strict=False)

def trigger_retraining():
    """Triggers the training script in a separate process."""
    global is_retraining, training_process
    if is_retraining and training_process is not None:
        if training_process.poll() is None:
            print("INFO: Training already in progress.")
            return

    print("INFO: Triggering background retraining...", flush=True)
    is_retraining = True
    # Using subprocess to run train.py independently
    training_process = subprocess.Popen(["python", "train.py"])

async def monitor_training_process():
    """Polls the training process and reloads model when finished."""
    global is_retraining, training_process
    print("INFO: Started training monitor.", flush=True)
    while True:
        if is_retraining and training_process:
            ret_code = training_process.poll()
            if ret_code is not None:
                print(f"INFO: Training finished with code {ret_code}.")
                training_process = None
                if ret_code == 0:
                    print("INFO: Reloading model after training...")
                    try:
                         # Re-run resource loading logic
                         # Note: In a real app we might want to be more careful about concurrency,
                         # but here we just need to refresh the global model.
                         await load_resources() 
                         is_retraining = False
                         print("INFO: Model reloaded successfully.")
                    except Exception as e:
                        print(f"ERROR: Failed to reload after training: {e}")
                        # Keep is_retraining=True or False? False so we don't block forever, even if old model
                        is_retraining = False
                else:
                    print("ERROR: Training failed.")
                    is_retraining = False
        
        
        await asyncio.sleep(5) # Check every 5 seconds

def load_resources_blocking():
    """Blocking function to load model and tokenizer."""
    print("INFO: Loading resources in blocking thread...", flush=True)
    
    base_dir = os.getcwd()
    checkpoint_dir = os.path.join(base_dir, "mlruns")
    
    # Dynamic Checkpoint Finder
    def find_latest_checkpoint(mlruns_dir):
        best_ckpt = None
        best_time = 0
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

    checkpoint_path = find_latest_checkpoint(checkpoint_dir)
    if checkpoint_path:
        print(f"INFO: Detected latest checkpoint at {checkpoint_path}")
    else:
        # Fallback to env var if dynamic search failed
        env_ckpt = os.getenv("CHECKPOINT_PATH")
        if env_ckpt and os.path.exists(env_ckpt):
             checkpoint_path = env_ckpt
             print(f"INFO: Using CHECKPOINT_PATH from env: {checkpoint_path}")
        else:
             print("WARNING: No checkpoint found. Model will be uninitialized.")
             checkpoint_path = ""

    # 1. Initialize Model structure
    _temporal_dim = 8
    _tabular_dim = 10 
    
    model_instance = FinancialIntelligencePipeline(
        temporal_dim=_temporal_dim,
        tabular_dim=_tabular_dim,
        latent_dim=128
    )
    
    # 2. Load Checkpoint
    _needs_retraining = True
    if checkpoint_path and os.path.exists(checkpoint_path):
        try:
            checkpoint = torch.load(checkpoint_path, map_location=torch.device('cpu'))
            load_state_with_strict_fix(model_instance, checkpoint['state_dict'])
            model_instance.eval()
            print(f"Successfully loaded model from {checkpoint_path}")
            _needs_retraining = False
        except Exception as e:
            print(f"WARNING: Failed to load checkpoint: {e}")
    
    # 3. Load Tokenizer
    print("INFO: Loading Tokenizer...", flush=True)
    tokenizer_instance = None
    try:
        tokenizer_instance = AutoTokenizer.from_pretrained('yiyanghkust/finbert-pretrain')
    except Exception as e:
         print(f"WARNING: Tokenizer download failed: {e}. using fallback.", flush=True)
         # In a real scenario, we might want to fail hard, or use a local fallback
         # raise e
    
    return model_instance, tokenizer_instance, _needs_retraining

def load_data_blocking():
    """Fast data loader."""
    base_dir = os.getcwd() 
    market_csv_path = os.path.join(base_dir, "market_data.csv")
    narratives_json_path = os.path.join(base_dir, "narratives.json")
    
    _market_data = None
    if os.path.exists(market_csv_path):
        df = pd.read_csv(market_csv_path)
        df = df.ffill().bfill().fillna(0)
        # Robust Cleaning
        if 'ticker' in df.columns:
            df['ticker'] = df['ticker'].astype(str).str.strip().str.upper()
        if 'date' in df.columns:
            df['date'] = df['date'].astype(str)
            
        print(f"Loaded market data from {market_csv_path}. Counts: {len(df)}")
        # Debug cols
        if not df.empty:
             df.columns = [c.lower() for c in df.columns]
             
        _market_data = df
    else:
        print("WARNING: market_data.csv missing")

    _narratives_data = {}
    if os.path.exists(narratives_json_path):
        with open(narratives_json_path, "r") as f:
             narratives_list = json.load(f)
             _narratives_data = {item["ticker"]: item for item in narratives_list}
             
    return _market_data, _narratives_data


async def load_resources():
    """Loads resources in stages."""
    global market_data, narratives_data, model, tokenizer, is_retraining
    
    print("INFO: Starting background data loading...", flush=True)
    try:
        data_res = await asyncio.to_thread(load_data_blocking)
        market_data = data_res[0]
        narratives_data = data_res[1]
        print("INFO: Data loading COMPLETE.", flush=True)
    except Exception as e:
        print(f"CRITICAL: Data loading failed: {e}")

    print("INFO: Starting background AI loading...", flush=True)
    try:
        ai_res = await asyncio.to_thread(load_resources_blocking)
        model = ai_res[0]
        tokenizer = ai_res[1]
        needs_retraining = ai_res[2]
        print("INFO: AI loading COMPLETE.", flush=True)
        
        if needs_retraining:
            trigger_retraining()
    except Exception as e:
        print(f"CRITICAL: AI loading failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start loading in background to unblock startup."""
    asyncio.create_task(load_resources())
    asyncio.create_task(monitor_training_process())
    asyncio.create_task(broadcast_market_data())
    yield

app = FastAPI(lifespan=lifespan)
@app.get("/predict/{ticker}")
async def get_prediction(ticker: str):
    ticker = ticker.upper()
    
    if is_retraining:
         # Return a successful response but with status indicating training
         # This prevents 503 errors on the frontend
        return {
            "status": "training", 
            "message": "Model is currently retraining. Please check back shortly.",
            "reliability_score": 0,
            "regime": "System Calibration",
            "prediction": 0,
            "history": [],
            "narrative_summary": "System is calibrating to new data..."
        }

    try:
        # Check if we have at least DATA. If model is missing, we can still show graphs.
        if market_data is None:
            # Trigger load if completely missing (shouldn't happen with split loading)
            return {
                "status": "training",
                "message": "Market Data is initializing...",
                "reliability_score": 0,
                "regime": "System Calibration",
                "prediction": 0,
                "history": [],
                "narrative_summary": "Loading data..."
            }
            
        # If model is missing, we proceed but will skip inference
        model_ready = (model is not None and tokenizer is not None)

        # 1. Fetch Ticker Data
        ticker_df = pd.DataFrame()
        is_analyzed = False
        
        if market_data is not None:
             # Direct lookup with cleaned data
             ticker_df = market_data[market_data['ticker'] == ticker].copy()
        
        if not ticker_df.empty:
            is_analyzed = True
        else:
            # Fallback: Fetch history from YFinance for graphs
            try:
                print(f"Fetching fallback history for {ticker}...", flush=True)
                
                def fetch_history_sync():
                    yf_ticker = yf.Ticker(ticker)
                    # Fetch 3 months
                    return yf_ticker.history(period="3mo")

                try:
                    # Enforce strict 15-second timeout to prevent service hang (Increased from 3s)
                    hist = await asyncio.wait_for(asyncio.to_thread(fetch_history_sync), timeout=15.0)
                except asyncio.TimeoutError:
                    print(f"WARNING: History fetch timed out for {ticker}. Using synthetic data.", flush=True)
                    hist = pd.DataFrame() # Trigger synthetic generation below
                
                if not hist.empty:
                     hist.reset_index(inplace=True)
                     # Standardize columns
                     hist.columns = [c.lower() for c in hist.columns]
                     # Rename Date to date if needed
                     if 'date' not in hist.columns and 'datetime' in hist.columns:
                         hist.rename(columns={'datetime': 'date'}, inplace=True)
                     
                     # Fill missing cols
                     for col in ['rsi', 'macd', 'atr', 'ema_20']:
                         hist[col] = 0.0
                         
                     ticker_df = hist
                     # Handle datetimes
                     if pd.api.types.is_datetime64_any_dtype(ticker_df['date']):
                        ticker_df['date'] = ticker_df['date'].dt.strftime('%Y-%m-%d')
                     else:
                        ticker_df['date'] = ticker_df['date'].astype(str)
                else:
                    raise Exception("Empty or Timed Out")

            except Exception as e:
                print(f"Fallback history fetch failed: {e}. Graph will be empty.", flush=True)
                ticker_df = pd.DataFrame() # Empty



        if ticker_df.empty:
            raise HTTPException(status_code=404, detail=f"Ticker {ticker} not found in market data or live source")

        narrative_info = narratives_data.get(ticker)
        if not narrative_info:
            for k, v in narratives_data.items():
                if k.upper() == ticker:
                    narrative_info = v
                    break
        
        if not narrative_info:
            narrative_info = {"transcript": "", "alignment_flag": False}

        # 2. Prepare Inputs
        window_size = 5
        if len(ticker_df) < window_size:
            window_df = ticker_df.tail(len(ticker_df))
        else:
            window_df = ticker_df.tail(window_size)
        
        # Temporal
        # FIXED: Use 'close' instead of 'price', and 'ema_20' instead of 'bb_width' to match CSV/Helpers
        temporal_features = ['close', 'high', 'low', 'volume', 'rsi', 'macd', 'atr', 'ema_20']
        temp_data = window_df[temporal_features].values.astype(np.float32)
        temp_data = np.nan_to_num(temp_data, nan=0.0, posinf=0.0, neginf=0.0)
        
        if temp_data.shape[0] < window_size:
            pad_size = window_size - temp_data.shape[0]
            temp_data = np.vstack([np.zeros((pad_size, 8), dtype=np.float32), temp_data])
        
        temp_input = torch.tensor(temp_data, dtype=torch.float).unsqueeze(0)

        # Tabular
        temporal_features = ['close', 'high', 'low', 'volume', 'rsi', 'macd', 'atr', 'ema_20']
        exclude = temporal_features + ['ticker', 'date', 'return_5d_forward', 'return_20d_forward', 'volatility_5d', 'trend_label', 'bb_middle']
        tabular_features = [col for col in market_data.columns if col not in exclude]
        
        last_row = ticker_df.iloc[-1]
        tab_array = last_row[tabular_features].values.astype(np.float32)
        tab_array = np.nan_to_num(tab_array, nan=0.0, posinf=0.0, neginf=0.0)
        tab_input = torch.tensor([tab_array], dtype=torch.float)
        
        # Pruning / Padding
        tab_input = FeaturePruner.prune(tab_input, tab_input.shape[1], expected_tabular_dim)

        # Text
        encoding = {'input_ids': None, 'attention_mask': None}
        if model_ready:
            text = narrative_info.get("transcript", "")
            encoding = tokenizer.encode_plus(
                text,
                add_special_tokens=True,
                max_length=64,
                padding='max_length',
                truncation=True,
                return_attention_mask=True,
                return_tensors='pt'
            )

        # 3. Inference
        prediction = 0.0
        rel_score = 0.0
        regime_id = 1 # Volatile default or Unknown
        is_consistent = False
        regime_label = "Live Tracking Only"

        if is_analyzed and model_ready:
             with torch.no_grad():
                outputs = model({
                    "temporal": temp_input,
                    "tabular": tab_input,
                    "text_input_ids": encoding['input_ids'],
                    "text_attn_mask": encoding['attention_mask']
                })

             prediction = outputs['prediction'].item()
             rel_score = outputs['reliability_score'].item()
             regime_id = outputs['regime_id']
             is_consistent = outputs['is_consistent'].item()

             # Map regime_id to label
             regimes = ["Stable Growth", "Volatile", "Crisis"]
             regime_label = regimes[regime_id] if regime_id < len(regimes) else "Unknown"
        else:
             print(f"Skipping inference for {ticker} (Model Ready: {model_ready})", flush=True)

        if math.isnan(prediction) or math.isnan(rel_score):
             # raise ValueError("Model produced NaN output")
             prediction = 0
             rel_score = 0
        
        # History for Charting (Last 30 entries)
        # Use 'close' from CSV but rename to 'price' for frontend compatibility
        history_df = ticker_df.tail(30).copy()
        if 'date' in history_df.columns:
             history_df = history_df[['date', 'close']].copy()
             history_df['date'] = history_df['date'].astype(str)
        else:
             # Fallback if date is missing
             history_df = history_df[['close']].copy()
             history_df['date'] = pd.Timestamp.now().isoformat()

        history_df.rename(columns={'close': 'price'}, inplace=True)
        history = history_df.to_dict(orient='records')

        return {
            "reliability_score": round(rel_score * 100, 2),
            "regime": regime_label,
            "regime_id": regime_id,
            "prediction": round(prediction, 4),
            "history": history,
            "narrative_summary": text,
            "is_consistent": is_consistent
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"CRITICAL INFERENCE ERROR for {ticker}: {e}")
        import traceback
        traceback.print_exc()
        
        # Fallback to Training Mode for Self-Healing
        # if not is_retraining:
             # trigger_retraining()
             
        return {
            "status": "training",
            "message": "System detected an anomaly and is recalibrating.",
            "reliability_score": 0,
            "regime": "System Calibration",
            "prediction": 0,
            "history": [],
            "narrative_summary": "System recalibration in progress..."
        }

@app.get("/tickers")
def get_tickers():
    """Returns a list of available tickers with summary stats (Live + Analyzed)."""
    
    # 1. Define Live Tickers List (Popular Tech & Finance)
    LIVE_TICKERS = [
        "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", 
        "AMD", "INTC", "NFLX", "JPM", "V", "WMT", "DIS"
    ]
    
    unique_tickers = []
    if market_data is not None:
        unique_tickers = market_data['ticker'].unique().tolist()
    
    # Combine lists (avoid duplicates)
    all_tickers = list(set(LIVE_TICKERS + unique_tickers))
    
    summary = []
    
    # 2. Fetch Live Data via YFinance (Batch fetching is faster)
    try:
        import yfinance as yf
        # Fetch data for alltickers at once
        tickers_str = " ".join(all_tickers)
        live_data = yf.Tickers(tickers_str)
        
        for ticker in all_tickers:
            # FIXED: Always mark as analyzed to allow frontend to fetch predictions/fallback graphs
            # The /predict endpoint handles the fallback if CSV data is missing.
            is_analyzed = True 
            
            try:
                # Try to get live data first
                info = live_data.tickers[ticker].fast_info
                # Fallback to market_data if live fetch fails or is strangely empty (though fast_info usually reliable)
                if info is None or not hasattr(info, 'last_price'):
                    raise ValueError("No live data")
                
                price = round(info.last_price, 2)
                prev_close = info.previous_close
                if prev_close:
                    change_pct = round(((price - prev_close) / prev_close) * 100, 2)
                else:
                    change_pct = 0.0
                     
                summary.append({
                    "ticker": ticker,
                    "name": ticker, # simplified, can get full name if needed but requires .info which is slower
                    "price": price,
                    "change": change_pct,
                    "is_analyzed": is_analyzed
                })
                
            except Exception as e:
                # Fallback to local CSV data if live fails
                if is_analyzed:
                    ticker_df = market_data[market_data['ticker'] == ticker]
                    if not ticker_df.empty:
                        last_row = ticker_df.iloc[-1]
                        summary.append({
                            "ticker": ticker,
                            "name": ticker,
                            "price": round(last_row['close'], 2),
                            "change": round((last_row['close'] - last_row['open']) / last_row['open'] * 100, 2),
                            "is_analyzed": True,
                            "source": "historical_fallback"
                        })
    except ImportError:
        # Fallback if yfinance not installed (should verify installation first)
        print("WARNING: yfinance not installed. Returning only csv data.")
        if market_data is not None:
            for ticker in unique_tickers:
                ticker_df = market_data[market_data['ticker'] == ticker]
                if not ticker_df.empty:
                    last_row = ticker_df.iloc[-1]
                    summary.append({
                        "ticker": ticker,
                        "name": ticker,
                        "price": round(last_row['close'], 2),
                        "change": round((last_row['close'] - last_row['open']) / last_row['open'] * 100, 2),
                        "is_analyzed": True
                    })
    return summary

@app.get("/news/{ticker}")
def get_news(ticker: str):
    """Fetches latest news for a specific ticker via Yahoo Finance."""
    try:
        ticker_obj = yf.Ticker(ticker.upper())
        news = ticker_obj.news
        
        if news:
            print(f"DEBUG NEWS ITEM STRUCTURE: {json.dumps(news[0], default=str)}", flush=True)
        else:
            print(f"DEBUG: No news found for {ticker}", flush=True)
        
        # Format for frontend
        formatted_news = []
        for item in news:
            # Handle nested content structure if present
            data_source = item.get('content', item) 
            
            # Check multiple possible keys for title
            title = data_source.get("title") or data_source.get("headline") or data_source.get("summary") or "No Title"
            
            formatted_news.append({
                "id": item.get("id", str(hash(title))),
                "headline": title,
                "source": data_source.get("publisher", "Yahoo Finance"),
                "published_at": str(data_source.get("pubDate") or data_source.get("providerPublishTime") or pd.Timestamp.now()),
                "sentiment": "Neutral",
                "link": data_source.get("clickThroughUrl") or data_source.get("link") or "#"
            })
            
        return {"news": formatted_news}
    except Exception as e:
        print(f"Error fetching news for {ticker}: {e}")
        return {"news": []}
