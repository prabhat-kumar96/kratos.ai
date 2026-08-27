# ===================================================
# Kratos.ai - Lightweight Financial Intelligence Engine
# ===================================================
# Replaces PyTorch/FinBERT inference for low-memory deployment.
# Uses technical-indicator heuristics and text sentiment alignment
# to produce the same output schema as the full ML pipeline.
# RAM footprint: ~5-15 MB (vs ~700MB for PyTorch + FinBERT).

import numpy as np
import pandas as pd
import math
from typing import Dict, Any, Optional, List


# ---------------------------------------------------------------------------
# Regime Detection
# ---------------------------------------------------------------------------
def _detect_regime(rsi: float, macd: float, atr_pct: float) -> tuple[str, int]:
    """
    Classify current market regime from technical indicators.
    Returns (label, id) where id is 0=Stable Growth, 1=Volatile, 2=Crisis.
    """
    if atr_pct > 0.04:          # High volatility (ATR > 4% of price)
        if rsi < 35:
            return "Crisis", 2
        return "Volatile", 1
    if rsi > 60 and macd > 0:
        return "Stable Growth", 0
    if rsi < 40 or macd < 0:
        return "Volatile", 1
    return "Stable Growth", 0


# ---------------------------------------------------------------------------
# Reliability Scoring
# ---------------------------------------------------------------------------
def _compute_reliability(
    rsi: float,
    macd: float,
    macd_signal: float,
    atr_pct: float,
    sentiment: Optional[float],
    alignment_flag: Optional[bool],
    trend_label: Optional[int],
    prediction: float,
) -> tuple[float, bool]:
    """
    Compute a reliability score (0-100) and an is_consistent flag.

    Logic:
    - Base score from RSI stability (mid-range RSI = more reliable)
    - Bonus for MACD/signal alignment
    - Penalty for high ATR (uncertainty)
    - Bonus/penalty from narrative sentiment alignment
    """
    score = 50.0  # baseline

    # RSI: most reliable 40–65 range
    rsi_score = max(0.0, 30.0 - abs(rsi - 52.5) * 0.8)
    score += rsi_score

    # MACD momentum alignment (MACD > signal = bullish confirmation)
    if macd_signal is not None:
        macd_diff = macd - macd_signal
        score += min(10.0, max(-10.0, macd_diff * 20))

    # ATR penalty: high uncertainty → lower reliability
    atr_penalty = min(20.0, atr_pct * 200)
    score -= atr_penalty

    # Narrative alignment bonus
    if alignment_flag is True:
        score += 8.0
    elif alignment_flag is False:
        score -= 10.0

    # Sentiment-prediction direction agreement
    if sentiment is not None and not math.isnan(sentiment):
        if (sentiment > 0.5 and prediction > 0) or (sentiment < 0.5 and prediction < 0):
            score += 7.0
        elif (sentiment > 0.5 and prediction < 0) or (sentiment < 0.5 and prediction > 0):
            score -= 7.0

    score = max(10.0, min(95.0, score))
    is_consistent = score >= 60.0
    return round(score, 2), is_consistent


# ---------------------------------------------------------------------------
# Prediction (Return Estimate)
# ---------------------------------------------------------------------------
def _compute_prediction(recent_df: pd.DataFrame) -> float:
    """
    Estimate 5-day forward return from RSI momentum and MACD crossover.
    Output is a small float in the range roughly [-0.05, 0.05].
    """
    if recent_df.empty:
        return 0.0

    last = recent_df.iloc[-1]

    # RSI-based momentum signal
    rsi = float(last.get("rsi", 50))
    rsi_signal = (rsi - 50) / 200.0  # maps 30->-0.1, 50->0, 70->+0.1

    # MACD direction
    macd = float(last.get("macd", 0))
    macd_signal_val = float(last.get("macd_signal", 0))
    macd_dir = 0.01 if macd > macd_signal_val else -0.01

    # Simple price momentum (last 5 rows)
    if len(recent_df) >= 5:
        close_vals = recent_df["close"].values.astype(float)
        momentum = (close_vals[-1] - close_vals[-5]) / (close_vals[-5] + 1e-9)
        momentum = max(-0.05, min(0.05, momentum))
    else:
        momentum = 0.0

    prediction = (rsi_signal * 0.4) + (macd_dir * 0.3) + (momentum * 0.3)
    return round(float(prediction), 4)


# ---------------------------------------------------------------------------
# Public Interface
# ---------------------------------------------------------------------------
def run_lightweight_inference(
    ticker: str,
    ticker_df: pd.DataFrame,
    narrative_info: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Run lightweight inference on a ticker.

    Args:
        ticker: Uppercase ticker symbol.
        ticker_df: DataFrame rows for this ticker (all historical rows).
        narrative_info: Dict with keys: transcript, sentiment, alignment_flag.

    Returns:
        Dict matching the /predict/{ticker} response schema.
    """
    if ticker_df.empty:
        return _empty_response(ticker)

    # Ensure lowercase columns
    ticker_df = ticker_df.copy()
    ticker_df.columns = [c.lower() for c in ticker_df.columns]

    recent = ticker_df.tail(30)
    last_row = ticker_df.iloc[-1]

    # --- Gather indicators ---
    rsi = float(last_row.get("rsi", 50))
    macd = float(last_row.get("macd", 0))
    macd_signal_val = float(last_row.get("macd_signal", macd))
    close = float(last_row.get("close", 1))
    atr = float(last_row.get("atr", 0))
    atr_pct = atr / (close + 1e-9)

    sentiment = narrative_info.get("sentiment", None)
    alignment_flag = narrative_info.get("alignment_flag", None)
    transcript = narrative_info.get("transcript", "")

    trend_label = None
    if "trend_label" in ticker_df.columns:
        trend_label = int(last_row.get("trend_label", 0))

    # --- Compute signals ---
    prediction = _compute_prediction(recent)
    regime_label, regime_id = _detect_regime(rsi, macd, atr_pct)
    reliability_score, is_consistent = _compute_reliability(
        rsi, macd, macd_signal_val, atr_pct,
        sentiment, alignment_flag, trend_label, prediction
    )

    # --- Build history (last 30 data points) ---
    history_df = recent.copy()
    if "date" in history_df.columns and "close" in history_df.columns:
        history_df = history_df[["date", "close"]].copy()
        history_df["date"] = history_df["date"].astype(str)
        history_df.rename(columns={"close": "price"}, inplace=True)
        history = history_df.to_dict(orient="records")
    else:
        history = []

    # Truncate narrative for summary (max 400 chars)
    narrative_summary = str(transcript)[:400].strip() if transcript else ""

    return {
        "reliability_score": reliability_score,
        "regime": regime_label,
        "regime_id": regime_id,
        "prediction": prediction,
        "history": history,
        "narrative_summary": narrative_summary,
        "is_consistent": is_consistent,
    }


def _empty_response(ticker: str) -> Dict[str, Any]:
    return {
        "reliability_score": 0.0,
        "regime": "Volatile",
        "regime_id": 1,
        "prediction": 0.0,
        "history": [],
        "narrative_summary": f"Insufficient data for {ticker}.",
        "is_consistent": False,
    }
