import torch
import pytorch_lightning as L
from pytorch_lightning.loggers import MLFlowLogger
import os
import pandas as pd
from src.models.pipeline import FinancialIntelligencePipeline
from src.data.datamodule import FinancialDataModule

def train():
    # 1. Paths to synthetic data - support running from both project root and ML directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(script_dir, "market_data.csv")
    json_path = os.path.join(script_dir, "narratives.json")
    
    if not os.path.exists(csv_path) or not os.path.exists(json_path):
        print(f"Data files not found at {csv_path}")
        print("Please run: python generate_data.py")
        return

    # 2. Setup DataModule
    dm = FinancialDataModule(csv_path, json_path, window_size=5, batch_size=128, num_workers=4, persistent_workers=True)
    
    # 3. Determine dimensions from data
    df = pd.read_csv(csv_path)
    temporal_features = ['close', 'high', 'low', 'volume', 'rsi', 'macd', 'atr', 'ema_20']
    exclude = temporal_features + ['ticker', 'date', 'return_5d_forward', 'return_20d_forward', 'volatility_5d', 'trend_label', 'bb_middle']
    tabular_features = [col for col in df.columns if col not in exclude]
    
    temporal_dim = len(temporal_features)
    tabular_dim = len(tabular_features)
    print(f"Training with dimensions: temporal={temporal_dim}, tabular={tabular_dim}")

    # 4. Setup Model
    model = FinancialIntelligencePipeline(
        temporal_dim=temporal_dim,
        tabular_dim=tabular_dim,
        latent_dim=128,
        lr=1e-4
    )
    
    # 5. Setup Logger
    mlf_logger = MLFlowLogger(experiment_name="Kratos_Enhanced_Pipeline_Aggressive")
    
    # 6. Trainer with extreme optimizations
    trainer = L.Trainer(
        max_epochs=1, 
        logger=mlf_logger,
        accelerator="auto",
        devices=1,
        default_root_dir="ml/checkpoints",
        log_every_n_steps=1,
        gradient_clip_val=1.0, 
        gradient_clip_algorithm="norm",
        detect_anomaly=False
    )

    
    # 7. Execute
    trainer.fit(model, datamodule=dm)

if __name__ == "__main__":
    train()
