import torch
import pandas as pd
import numpy as np
import os
import sys

# Add src to path
sys.path.append(os.path.abspath("src"))

def verify():
    print("--- Verification Start ---")
    
    # 1. Load Data Dimensions
    if os.path.exists("market_data.csv"):
        df = pd.read_csv("market_data.csv")
        temporal_features = ['close', 'high', 'low', 'volume', 'rsi', 'macd', 'atr', 'ema_20']
        exclude = temporal_features + ['ticker', 'date', 'return_5d_forward', 'return_20d_forward', 'volatility_5d', 'trend_label', 'bb_middle']
        tabular_features = [col for col in df.columns if col not in exclude]
        print(f"CSV Tabular Features ({len(tabular_features)}): {tabular_features}")
    else:
        print("market_data.csv not found")
        return

    # 2. Check Checkpoint
    checkpoint_path = "mlruns/899924492415485795/e6aeda8bd5024a9f9680486234b225c2/checkpoints/epoch=2-step=96.ckpt"
    if os.path.exists(checkpoint_path):
        try:
            checkpoint = torch.load(checkpoint_path, map_location='cpu')
            if 'state_dict' in checkpoint and 'tabular_encoder.net.0.weight' in checkpoint['state_dict']:
                weight_shape = checkpoint['state_dict']['tabular_encoder.net.0.weight'].shape
                print(f"Checkpoint Tabular Input Weights: {weight_shape[1]}")
                
                # 3. Simulate Pruning
                input_dim = len(tabular_features)
                expected_dim = weight_shape[1]
                
                dummy_input = torch.randn(1, input_dim)
                print(f"Simulated Input: {dummy_input.shape}")
                
                if input_dim != expected_dim:
                    print(f"Mismatch! Pruning {input_dim} -> {expected_dim}")
                    pruned = dummy_input[:, :expected_dim]
                    print(f"Pruned Input: {pruned.shape}")
                    if pruned.shape[1] == expected_dim:
                        print("SUCCESS: Pruned input matches expected dimension.")
                    else:
                        print("FAIL: Pruning failed.")
                else:
                    print("No pruning needed.")
            else:
                 print("tabular_encoder weights not found in checkpoint")
        except Exception as e:
            print(f"Error loading checkpoint: {e}")
    else:
        print(f"Checkpoint not found at {checkpoint_path}")

if __name__ == "__main__":
    verify()
