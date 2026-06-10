
import yfinance as yf
import json
import pandas as pd
import os

print("--- NEWS STRUCTURE CHECK ---")
try:
    ticker = yf.Ticker("SPY")
    news = ticker.news
    if news:
        print(json.dumps(news[0], indent=2))
    else:
        print("No news found for SPY")
except Exception as e:
    print(f"News Error: {e}")

print("\n--- MARKET DATA CHECK ---")
try:
    if os.path.exists("market_data.csv"):
        df = pd.read_csv("market_data.csv")
        print(f"Columns: {df.columns.tolist()}")
        print(f"Unique Tickers: {df['ticker'].unique().tolist()}")
        print(f"Is AAPL present? {'AAPL' in df['ticker'].values or 'aapl' in df['ticker'].values}")
    else:
        print("market_data.csv NOT FOUND")
except Exception as e:
    print(f"CSV Error: {e}")
