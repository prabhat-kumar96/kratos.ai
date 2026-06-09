import torch
from torch.utils.data import Dataset, DataLoader
import pytorch_lightning as L
from transformers import AutoTokenizer
import pandas as pd
import numpy as np
import json
import os

class MarketDataset(Dataset):
    def __init__(self, df, narratives, window_size=5, tokenizer_name='yiyanghkust/finbert-pretrain', max_len=64):
        self.df = df.copy()
        self.narratives = {n['ticker']: n for n in narratives}
        self.window_size = window_size
        self.tokenizer = AutoTokenizer.from_pretrained(tokenizer_name)
        self.max_len = max_len
        
        # Feature column lists for real data
        self.temporal_features = ['close', 'high', 'low', 'volume', 'rsi', 'macd', 'atr', 'ema_20']
        
        # Dynamically determine tabular features if not explicit
        if hasattr(self, 'tabular_features') and self.tabular_features:
            pass
        else:
            exclude = self.temporal_features + ['ticker', 'date', 'return_5d_forward', 'return_20d_forward', 'volatility_5d', 'trend_label', 'bb_middle']
            self.tabular_features = [col for col in self.df.columns if col not in exclude]
        
        print(f"MarketDataset initialized with {len(self.temporal_features)} temporal and {len(self.tabular_features)} tabular features")
        
        # Fill NaN values
        # Fill NaN values
        self.df = self.df.fillna(method='ffill').fillna(method='bfill').fillna(0)
        
        # Compute normalization statistics (Z-score normalization)
        all_features = self.temporal_features + self.tabular_features
        self.means = {}
        self.stds = {}
        for col in all_features:
            self.means[col] = self.df[col].mean()
            self.stds[col] = self.df[col].std()
            # Avoid division by zero
            if self.stds[col] == 0 or np.isnan(self.stds[col]):
                self.stds[col] = 1.0
            if np.isnan(self.means[col]):
                self.means[col] = 0.0
        
        # Prepare valid indices (we need at least window_size history for each sample)
        self.indices = []
        for ticker in self.df['ticker'].unique():
            ticker_indices = self.df.index[self.df['ticker'] == ticker].tolist()
            if len(ticker_indices) >= window_size:
                # We can start from the window_size-th index
                self.indices.extend(ticker_indices[window_size-1:])

    def _normalize(self, value, col):
        """Normalize a value using Z-score."""
        return (value - self.means[col]) / self.stds[col]

    def __len__(self):
        return len(self.indices)

    def __getitem__(self, idx):
        real_idx = self.indices[idx]
        row = self.df.iloc[real_idx]
        ticker = row['ticker']
        
        # 1. Temporal Branch: 5-day window with OHLCV + core technical indicators
        window_df = self.df.iloc[real_idx - self.window_size + 1 : real_idx + 1]
        
        # Normalize temporal features
        temp_data = np.zeros((self.window_size, len(self.temporal_features)), dtype=np.float32)
        for i, col in enumerate(self.temporal_features):
            temp_data[:, i] = (window_df[col].values - self.means[col]) / self.stds[col]
        temp_data = np.nan_to_num(temp_data, nan=0.0, posinf=0.0, neginf=0.0)
        temp = torch.tensor(temp_data, dtype=torch.float)
        
        # 2. Tabular Branch: Normalized snapshot features
        tabular_values = []
        for col in self.tabular_features:
            val = (row[col] - self.means[col]) / self.stds[col]
            tabular_values.append(val)
        tab_array = np.array(tabular_values, dtype=np.float32)
        tab_array = np.nan_to_num(tab_array, nan=0.0, posinf=0.0, neginf=0.0)
        tab = torch.tensor(tab_array, dtype=torch.float)

        
        # 3. Textual Branch: transcript
        narrative = self.narratives.get(ticker, {"transcript": ""})
        text = narrative['transcript']
        encoding = self.tokenizer.encode_plus(
            text,
            add_special_tokens=True,
            max_length=self.max_len,
            padding='max_length',
            truncation=True,
            return_attention_mask=True,
            return_tensors='pt'
        )
        
        # Targets: Multiple targets for different prediction tasks
        target_return = torch.tensor(row['return_5d_forward'], dtype=torch.float)
        target_volatility = torch.tensor(row['volatility_5d'], dtype=torch.float)
        target_trend = torch.tensor(row['trend_label'], dtype=torch.long)
        
        # Output a batch dictionary where each key corresponds to a modality
        return {
            "temporal": temp,
            "tabular": tab,
            "text_input_ids": encoding['input_ids'].flatten(),
            "text_attn_mask": encoding['attention_mask'].flatten(),
            "target_return": target_return,
            "target_volatility": target_volatility,
            "target_trend": target_trend
        }

class FinancialDataModule(L.LightningDataModule):
    def __init__(self, csv_path, json_path, window_size=5, batch_size=32, num_workers=0, persistent_workers=False):
        super().__init__()
        self.csv_path = csv_path
        self.json_path = json_path
        self.window_size = window_size
        self.batch_size = batch_size
        self.num_workers = num_workers
        self.persistent_workers = persistent_workers

    def setup(self, stage=None):
        df = pd.read_csv(self.csv_path)
        with open(self.json_path, 'r') as f:
            narratives = json.load(f)
            
        # Split by ticker for simple train/val split
        tickers = df['ticker'].unique()
        train_tickers = tickers[:4]
        val_tickers = tickers[4:]
        
        train_df = df[df['ticker'].isin(train_tickers)].reset_index(drop=True)
        val_df = df[df['ticker'].isin(val_tickers)].reset_index(drop=True)
        
        self.train_dataset = MarketDataset(train_df, narratives, window_size=self.window_size)
        self.val_dataset = MarketDataset(val_df, narratives, window_size=self.window_size)

    def train_dataloader(self):
        return DataLoader(self.train_dataset, batch_size=self.batch_size, shuffle=True, 
                          num_workers=self.num_workers, persistent_workers=self.persistent_workers)

    def val_dataloader(self):
        return DataLoader(self.val_dataset, batch_size=self.batch_size, 
                          num_workers=self.num_workers, persistent_workers=self.persistent_workers)
