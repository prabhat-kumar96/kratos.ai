# ===================================================
# Kratos.ai - Full Training Script with Real yfinance Data
# Saves a slim checkpoint excluding frozen FinBERT weights (~5-10 MB)
# Usage: python train_realdata.py
# ===================================================
import os
import sys
import json
import math
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import pytorch_lightning as L
from pytorch_lightning.callbacks import ModelCheckpoint, EarlyStopping
from torch.utils.data import Dataset, DataLoader
from datetime import datetime, timedelta

# -------------------------------------------------------
# 1. Fetch real market data via yfinance
# -------------------------------------------------------
def fetch_market_data(tickers, period="2y"):
    """Download OHLCV + compute all technical indicators."""
    import yfinance as yf

    all_dfs = []
    for ticker in tickers:
        print(f"  Fetching {ticker}...", flush=True)
        try:
            raw = yf.download(ticker, period=period, auto_adjust=True, progress=False)
            if raw.empty:
                print(f"  WARNING: No data for {ticker}, skipping.", flush=True)
                continue

            # Flatten MultiIndex columns if present
            if isinstance(raw.columns, pd.MultiIndex):
                raw.columns = raw.columns.get_level_values(0)

            df = raw.copy()
            df.columns = [c.lower() for c in df.columns]
            df.index.name = "date"
            df = df.reset_index()
            df["date"] = df["date"].astype(str)
            df["ticker"] = ticker

            # ---- Technical Indicators ----
            # RSI (14)
            delta = df["close"].diff()
            gain = delta.where(delta > 0, 0).rolling(14).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
            rs = gain / (loss + 1e-9)
            df["rsi"] = 100 - (100 / (1 + rs))

            # MACD (12, 26, 9)
            ema12 = df["close"].ewm(span=12, adjust=False).mean()
            ema26 = df["close"].ewm(span=26, adjust=False).mean()
            df["macd"] = ema12 - ema26
            df["macd_signal"] = df["macd"].ewm(span=9, adjust=False).mean()

            # ATR (14)
            hl = df["high"] - df["low"]
            hc = (df["high"] - df["close"].shift()).abs()
            lc = (df["low"] - df["close"].shift()).abs()
            df["atr"] = pd.concat([hl, hc, lc], axis=1).max(axis=1).rolling(14).mean()

            # Bollinger Bands (20)
            bb_mid = df["close"].rolling(20).mean()
            bb_std = df["close"].rolling(20).std()
            df["bb_upper"] = bb_mid + 2 * bb_std
            df["bb_middle"] = bb_mid
            df["bb_lower"] = bb_mid - 2 * bb_std

            # Moving averages
            df["sma_50"] = df["close"].rolling(50).mean()
            df["sma_200"] = df["close"].rolling(200).mean()
            df["ema_20"] = df["close"].ewm(span=20, adjust=False).mean()

            # OBV
            df["obv"] = (np.sign(df["close"].diff()) * df["volume"]).fillna(0).cumsum()

            # ---- Fundamental placeholders (sector-grounded) ----
            df["sector_id"] = 1  # Technology
            df["pe_ratio"] = np.random.normal(30, 8, len(df)).clip(5, 80)
            df["debt_to_equity"] = np.random.normal(0.8, 0.25, len(df)).clip(0, 3)
            df["market_cap_b"] = np.random.normal(500, 200, len(df)).clip(10, 3000)
            df["quick_ratio"] = np.random.normal(1.5, 0.4, len(df)).clip(0.2, 5)

            # ---- Forward targets ----
            df["return_5d_forward"] = df["close"].shift(-5) / (df["close"] + 1e-9) - 1
            df["return_20d_forward"] = df["close"].shift(-20) / (df["close"] + 1e-9) - 1
            df["volatility_5d"] = df["close"].pct_change().rolling(5).std()
            df["trend_label"] = (df["return_5d_forward"] > 0).astype(int)

            # Drop rows with NaN in critical columns
            critical = ["rsi", "macd", "atr", "bb_upper", "sma_50", "return_5d_forward"]
            df = df.dropna(subset=critical).reset_index(drop=True)

            if len(df) < 30:
                print(f"  WARNING: {ticker} has only {len(df)} clean rows, skipping.", flush=True)
                continue

            all_dfs.append(df)
            print(f"  {ticker}: {len(df)} rows", flush=True)

        except Exception as e:
            print(f"  ERROR fetching {ticker}: {e}", flush=True)

    if not all_dfs:
        raise RuntimeError("No market data fetched.")

    combined = pd.concat(all_dfs, ignore_index=True)
    return combined


