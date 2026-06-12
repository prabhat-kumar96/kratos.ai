import os
import torch
import pandas as pd
import numpy as np
import json
from src.models.pipeline import FinancialIntelligencePipeline
from transformers import AutoTokenizer

def load_state_with_strict_fix(model, state_dict):
    """Helper to fix state dict prefix issues common in PyTorch Lightning."""
    new_state_dict = {}
    for k, v in state_dict.items():
        name = k[6:] if k.startswith('model.') else k
        new_state_dict[name] = v
    model.load_state_dict(new_state_dict, strict=False)

def test_inference_logic():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    checkpoint_path = os.path.join(base_dir, "mlruns", "717114918474650167", "b4d25f1e85c443a2bb50e1d67e6c82c5", "checkpoints", "epoch=0-step=62.ckpt")
    csv_path = os.path.join(base_dir, "market_data.csv")
    json_path = os.path.join(base_dir, "narratives.json")

    print(f"Loading checkpoint from {checkpoint_path}")
    
    # 1. Initialize Model
    model = FinancialIntelligencePipeline(
        temporal_dim=8,
        tabular_dim=13,
        latent_dim=128
    )
    
    checkpoint = torch.load(checkpoint_path, map_location=torch.device('cpu'))
    load_state_with_strict_fix(model, checkpoint['state_dict'])
    model.eval()

    # Check weights for NaN
    has_nan = False
    has_nonzero = False
    for name, param in model.named_parameters():
        if torch.isnan(param).any():
            print(f"WARNING: NaN detected in parameter: {name}")
            has_nan = True
        if (param != 0).any():
            has_nonzero = True
    
    if has_nan:
        print("ERROR: Model has NaN weights!")
    elif not has_nonzero:
        print("WARNING: All model weights are zero!")
    else:
        print("Model weights loaded successfully (no NaN, non-zero values present)")

    # 2. Load Real Data with NaN handling
    df = pd.read_csv(csv_path)
    df = df.fillna(method='ffill').fillna(method='bfill').fillna(0)
    
    with open(json_path, 'r') as f:
        narratives = json.load(f)
    
    ticker = df['ticker'].unique()[0]
    ticker_df = df[df['ticker'] == ticker].tail(5)
    narrative = next(n for n in narratives if n['ticker'] == ticker)
    
    # Prep Inputs with NaN protection
    temporal_features = ['price', 'high', 'low', 'volume', 'rsi', 'macd', 'atr', 'bb_width']
    temp_data = ticker_df[temporal_features].values.astype(np.float32)
    temp_data = np.nan_to_num(temp_data, nan=0.0, posinf=0.0, neginf=0.0)
    temp_input = torch.tensor(temp_data, dtype=torch.float).unsqueeze(0)
    
    print(f"Temporal input range: min={temp_input.min().item():.4f}, max={temp_input.max().item():.4f}")

    last_row = ticker_df.iloc[-1]
    tab_features = [
        last_row['sma_20'], last_row['sma_50'], last_row['ema_12'],
        last_row['macd_signal'], last_row['bb_upper'], last_row['bb_lower'],
        last_row['obv'],
        last_row['pe_ratio'], last_row['debt_ratio'], last_row['profit_margin'],
        last_row['revenue_growth'], last_row['market_cap_category'], last_row['sector_id']
    ]
    tab_array = np.array(tab_features, dtype=np.float32)
    tab_array = np.nan_to_num(tab_array, nan=0.0, posinf=0.0, neginf=0.0)
    tab_input = torch.tensor([tab_array], dtype=torch.float)
    
    print(f"Tabular input range: min={tab_input.min().item():.4f}, max={tab_input.max().item():.4f}")
    
    tokenizer = AutoTokenizer.from_pretrained('yiyanghkust/finbert-pretrain')
    encoding = tokenizer.encode_plus(
        narrative['transcript'],
        add_special_tokens=True,
        max_length=64,
        padding='max_length',
        truncation=True,
        return_tensors='pt'
    )
    
    batch = {
        "temporal": temp_input,
        "tabular": tab_input,
        "text_input_ids": encoding['input_ids'],
        "text_attn_mask": encoding['attention_mask']
    }
    
    with torch.no_grad():
        outputs = model(batch)
    
    prediction = outputs['prediction'].item()
    reliability = outputs['reliability_score'].item()
    
    print("\n=== Inference Results ===")
    print(f"Ticker: {ticker}")
    print(f"Prediction: {prediction}")
    print(f"Reliability: {reliability}")
    print(f"Regime ID: {outputs['regime_id']}")
    print(f"Is Consistent: {outputs['is_consistent'].item()}")
    
    import math
    if math.isnan(prediction) or math.isnan(reliability):
        print("\n❌ FAIL: NaN detected in outputs!")
        return False
    else:
        print("\n✓ SUCCESS: No NaN in outputs!")
        return True

if __name__ == "__main__":
    test_inference_logic()
