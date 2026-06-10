import os
import pandas as pd
import numpy as np
import json
import glob
from datetime import datetime, timedelta

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ML_DIR = os.path.join(BASE_DIR, "ml")
DATASET_PATH = os.path.join(BASE_DIR, "ml_dataset")
FNSPID_PRICE_DIR = os.path.join(DATASET_PATH, "FNSPID", "FNSPID_Financial_News_Dataset", "dataset_test", "Transformer-for-Time-Series-Prediction", "data")
TRANSCRIPT_DIR = os.path.join(DATASET_PATH, "Earnings-Call-Sentiment", "archive", "Transcripts")

# Tickers to process (Overlapping between prices and transcripts)
TICKERS = ["AAPL", "AMD", "AMZN", "GOOG", "INTC", "MSFT", "MU", "NVDA"]
TRANSCRIPT_MAP = {"GOOG": "GOOGL"} # Map price ticker to transcript folder name if different

# Constants
WINDOW_SIZE = 5

def calculate_technical_indicators(df):
    """Calculates RSI, MACD, ATR, Bollinger Bands, Moving Averages."""
    # RSI
    delta = df['close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss
    df['rsi'] = 100 - (100 / (1 + rs))

    # MACD
    ema_12 = df['close'].ewm(span=12, adjust=False).mean()
    ema_26 = df['close'].ewm(span=26, adjust=False).mean()
    df['macd'] = ema_12 - ema_26
    df['macd_signal'] = df['macd'].ewm(span=9, adjust=False).mean()

    # ATR
    high_low = df['high'] - df['low']
    high_close = np.abs(df['high'] - df['close'].shift())
    low_close = np.abs(df['low'] - df['close'].shift())
    ranges = pd.concat([high_low, high_close, low_close], axis=1)
    true_range = np.max(ranges, axis=1)
    df['atr'] = true_range.rolling(14).mean()

    # Bollinger Bands
    df['bb_middle'] = df['close'].rolling(window=20).mean()
    df['bb_std'] = df['close'].rolling(window=20).std()
    df['bb_upper'] = df['bb_middle'] + (df['bb_std'] * 2)
    df['bb_lower'] = df['bb_middle'] - (df['bb_std'] * 2)

    # Moving Averages
    df['sma_50'] = df['close'].rolling(window=50).mean()
    df['sma_200'] = df['close'].rolling(window=200).mean()
    df['ema_20'] = df['close'].ewm(span=20, adjust=False).mean()

    # OBV
    df['obv'] = (np.sign(df['close'].diff()) * df['volume']).fillna(0).cumsum()

    return df

def calculate_targets(df):
    """Calculates forward returns, volatility, and trend."""
    # Forward Returns
    df['return_5d_forward'] = df['close'].shift(-5) / df['close'] - 1
    df['return_20d_forward'] = df['close'].shift(-20) / df['close'] - 1

    # Volatility (standard deviation of daily returns over 5 days)
    daily_returns = df['close'].pct_change()
    df['volatility_5d'] = daily_returns.rolling(window=5).std()

    # Trend Label (1 if 5d return > 0, 0 otherwise)
    df['trend_label'] = (df['return_5d_forward'] > 0).astype(int)

    return df

def generate_semi_synthetic_fundamentals(df, ticker):
    """Generates plausibly grounded fundamental data."""
    # Sector mapping (Static for our sample)
    sectors = {
        "AAPL": "Technology", "AMD": "Technology", "AMZN": "Consumer Cyclical",
        "GOOG": "Technology", "INTC": "Technology", "MSFT": "Technology",
        "MU": "Technology", "NVDA": "Technology"
    }
    sector = sectors.get(ticker, "Miscellaneous")
    
    # Simple ID for sector
    sector_id_map = {"Technology": 1, "Consumer Cyclical": 2, "Miscellaneous": 0}
    df['sector_id'] = sector_id_map.get(sector, 0)

    # Semi-synthetic values (grounded in typical tech ranges)
    # We use some randomization around real-ish targets
    df['pe_ratio'] = np.random.normal(30, 10, len(df))
    df['debt_to_equity'] = np.random.normal(0.8, 0.3, len(df))
    df['market_cap_b'] = np.random.normal(500, 200, len(df))
    df['quick_ratio'] = np.random.normal(1.5, 0.5, len(df))

    return df

def process_ticker(ticker):
    print(f"Processing {ticker}...")
    price_file = os.path.join(FNSPID_PRICE_DIR, f"{ticker}.csv")
    if not os.path.exists(price_file):
        print(f"Price file not found for {ticker}")
        return None, []

    df = pd.read_csv(price_file)
    # Clean column names
    df.columns = [c.lower().replace(" ", "_") for c in df.columns]
    
    # Convert date and sort
    df['date'] = pd.to_datetime(df['date']).dt.tz_localize(None)
    df = df.sort_values('date')

    # Add ticker
    df['ticker'] = ticker

    # Calculate indicators and targets
    df = calculate_technical_indicators(df)
    df = calculate_targets(df)
    df = generate_semi_synthetic_fundamentals(df, ticker)

    # Transcript matching
    transcript_folder = TRANSCRIPT_MAP.get(ticker, ticker)
    transcript_path = os.path.join(TRANSCRIPT_DIR, transcript_folder)
    narratives = []

    if os.path.exists(transcript_path):
        txt_files = glob.glob(os.path.join(transcript_path, "*.txt"))
        for txt_file in txt_files:
            filename = os.path.basename(txt_file)
            # Typical format: 2016-Apr-26-AAPL.txt
            parts = filename.split('-')
            if len(parts) >= 3:
                date_str = f"{parts[0]}-{parts[1]}-{parts[2]}"
                try:
                    transcript_date = datetime.strptime(date_str, "%Y-%b-%d")
                    # Find closest date in price df
                    idx = (df['date'] - transcript_date).abs().idxmin()
                    matched_row = df.loc[idx]
                    
                    # Sentiment from FNSPID price CSV (scaled_sentiment column)
                    sentiment_score = matched_row['scaled_sentiment'] if 'scaled_sentiment' in df.columns else 0.5
                    
                    with open(txt_file, 'r', encoding='utf-8', errors='ignore') as f:
                        text = f.read()
                        # Extract a relevant snippet or full text
                        transcript_text = text[:5000] # Use first 5k chars for brevity in this sample
                    
                    forward_return = matched_row['return_5d_forward']
                    
                    # alignment_flag: True if sentiment matches return direction
                    alignment_flag = False
                    if (sentiment_score > 0.6 and forward_return > 0.01) or \
                       (sentiment_score < 0.4 and forward_return < -0.01) or \
                       (0.4 <= sentiment_score <= 0.6 and abs(forward_return) <= 0.01):
                        alignment_flag = True

                    narratives.append({
                        "ticker": str(ticker),
                        "sector": int(matched_row.get('sector_id', 0)),
                        "transcript": str(transcript_text),
                        "sentiment": float(sentiment_score),
                        "alignment_flag": bool(alignment_flag),
                        "final_return": float(forward_return) if not np.isnan(forward_return) else 0.0
                    })
                except Exception as e:
                    print(f"Error parsing transcript {filename}: {e}")

    # Drop rows with NaN in critical features (init start-up window)
    df = df.dropna(subset=['rsi', 'macd', 'atr', 'bb_upper', 'sma_50', 'sma_200', 'return_5d_forward'])

    return df, narratives

def main():
    all_prices = []
    all_narratives = []

    for ticker in TICKERS:
        df, nar = process_ticker(ticker)
        if df is not None:
            all_prices.append(df)
            all_narratives.extend(nar)

    if not all_prices:
        print("No data processed.")
        return

    # Consolidate
    final_df = pd.concat(all_prices)
    
    # Reorder columns as per specification
    columns = [
        'ticker', 'date', 'open', 'high', 'low', 'close', 'volume',
        'rsi', 'macd', 'macd_signal', 'atr', 'bb_upper', 'bb_middle', 'bb_lower',
        'sma_50', 'sma_200', 'ema_20', 'obv',
        'sector_id', 'pe_ratio', 'debt_to_equity', 'market_cap_b', 'quick_ratio',
        'return_5d_forward', 'return_20d_forward', 'volatility_5d', 'trend_label'
    ]
    # Filter only available columns
    final_df = final_df[[c for c in columns if c in final_df.columns]]

    # Ensure ML directory exists
    os.makedirs(ML_DIR, exist_ok=True)

    # Save
    csv_out = os.path.join(ML_DIR, "market_data.csv")
    json_out = os.path.join(ML_DIR, "narratives.json")

    final_df.to_csv(csv_out, index=False)
    with open(json_out, 'w') as f:
        json.dump(all_narratives, f, indent=2)

    print(f"Pipeline complete.")
    print(f"Saved {len(final_df)} rows to {csv_out}")
    print(f"Saved {len(all_narratives)} narratives to {json_out}")

if __name__ == "__main__":
    main()