# -------------------------------------------------------
# 2. Lightweight TextEncoder for training (no FinBERT download)
# -------------------------------------------------------
class SimpleTextEncoder(nn.Module):
    """
    Simple bag-of-words projection replacing FinBERT during training.
    Uses random projections of token IDs — learns a projection to latent space.
    Avoids downloading 440 MB FinBERT weights during automated training.
    The real FinBERT encoder is still used in production when LIGHTWEIGHT_MODE=false.
    """
    def __init__(self, vocab_size=30522, embed_dim=64, latent_dim=128):
        super().__init__()
        self.embed = nn.Embedding(vocab_size, embed_dim, padding_idx=0)
        self.proj = nn.Sequential(
            nn.Linear(embed_dim, latent_dim),
            nn.ReLU(),
            nn.Linear(latent_dim, latent_dim),
        )

    def forward(self, input_ids, attention_mask):
        # input_ids: (B, seq_len)
        mask = attention_mask.float().unsqueeze(-1)            # (B, seq_len, 1)
        embedded = self.embed(input_ids)                       # (B, seq_len, embed_dim)
        masked = embedded * mask
        pooled = masked.sum(dim=1) / (mask.sum(dim=1) + 1e-9) # mean pooling
        return self.proj(pooled)                               # (B, latent_dim)


# -------------------------------------------------------
# 3. Slim Pipeline (no FinBERT dependency)
# -------------------------------------------------------
class SlimFinancialPipeline(L.LightningModule):
    def __init__(self, temporal_dim=8, tabular_dim=10, latent_dim=128, lr=1e-4):
        super().__init__()
        self.save_hyperparameters()

        # Temporal encoder (Transformer)
        self.temporal_embed = nn.Linear(temporal_dim, latent_dim)
        enc_layer = nn.TransformerEncoderLayer(d_model=latent_dim, nhead=8, batch_first=True,
                                                dim_feedforward=256, dropout=0.1)
        self.temporal_transformer = nn.TransformerEncoder(enc_layer, num_layers=2)
        self.temporal_pool = nn.AdaptiveAvgPool1d(1)

        # Tabular encoder (MLP)
        self.tabular_net = nn.Sequential(
            nn.Linear(tabular_dim, 256),
            nn.BatchNorm1d(256),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(256, latent_dim),
        )

        # Text encoder (simple, no FinBERT)
        self.text_encoder = SimpleTextEncoder(latent_dim=latent_dim)

        # Fusion + prediction
        self.numeric_proj = nn.Linear(latent_dim * 2, latent_dim)
        self.predictor = nn.Sequential(
            nn.Linear(latent_dim * 2, 64),
            nn.ReLU(),
            nn.Linear(64, 1),
        )

    def _encode(self, batch):
        # Temporal
        x = self.temporal_embed(batch["temporal"])
        x = self.temporal_transformer(x)
        x = self.temporal_pool(x.transpose(1, 2)).squeeze(-1)
        z_temporal = x

        # Tabular
        z_tabular = self.tabular_net(batch["tabular"])

        # Text
        z_text = self.text_encoder(batch["text_input_ids"], batch["text_attn_mask"])

        # Fusion
        z_numeric = self.numeric_proj(torch.cat([z_temporal, z_tabular], dim=-1))
        z_combined = torch.cat([z_numeric, z_text], dim=-1)
        return z_numeric, z_text, z_combined

    def forward(self, batch):
        z_numeric, z_text, z_combined = self._encode(batch)
        pred = self.predictor(z_combined)
        dist = torch.norm(z_text - z_numeric, p=2, dim=1)
        reliability = torch.exp(-dist.clamp(0, 100))
        reliability = torch.where(torch.isnan(reliability), torch.tensor(0.5), reliability)
        return {"prediction": pred, "reliability_score": reliability,
                "regime_id": 0, "is_consistent": (reliability > 0.7),
                "z_shared": z_numeric}

    def training_step(self, batch, batch_idx):
        z_numeric, z_text, z_combined = self._encode(batch)
        pred = self.predictor(z_combined).squeeze()
        target = batch["target_return"]
        task_loss = nn.functional.mse_loss(pred, target)
        consis_loss = 1 - nn.functional.cosine_similarity(z_text, z_numeric).mean()
        loss = task_loss + 0.5 * consis_loss
        self.log("train/loss", loss, prog_bar=True)
        self.log("train/task_loss", task_loss)
        return loss

    def validation_step(self, batch, batch_idx):
        z_numeric, z_text, z_combined = self._encode(batch)
        pred = self.predictor(z_combined).squeeze()
        val_loss = nn.functional.mse_loss(pred, batch["target_return"])
        self.log("val/loss", val_loss, prog_bar=True)
        return val_loss

    def configure_optimizers(self):
        return torch.optim.AdamW(self.parameters(), lr=self.hparams.lr, weight_decay=1e-4)


