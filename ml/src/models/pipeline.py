import torch
import torch.nn as nn
import torch.nn.functional as F
import pytorch_lightning as L
import numpy as np
import ruptures as rpt
from src.models.encoders import TemporalEncoder, TabularEncoder, TextEncoder
from src.utils.loss import ConsistencyLoss, calculate_reliability_score

class FinancialIntelligencePipeline(L.LightningModule):
    def __init__(self, 
                 temporal_dim, 
                 tabular_dim, 
                 latent_dim=128, 
                 lr=1e-4, 
                 lambda_consis=0.5,
                 drift_threshold=10.0):
        super().__init__()
        self.save_hyperparameters()
        
        # Encoders
        self.temporal_encoder = TemporalEncoder(input_dim=temporal_dim, d_model=latent_dim)
        self.tabular_encoder = TabularEncoder(input_dim=tabular_dim, latent_dim=latent_dim)
        self.text_encoder = TextEncoder(latent_dim=latent_dim)
        
        # Projection for Numeric Combination
        self.numeric_projection = nn.Linear(latent_dim * 2, latent_dim)
        
        # Prediction Head
        self.predictor = nn.Sequential(
            nn.Linear(latent_dim * 2, 64),
            nn.ReLU(),
            nn.Linear(64, 1) # Single value output (e.g. price change)
        )
        
        self.criterion = ConsistencyLoss(lambda_consis=lambda_consis)
        self.drift_monitoring_buffer = []

    def forward(self, batch):
        # 1. Encode modalities
        z_temporal = self.temporal_encoder(batch["temporal"])
        z_tabular = self.tabular_encoder(batch["tabular"])
        z_text = self.text_encoder(batch["text_input_ids"], batch["text_attn_mask"])
        
        # 2. Shared Latent Space Alignment
        z_numeric = self.numeric_projection(torch.cat([z_temporal, z_tabular], dim=-1))
        
        # 3. Decision Making
        # Combine Text and Numeric for final prediction
        z_combined = torch.cat([z_numeric, z_text], dim=-1)
        prediction = self.predictor(z_combined)
        
        # 4. Reliability Scoring
        reliability_score = calculate_reliability_score(z_text, z_numeric)
        
        # 5. Consistency check
        is_consistent = reliability_score > 0.7 # Example threshold
        
        return {
            "prediction": prediction,
            "reliability_score": reliability_score,
            "regime_id": len(self.drift_monitoring_buffer), # Simplified regime tracking
            "is_consistent": is_consistent,
            "z_shared": z_numeric
        }

    def training_step(self, batch, batch_idx):
        z_temporal = self.temporal_encoder(batch["temporal"])
        z_tabular = self.tabular_encoder(batch["tabular"])
        z_text = self.text_encoder(batch["text_input_ids"], batch["text_attn_mask"])
        
        z_numeric = self.numeric_projection(torch.cat([z_temporal, z_tabular], dim=-1))
        z_combined = torch.cat([z_numeric, z_text], dim=-1)
        prediction = self.predictor(z_combined).squeeze()
        
        # Use return prediction as primary task
        total_loss, task_loss, consis_loss = self.criterion(
            z_text, z_numeric, prediction, batch["target_return"]
        )
        
        self.log("train/total_loss", total_loss)
        self.log("train/task_loss", task_loss)
        self.log("train/consis_loss", consis_loss)
        self.log("train/mean_prediction", prediction.mean())
        
        return total_loss

    def validation_step(self, batch, batch_idx):
        outputs = self.forward(batch)
        
        val_loss = F.mse_loss(outputs["prediction"].squeeze(), batch["target_return"])
        self.log("val/loss", val_loss)
        self.log("val/reliability", outputs["reliability_score"].mean())
        self.log("val/mean_prediction", outputs["prediction"].mean())
        
        # Collect embeddings for drift detection
        self.drift_monitoring_buffer.append(outputs["z_shared"].detach().cpu().numpy())
        
        return val_loss

    def on_validation_epoch_end(self):
        if len(self.drift_monitoring_buffer) > 0:
            # Flatten buffer
            all_embeddings = np.concatenate(self.drift_monitoring_buffer, axis=0)
            
            # Regime Tracking (Change-Point Detection)
            # Use average embedding over time as the signal
            signal = np.mean(all_embeddings, axis=1)
            
            try:
                algo = rpt.Pelt(model="rbf").fit(signal)
                result = algo.predict(pen=10)
                
                # If result has more than one entry (the end point), a drift was detected
                is_drifted = len(result) > 1
                self.log("val/is_drifted", float(is_drifted))
                self.log("val/regime_count", len(result))
            except Exception as e:
                print(f"Drift detection failed: {e}")
            
            self.drift_monitoring_buffer = []

    def configure_optimizers(self):
        return torch.optim.Adam(self.parameters(), lr=self.hparams.lr)
