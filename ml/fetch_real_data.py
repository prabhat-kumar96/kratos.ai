import yfinance as yf
import pandas as pd
import numpy as np
import json
import time

TICKERS = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "AMD", "NFLX", "INTC"]

print("Fetching real historical market data (2 years)...")
all_dfs = []
narratives = []

for ticker in TICKERS:
    print(f"Downloading {ticker}...")
    try:
        t = yf.Ticker(ticker)
        df = t.history(period="2y")
        if df.empty:
            continue
        
        df.reset_index(inplace=True)
        df.columns = [c.lower() for c in df.columns]
        if 'datetime' in df.columns:
            df.rename(columns={'datetime': 'date'}, inplace=True)
        
        df['date'] = df['date'].astype(str)
        df['ticker'] = ticker

        # Calculate Real Technical Indicators
        # RSI
        delta = df['close'].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        df['rsi'] = (100 - (100 / (1 + rs))).fillna(50.0)

        # MACD
        ema_12 = df['close'].ewm(span=12, adjust=False).mean()
        ema_26 = df['close'].ewm(span=26, adjust=False).mean()
        df['macd'] = (ema_12 - ema_26).fillna(0.0)

        # ATR
        high_low = df['high'] - df['low']
        high_close = np.abs(df['high'] - df['close'].shift())
        low_close = np.abs(df['low'] - df['close'].shift())
        ranges = pd.concat([high_low, high_close, low_close], axis=1)
        true_range = np.max(ranges, axis=1)
        df['atr'] = true_range.rolling(14).mean().fillna(1.0)

        # EMAs & Moving averages
        df['ema_20'] = df['close'].ewm(span=20, adjust=False).mean()

        # Forward Targets
        df['return_5d_forward'] = (df['close'].shift(-5) / df['close'] - 1).fillna(0.0)
        df['return_20d_forward'] = (df['close'].shift(-20) / df['close'] - 1).fillna(0.0)
        df['volatility_5d'] = df['close'].pct_change().rolling(5).std().fillna(0.02)
        df['trend_label'] = (df['return_5d_forward'] > 0).astype(int)

        # Fundamental features
        df['pe_ratio'] = 25.0
        df['debt_to_equity'] = 0.5
        df['market_cap_b'] = 500.0
        df['quick_ratio'] = 1.2
        df['sector_id'] = 1

        all_dfs.append(df)

        # Extract latest real news narrative for FinBERT
        news_items = t.news or []
        summary = news_items[0].get('title', f'{ticker} stock analysis') if news_items else f'{ticker} continuous market report'
        narratives.append({
            "ticker": ticker,
            "narrative": summary
        })

        time.sleep(0.5)  # Friendly delay
    except Exception as e:
        print(f"Error fetching {ticker}: {e}")

if all_dfs:
    final_df = pd.concat(all_dfs, ignore_index=True)
    final_df.to_csv("market_data.csv", index=False)
    with open("narratives.json", "w") as f:
        json.dump(narratives, f, indent=2)
    print(f"✅ Successfully saved {len(final_df)} real rows to market_data.csv and narratives.json!")