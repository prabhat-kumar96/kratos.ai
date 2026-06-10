import argparse
import json
import os
import torch
from src.models.pipeline import FinancialIntelligencePipeline
from src.data.datamodule import MarketDataset
import pandas as pd

def load_checkpoint(checkpoint_path: str) -> FinancialIntelligencePipeline:
    """Load the trained Lightning model from a checkpoint file.
    Args:
        checkpoint_path: Full path to the ``.ckpt`` file produced by training.
    Returns:
        An instantiated ``FinancialIntelligencePipeline`` model in eval mode.
    """
    if not os.path.isfile(checkpoint_path):
        raise FileNotFoundError(f"Checkpoint not found: {checkpoint_path}")
    model = FinancialIntelligencePipeline.load_from_checkpoint(checkpoint_path)
    model.eval()
    return model

def prepare_sample(csv_path: str, json_path: str, ticker: str, window_size: int = 5):
    """Create a single sample batch for the given ticker.
    This mirrors the preprocessing logic used during training.
    """
    df = pd.read_csv(csv_path)
    with open(json_path, "r") as f:
        narratives = json.load(f)
    # Filter rows for the ticker
    ticker_df = df[df["ticker"] == ticker]
    if ticker_df.empty:
        raise ValueError(f"Ticker '{ticker}' not found in market data.")
    # Build a temporary MarketDataset to reuse the same preprocessing steps
    dataset = MarketDataset(ticker_df.reset_index(drop=True), narratives, window_size=window_size)
    # Use the last element of the dataset as the sample
    sample = dataset[len(dataset) - 1]
    # ---- Add batch dimensions expected by the model (no transpose) ----
    # Temporal: (window, feat) -> (1, window, feat)
    sample["temporal"] = sample["temporal"].unsqueeze(0)
    # Tabular: (feat,) -> (1, feat)
    sample["tabular"] = sample["tabular"].unsqueeze(0)
    # Text tensors: (seq_len,) -> (1, seq_len)
    sample["text_input_ids"] = sample["text_input_ids"].unsqueeze(0)
    sample["text_attn_mask"] = sample["text_attn_mask"].unsqueeze(0)
    return sample

def run_inference(
    checkpoint_path: str,
    csv_path: str,
    json_path: str,
    ticker: str,
    window_size: int = 5,
):
    """Convenient helper that loads the model, prepares a sample, and returns
    the raw prediction and reliability score.
    """
    model = load_checkpoint(checkpoint_path)
    sample = prepare_sample(csv_path, json_path, ticker, window_size=window_size)
    with torch.no_grad():
        out = model(sample)
    prediction = out["prediction"].cpu().numpy()
    reliability = float(out["reliability_score"].cpu().numpy())
    return prediction, reliability

def main():
    parser = argparse.ArgumentParser(description="Run inference with the trained Financial Intelligence model.")
    parser.add_argument("--checkpoint", type=str, required=True, help="Path to the .ckpt file produced by training.")
    parser.add_argument("--csv", type=str, default=os.path.join(os.path.dirname(__file__), "market_data.csv"), help="Path to market_data.csv.")
    parser.add_argument("--json", type=str, default=os.path.join(os.path.dirname(__file__), "narratives.json"), help="Path to narratives.json.")
    parser.add_argument("--ticker", type=str, required=True, help="Ticker symbol to run inference on.")
    parser.add_argument("--window", type=int, default=5, help="Temporal window size (default: 5).")
    args = parser.parse_args()
    pred, rel = run_inference(
        checkpoint_path=args.checkpoint,
        csv_path=args.csv,
        json_path=args.json,
        ticker=args.ticker,
        window_size=args.window,
    )
    print(f"Prediction for ticker {args.ticker}: {pred}")
    print(f"Reliability score: {rel:.4f}")

if __name__ == "__main__":
    main()