# -------------------------------------------------------
# 4. Dataset
# -------------------------------------------------------
class MarketDataset(Dataset):
    def __init__(self, df, narratives_dict, window_size=5, max_len=32):
        self.df = df.reset_index(drop=True)
        self.narratives = narratives_dict
        self.window_size = window_size
        self.max_len = max_len

        self.temporal_features = ["close", "high", "low", "volume", "rsi", "macd", "atr", "ema_20"]
        exclude = self.temporal_features + ["ticker", "date", "return_5d_forward",
                                            "return_20d_forward", "volatility_5d",
                                            "trend_label", "bb_middle"]
        self.tabular_features = [c for c in df.columns if c not in exclude]

        # Normalise
        all_feats = self.temporal_features + self.tabular_features
        self.means = {c: df[c].mean() for c in all_feats}
        self.stds  = {c: max(df[c].std(), 1e-6) for c in all_feats}

        # Valid indices (need window_size history)
        self.indices = []
        for ticker in self.df["ticker"].unique():
            idx_list = self.df.index[self.df["ticker"] == ticker].tolist()
            if len(idx_list) >= window_size:
                self.indices.extend(idx_list[window_size - 1:])

    def __len__(self): return len(self.indices)

    def _norm(self, val, col):
        return (val - self.means[col]) / self.stds[col]

    def __getitem__(self, idx):
        real_idx = self.indices[idx]
        row = self.df.iloc[real_idx]
        ticker = row["ticker"]

        # Temporal window
        win = self.df.iloc[real_idx - self.window_size + 1: real_idx + 1]
        temp = np.zeros((self.window_size, len(self.temporal_features)), np.float32)
        for i, c in enumerate(self.temporal_features):
            temp[:, i] = np.nan_to_num((win[c].values - self.means[c]) / self.stds[c])
        temp_t = torch.tensor(temp, dtype=torch.float)

        # Tabular
        tab = np.array([np.nan_to_num(self._norm(row[c], c)) for c in self.tabular_features], np.float32)
        tab_t = torch.tensor(tab, dtype=torch.float)

        # Text (tokenize with simple word IDs, capped at max_len)
        narrative = self.narratives.get(ticker, {})
        text = str(narrative.get("transcript", ""))[:500]
        # Simple tokenizer: map each char ord to a vocab bucket
        token_ids = [min(ord(c) % 30522, 30521) for c in text[:self.max_len]]
        pad_len = self.max_len - len(token_ids)
        token_ids = token_ids + [0] * pad_len
        attn_mask = [1] * (self.max_len - pad_len) + [0] * pad_len
        ids_t = torch.tensor(token_ids, dtype=torch.long)
        mask_t = torch.tensor(attn_mask, dtype=torch.long)

        target = torch.tensor(float(row["return_5d_forward"]), dtype=torch.float)
        if torch.isnan(target): target = torch.tensor(0.0)

        return {"temporal": temp_t, "tabular": tab_t,
                "text_input_ids": ids_t, "text_attn_mask": mask_t,
                "target_return": target}


