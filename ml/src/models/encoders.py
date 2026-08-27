import torch
import torch.nn as nn
from transformers import AutoModel, AutoConfig

class TemporalEncoder(nn.Module):
    """Transformer-based encoder for sequence data (Price, Volume, RSI)."""
    def __init__(self, input_dim, d_model=128, nhead=8, num_layers=3):
        super().__init__()
        self.embedding = nn.Linear(input_dim, d_model)
        encoder_layer = nn.TransformerEncoderLayer(d_model=d_model, nhead=nhead, batch_first=True)
        self.transformer = nn.TransformerEncoder(encoder_layer, num_layers=num_layers)
        self.pool = nn.AdaptiveAvgPool1d(1)

    def forward(self, x):
        # x shape: (batch, seq_len, input_dim)
        x = self.embedding(x)
        x = self.transformer(x)
        x = x.transpose(1, 2)
        x = self.pool(x).squeeze(-1)
        return x

class TabularEncoder(nn.Module):
    """MLP-based encoder for structured financial features."""
    def __init__(self, input_dim, hidden_dim=256, latent_dim=128):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.BatchNorm1d(hidden_dim),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(hidden_dim, latent_dim)
        )

    def forward(self, x):
        return self.net(x)

class TextEncoder(nn.Module):
    """FinBERT-based encoder for news headlines and reports."""
    def __init__(self, model_name='ProsusAI/finbert', latent_dim=128, freeze=True):
        super().__init__()
        try:
            self.bert = AutoModel.from_pretrained(model_name, low_cpu_mem_usage=True)
        except Exception:
            # Fallback if low_cpu_mem_usage fails
            self.bert = AutoModel.from_pretrained(model_name)
        
        if freeze:
            for param in self.bert.parameters():
                param.requires_grad = False
            
            # Dynamic INT8 quantization: reduces model RAM from ~440MB to ~110MB on CPU
            try:
                self.bert = torch.quantization.quantize_dynamic(
                    self.bert, {nn.Linear}, dtype=torch.qint8
                )
                print("INFO: FinBERT successfully quantized to INT8 (reduced RAM by ~75%).", flush=True)
            except Exception as q_err:
                print(f"WARNING: Quantization skipped: {q_err}", flush=True)
                
        self.projection = nn.Linear(self.bert.config.hidden_size, latent_dim)

    def forward(self, input_ids, attention_mask):
        outputs = self.bert(input_ids=input_ids, attention_mask=attention_mask)
        # Use [CLS] token representation
        cls_emb = outputs.last_hidden_state[:, 0, :]
        return self.projection(cls_emb)
