import torch
import os

checkpoints = [
    "ml/mlruns/717114918474650167/b4d25f1e85c443a2bb50e1d67e6c82c5/checkpoints/epoch=0-step=62.ckpt",
    "ml/mlruns/717114918474650167/c0d880b61278477e8a7d2a11af035c94/checkpoints/epoch=0-step=62.ckpt",
    "ml/mlruns/717114918474650167/72589d9840d94a769fe7a5374cdbd26a/checkpoints/epoch=1-step=12.ckpt",
    "ml/mlruns/717114918474650167/f4703e6ab7fd439799bf844b09d783dc/checkpoints/epoch=1-step=12.ckpt",
]

for ckpt_path in checkpoints:
    if os.path.exists(ckpt_path):
        ckpt = torch.load(ckpt_path, map_location='cpu')
        nan_count = sum(1 for k, v in ckpt['state_dict'].items() if torch.isnan(v).any())
        total = len(ckpt['state_dict'])
        print(f"{os.path.basename(os.path.dirname(os.path.dirname(ckpt_path)))[:8]}: NaN={nan_count}/{total}")
    else:
        print(f"NOT FOUND: {ckpt_path}")