# -------------------------------------------------------
# 5. Main
# -------------------------------------------------------
def main():
    TICKERS = [
        # US Tech & AI Giants
        "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "AMD", "INTC", "TSM", "ORCL",
        # High-Growth Startups & Unicorns
        "TSLA", "PLTR", "SNOW", "CRWD", "ARM", "COIN", "SHOP", "UBER", "ABNB", "SPOT", "RBLX", "RIVN",
        # Indian Giants & Global Banking (Available via US ADRs & NYSE)
        "IBN", "HDB", "INFY", "WIT", "HSBC", "JPM", "V", "MA",
        # Consumer & Industrial Leaders
        "NFLX", "DIS", "WMT", "KO", "LLY", "BA"
    ]
    CHECKPOINT_DIR = os.path.join(os.path.dirname(__file__), "checkpoints")
    os.makedirs(CHECKPOINT_DIR, exist_ok=True)

    # --- Fetch Data ---
    print("\n=== Step 1: Fetching real market data via yfinance ===", flush=True)
    df = fetch_market_data(TICKERS, period="2y")
    print(f"Total rows: {len(df)}", flush=True)

    # Save updated market_data.csv (overwrites the existing one)
    csv_path = os.path.join(os.path.dirname(__file__), "market_data.csv")
    df.to_csv(csv_path, index=False)
    print(f"Saved market_data.csv ({len(df)} rows)", flush=True)

    # Load narratives
    nar_path = os.path.join(os.path.dirname(__file__), "narratives.json")
    narratives_dict = {}
    if os.path.exists(nar_path):
        with open(nar_path) as f:
            nar_list = json.load(f)
        # One narrative per ticker (use first match)
        for n in nar_list:
            t = n.get("ticker", "")
            if t not in narratives_dict:
                narratives_dict[t] = n
        print(f"Loaded {len(narratives_dict)} narrative entries", flush=True)

    # --- Dataset ---
    print("\n=== Step 2: Building datasets ===", flush=True)
    tickers = df["ticker"].unique()
    split = max(1, len(tickers) - 2)
    train_tickers = tickers[:split]
    val_tickers   = tickers[split:]

    train_df = df[df["ticker"].isin(train_tickers)].reset_index(drop=True)
    val_df   = df[df["ticker"].isin(val_tickers)].reset_index(drop=True)

    train_ds = MarketDataset(train_df, narratives_dict, window_size=5)
    val_ds   = MarketDataset(val_df, narratives_dict, window_size=5)
    print(f"Train samples: {len(train_ds)}, Val samples: {len(val_ds)}", flush=True)

    tabular_dim = len(train_ds.tabular_features)
    print(f"temporal_dim=8, tabular_dim={tabular_dim}", flush=True)

    train_loader = DataLoader(train_ds, batch_size=64, shuffle=True, num_workers=0)
    val_loader   = DataLoader(val_ds,   batch_size=64, shuffle=False, num_workers=0)

    # --- Model ---
    print("\n=== Step 3: Training model ===", flush=True)
    model = SlimFinancialPipeline(temporal_dim=8, tabular_dim=tabular_dim, latent_dim=128, lr=1e-4)

    ckpt_callback = ModelCheckpoint(
        dirpath=CHECKPOINT_DIR,
        filename="kratos_best",
        monitor="val/loss",
        mode="min",
        save_top_k=1,
    )
    early_stop = EarlyStopping(monitor="val/loss", patience=3, mode="min")

    trainer = L.Trainer(
        max_epochs=5,
        accelerator="cpu",
        devices=1,
        callbacks=[ckpt_callback, early_stop],
        gradient_clip_val=1.0,
        log_every_n_steps=5,
        enable_progress_bar=True,
        enable_model_summary=True,
    )

    trainer.fit(model, train_loader, val_loader)

    best_path = ckpt_callback.best_model_path
    print(f"\n=== Training complete. Best checkpoint: {best_path} ===", flush=True)

    # --- Save slim checkpoint (exclude text encoder to keep file small) ---
    slim_path = os.path.join(CHECKPOINT_DIR, "kratos_slim.ckpt")
    checkpoint = torch.load(best_path, map_location="cpu")

    # Remove text_encoder embedding weights (large, can be reinitialised)
    slim_state = {k: v for k, v in checkpoint["state_dict"].items()
                  if not k.startswith("text_encoder.embed.")}
    checkpoint["state_dict"] = slim_state
    checkpoint["hyper_parameters"]["tabular_dim"] = tabular_dim
    torch.save(checkpoint, slim_path)

    slim_size_mb = os.path.getsize(slim_path) / 1024 / 1024
    full_size_mb = os.path.getsize(best_path) / 1024 / 1024
    print(f"Full checkpoint : {full_size_mb:.1f} MB  -> {best_path}", flush=True)
    print(f"Slim checkpoint : {slim_size_mb:.1f} MB  -> {slim_path}", flush=True)
    print("\nDone! Commit ml/checkpoints/kratos_slim.ckpt to git.", flush=True)


if __name__ == "__main__":
    main()
