import pandas as pd
import json
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ML_DIR = os.path.join(BASE_DIR, "ml")
CSV_PATH = os.path.join(ML_DIR, "market_data.csv")
JSON_PATH = os.path.join(ML_DIR, "narratives.json")

def verify_csv():
    print("--- Verifying market_data.csv ---")
    if not os.path.exists(CSV_PATH):
        print("FAIL: market_data.csv not found.")
        return
    
    df = pd.read_csv(CSV_PATH)
    print(f"Total Rows: {len(df)}")
    print(f"Columns: {list(df.columns)}")
    
    # Check for nulls
    nulls = df.isnull().sum()
    if nulls.any():
        print("WARNING: Null values found:")
        print(nulls[nulls > 0])
    else:
        print("PASS: No null values found.")
    
    # Check tickers
    print(f"Tickers found: {df['ticker'].unique()}")
    
    # Check value ranges for critical columns
    print("\nFeature Distributions:")
    cols_to_check = ['rsi', 'macd', 'atr', 'return_5d_forward', 'pe_ratio']
    print(df[cols_to_check].describe())

def verify_json():
    print("\n--- Verifying narratives.json ---")
    if not os.path.exists(JSON_PATH):
        print("FAIL: narratives.json not found.")
        return
    
    with open(JSON_PATH, 'r') as f:
        data = json.load(f)
    
    print(f"Total Narratives: {len(data)}")
    
    if len(data) == 0:
        print("FAIL: Narratives file is empty.")
        return

    # Check structure of first record
    sample = data[0]
    required_keys = ["ticker", "sector", "transcript", "sentiment", "alignment_flag", "final_return"]
    missing_keys = [k for k in required_keys if k not in sample]
    if missing_keys:
        print(f"FAIL: Missing keys in narrative records: {missing_keys}")
    else:
        print("PASS: All required keys present in sample record.")
    
    # Check alignment_flag distribution
    flags = [r['alignment_flag'] for r in data]
    true_count = sum(flags)
    avg_sentiment = sum(r['sentiment'] for r in data) / len(data)
    
    print(f"Alignment Flags: {true_count} True, {len(data) - true_count} False")
    print(f"Average Sentiment: {avg_sentiment:.3f}")
    
    # Check for empty transcripts
    empty_transcripts = [r for r in data if not r['transcript'] or len(r['transcript']) < 100]
    if empty_transcripts:
        print(f"WARNING: {len(empty_transcripts)} records have very short or empty transcripts.")
    else:
        print("PASS: No empty transcripts found.")

if __name__ == "__main__":
    verify_csv()
    verify_json()
