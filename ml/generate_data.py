import pandas as pd
import numpy as np
import json
import os
from datetime import datetime, timedelta

# ==================== CONFIGURATION ====================
NUM_COMPANIES = 10  # Top tech companies for realistic demo
NUM_TIMESTEPS = 50  # ~2 months of data (enough to show patterns)
START_DATE = "2023-11-01"

# Company sectors
SECTORS = ["Technology", "Finance", "Healthcare", "Consumer", "Energy", "Industrials"]

# Generate realistic ticker symbols
def generate_tickers(n):
    """Generate realistic stock tickers modeled after real companies"""
    # Realistic ticker patterns based on actual market tickers
    realistic_tickers = [
        # Tech companies style
        "NVDA", "AAPL", "MSFT", "GOOGL", "META", "AMZN", "TSLA", "NFLX", "ADBE", "INTC",
        "AMD", "QCOM", "CSCO", "ORCL", "AVGO", "TXN", "INTU", "PYPL", "SHOP", "SQ",
        "SNAP", "UBER", "LYFT", "TWLO", "ZM", "CRWD", "SNOW", "DDOG", "NET", "PLTR",
        
        # Finance style
        "JPM", "BAC", "WFC", "GS", "MS", "C", "USB", "PNC", "TFC", "BK",
        "AXP", "SCHW", "BLK", "SPGI", "MCO", "ICE", "CME", "V", "MA", "COF",
        
        # Healthcare style  
        "JNJ", "UNH", "PFE", "ABBV", "TMO", "MRK", "ABT", "DHR", "LLY", "BMY",
        "AMGN", "GILD", "VRTX", "REGN", "BIIB", "ISRG", "SYK", "BSX", "EW", "IDXX",
        
        # Consumer style
        "WMT", "HD", "MCD", "NKE", "SBUX", "TGT", "LOW", "TJX", "COST", "DG",
        "KO", "PEP", "PG", "UL", "CL", "KMB", "GIS", "K", "CAG", "HSY",
        
        # Energy style
        "XOM", "CVX", "COP", "SLB", "EOG", "PXD", "MPC", "VLO", "PSX", "OXY",
        "HAL", "BKR", "DVN", "FANG", "MRO", "HES", "APA", "NOV", "HP", "CTRA",
        
        # Industrial style
        "BA", "CAT", "GE", "HON", "UPS", "RTX", "LMT", "DE", "MMM", "EMR",
        "ETN", "ITW", "PH", "CMI", "ROK", "DOV", "IRX", "XYL", "AME", "FTV"
    ]
    
    # If we need more than available, generate additional realistic-looking tickers
    if n > len(realistic_tickers):
        # Generate more using patterns from real tickers
        prefixes = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 
                   'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z']
        suffixes = ['X', 'N', 'T', 'S', 'R', 'M', 'D', 'L', 'C', 'P']
        
        while len(realistic_tickers) < n:
            # Generate 3-4 letter tickers
            if np.random.random() > 0.3:
                ticker = np.random.choice(prefixes) + \
                        np.random.choice(list('ABCDEFGHILMNOPRSTUVWY')) + \
                        np.random.choice(list('ABCDGLMNPRSTXYZ'))
            else:
                ticker = np.random.choice(prefixes) + \
                        np.random.choice(list('ABCDEFGHILMNOPRSTUVWY')) + \
                        np.random.choice(list('ABCDGLMNPRSTXYZ')) + \
                        np.random.choice(suffixes)
            
            if ticker not in realistic_tickers:
                realistic_tickers.append(ticker)
    
    return realistic_tickers[:n]

# ==================== TECHNICAL INDICATORS ====================

def calculate_sma(prices, window):
    """Simple Moving Average"""
    return pd.Series(prices).rolling(window=window, min_periods=1).mean().values

def calculate_ema(prices, window):
    """Exponential Moving Average"""
    return pd.Series(prices).ewm(span=window, adjust=False).mean().values

def calculate_rsi(prices, window=14):
    """Relative Strength Index"""
    deltas = np.diff(prices, prepend=prices[0])
    gains = np.where(deltas > 0, deltas, 0)
    losses = np.where(deltas < 0, -deltas, 0)
    
    avg_gain = pd.Series(gains).rolling(window=window, min_periods=1).mean().values
    avg_loss = pd.Series(losses).rolling(window=window, min_periods=1).mean().values
    
    rs = avg_gain / (avg_loss + 1e-10)
    rsi = 100 - (100 / (1 + rs))
    return rsi

def calculate_macd(prices):
    """MACD (Moving Average Convergence Divergence)"""
    ema_12 = calculate_ema(prices, 12)
    ema_26 = calculate_ema(prices, 26)
    macd = ema_12 - ema_26
    signal = calculate_ema(macd, 9)
    return macd, signal

def calculate_bollinger_bands(prices, window=20):
    """Bollinger Bands"""
    sma = calculate_sma(prices, window)
    std = pd.Series(prices).rolling(window=window, min_periods=1).std().values
    upper = sma + (2 * std)
    lower = sma - (2 * std)
    return upper, lower, (upper - lower)

def calculate_atr(high, low, close, window=14):
    """Average True Range"""
    tr1 = high - low
    tr2 = np.abs(high - np.roll(close, 1))
    tr3 = np.abs(low - np.roll(close, 1))
    tr = np.maximum(tr1, np.maximum(tr2, tr3))
    atr = pd.Series(tr).rolling(window=window, min_periods=1).mean().values
    return atr

def calculate_obv(close, volume):
    """On-Balance Volume"""
    direction = np.sign(np.diff(close, prepend=close[0]))
    obv = np.cumsum(direction * volume)
    return obv

# ==================== PRICE GENERATION ====================

def generate_realistic_prices(num_steps, initial_price=100, ticker_id=0):
    """Generate realistic price series with trends, volatility clustering, and regimes"""
    np.random.seed(ticker_id)
    
    prices = [initial_price]
    volumes = []
    highs = []
    lows = []
    
    # Market regime parameters
    regime_length = num_steps // 5  # Change regime every ~200 days
    regimes = np.random.choice(['bull', 'bear', 'sideways'], size=5)
    
    base_volatility = 0.02
    
    for i in range(num_steps):
        # Determine current regime
        regime_idx = min(i // regime_length, 4)
        regime = regimes[regime_idx]
        
        # Regime-based drift
        if regime == 'bull':
            drift = 0.0008
            volatility = base_volatility * 0.8
        elif regime == 'bear':
            drift = -0.0005
            volatility = base_volatility * 1.3
        else:  # sideways
            drift = 0.0001
            volatility = base_volatility * 0.9
        
        # Add some autocorrelation and volatility clustering
        if i > 0:
            prev_return = (prices[-1] - prices[-2]) / prices[-2] if i > 1 else 0
            drift += 0.1 * prev_return  # Momentum
        
        # GARCH-like volatility
        if i > 5:
            recent_returns = [(prices[j] - prices[j-1])/prices[j-1] for j in range(max(1, i-5), i)]
            recent_vol = np.std(recent_returns)
            volatility = 0.7 * volatility + 0.3 * recent_vol
        
        # Generate return
        daily_return = np.random.normal(drift, volatility)
        new_price = prices[-1] * (1 + daily_return)
        
        # Generate OHLC
        intraday_vol = volatility * 0.5
        high = new_price * (1 + abs(np.random.normal(0, intraday_vol)))
        low = new_price * (1 - abs(np.random.normal(0, intraday_vol)))
        
        # Generate volume (correlated with volatility and price changes)
        base_volume = 1000000
        volume_factor = 1 + abs(daily_return) * 10 + np.random.normal(0, 0.3)
        volume = int(base_volume * max(0.3, volume_factor))
        
        prices.append(new_price)
        highs.append(high)
        lows.append(low)
        volumes.append(volume)
    
    return np.array(prices[1:]), np.array(highs), np.array(lows), np.array(volumes)

# ==================== NARRATIVE GENERATION ====================

def generate_narrative(ticker, sentiment, price_trend, sector, events):
    """Generate realistic financial narratives"""
    
    sentiment_phrases = {
        'positive': [
            f"{ticker} demonstrates strong fundamentals with robust revenue growth",
            f"Analysts upgrade {ticker} citing improving market conditions",
            f"{ticker} beats earnings expectations, raising guidance for next quarter",
            f"Strong demand in {sector} sector benefits {ticker}",
            f"{ticker} announces strategic partnership, expanding market reach"
        ],
        'negative': [
            f"{ticker} faces headwinds amid challenging market conditions",
            f"Analysts downgrade {ticker} on concerns about slowing growth",
            f"{ticker} misses earnings, cites supply chain disruptions",
            f"Regulatory concerns weigh on {ticker} stock performance",
            f"{ticker} announces restructuring plan amid declining margins"
        ],
        'neutral': [
            f"{ticker} trading in line with sector averages",
            f"Mixed signals for {ticker} as market awaits earnings report",
            f"{ticker} maintains steady performance despite market volatility",
            f"Analysts hold neutral stance on {ticker} ahead of product launch",
            f"{ticker} consolidates recent gains, awaiting catalyst"
        ]
    }
    
    base_narrative = np.random.choice(sentiment_phrases[sentiment])
    
    # Add event-based context
    if events.get('earnings_beat', False):
        base_narrative += ". Strong quarterly results exceeded analyst estimates."
    elif events.get('earnings_miss', False):
        base_narrative += ". Quarterly results fell short of expectations."
    
    if events.get('product_launch', False):
        base_narrative += f" New product launch expected to drive growth in {sector} segment."
    
    return base_narrative

# ==================== MAIN DATA GENERATION ====================

def generate_enhanced_dataset():
    """Generate comprehensive synthetic financial dataset"""
    
    print("Generating enhanced financial dataset...")
    print(f"Companies: {NUM_COMPANIES}, Timesteps: {NUM_TIMESTEPS}")
    
    # Generate tickers
    tickers = generate_tickers(NUM_COMPANIES)
    
    # Generate dates
    start = datetime.strptime(START_DATE, "%Y-%m-%d")
    dates = [(start + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(NUM_TIMESTEPS)]
    
    all_rows = []
    narratives_data = []
    
    for idx, ticker in enumerate(tickers):
        print(f"Processing {ticker} ({idx+1}/{NUM_COMPANIES})...")
        
        # Assign sector
        sector = np.random.choice(SECTORS)
        sector_id = SECTORS.index(sector)
        
        # Generate price data
        initial_price = np.random.uniform(50, 500)
        prices, highs, lows, volumes = generate_realistic_prices(NUM_TIMESTEPS, initial_price, idx)
        
        # Calculate technical indicators
        sma_20 = calculate_sma(prices, 20)
        sma_50 = calculate_sma(prices, 50)
        ema_12 = calculate_ema(prices, 12)
        rsi = calculate_rsi(prices, 14)
        macd, macd_signal = calculate_macd(prices)
        bb_upper, bb_lower, bb_width = calculate_bollinger_bands(prices, 20)
        atr = calculate_atr(highs, lows, prices, 14)
        obv = calculate_obv(prices, volumes)
        
        # Generate fundamental features
        base_pe = np.random.uniform(10, 40)
        base_debt_ratio = np.random.uniform(0.1, 0.8)
        base_profit_margin = np.random.uniform(0.05, 0.30)
        market_cap_category = np.random.choice([0, 1, 2])  # 0: small, 1: mid, 2: large
        
        # Calculate returns for targets
        returns_1d = np.diff(prices) / prices[:-1]
        returns_1d = np.concatenate([[0], returns_1d])
        
        # Forward returns (target)
        returns_5d_forward = np.concatenate([
            (prices[5:] - prices[:-5]) / prices[:-5],
            [0, 0, 0, 0, 0]  # Pad last 5 days
        ])
        
        # Volatility (target)
        volatility_5d = pd.Series(returns_1d).rolling(5, min_periods=1).std().values
        
        # Trend classification (target)
        trend_labels = np.zeros(NUM_TIMESTEPS, dtype=int)
        for i in range(NUM_TIMESTEPS):
            if i >= 5:
                future_return = returns_5d_forward[i]
                if future_return > 0.05:
                    trend_labels[i] = 4  # Strong Buy
                elif future_return > 0.02:
                    trend_labels[i] = 3  # Buy
                elif future_return > -0.02:
                    trend_labels[i] = 2  # Hold
                elif future_return > -0.05:
                    trend_labels[i] = 1  # Sell
                else:
                    trend_labels[i] = 0  # Strong Sell
        
        for day_idx in range(NUM_TIMESTEPS):
            # Add some variation to fundamentals over time
            pe_ratio = base_pe * (1 + np.random.normal(0, 0.1))
            debt_ratio = np.clip(base_debt_ratio + np.random.normal(0, 0.05), 0, 1)
            profit_margin = np.clip(base_profit_margin + np.random.normal(0, 0.02), 0, 1)
            revenue_growth = np.random.normal(0.05, 0.15)
            
            row = {
                "ticker": ticker,
                "date": dates[day_idx],
                "price": round(prices[day_idx], 2),
                "high": round(highs[day_idx], 2),
                "low": round(lows[day_idx], 2),
                "volume": int(volumes[day_idx]),
                
                # Technical indicators
                "sma_20": round(sma_20[day_idx], 2),
                "sma_50": round(sma_50[day_idx], 2),
                "ema_12": round(ema_12[day_idx], 2),
                "rsi": round(rsi[day_idx], 2),
                "macd": round(macd[day_idx], 4),
                "macd_signal": round(macd_signal[day_idx], 4),
                "bb_upper": round(bb_upper[day_idx], 2),
                "bb_lower": round(bb_lower[day_idx], 2),
                "bb_width": round(bb_width[day_idx], 2),
                "atr": round(atr[day_idx], 2),
                "obv": int(obv[day_idx]),
                
                # Fundamental features
                "pe_ratio": round(pe_ratio, 2),
                "debt_ratio": round(debt_ratio, 2),
                "profit_margin": round(profit_margin, 4),
                "revenue_growth": round(revenue_growth, 4),
                "market_cap_category": market_cap_category,
                "sector_id": sector_id,
                
                # Targets
                "return_1d": round(returns_1d[day_idx], 6),
                "return_5d_forward": round(returns_5d_forward[day_idx], 6),
                "volatility_5d": round(volatility_5d[day_idx], 6),
                "trend_label": int(trend_labels[day_idx])
            }
            
            all_rows.append(row)
        
        # Generate narrative for this ticker
        final_return = (prices[-1] - prices[0]) / prices[0]
        sentiment = 'positive' if final_return > 0.1 else ('negative' if final_return < -0.1 else 'neutral')
        
        # Determine alignment (80% consistent)
        is_aligned = np.random.random() > 0.2
        if not is_aligned:
            sentiment = 'positive' if sentiment == 'negative' else 'negative'
        
        events = {
            'earnings_beat': np.random.random() > 0.7,
            'earnings_miss': np.random.random() > 0.8,
            'product_launch': np.random.random() > 0.85
        }
        
        narrative = generate_narrative(ticker, sentiment, final_return, sector, events)
        
        narratives_data.append({
            "ticker": ticker,
            "sector": sector,
            "transcript": narrative,
            "sentiment": sentiment,
            "alignment_flag": is_aligned,
            "final_return": round(final_return, 4)
        })
    
    # Save market data
    market_df = pd.DataFrame(all_rows)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    market_csv_path = os.path.join(script_dir, "market_data.csv")
    market_df.to_csv(market_csv_path, index=False)
    print(f"\n[OK] Saved market data: {len(all_rows)} rows to {market_csv_path}")
    
    # Save narratives
    narratives_path = os.path.join(script_dir, "narratives.json")
    with open(narratives_path, "w") as f:
        json.dump(narratives_data, f, indent=2)
    print(f"[OK] Saved narratives: {len(narratives_data)} entries to {narratives_path}")
    
    # Print statistics
    print("\n" + "="*60)
    print("DATASET STATISTICS")
    print("="*60)
    print(f"Total samples: {len(all_rows):,}")
    print(f"Companies: {NUM_COMPANIES}")
    print(f"Days per company: {NUM_TIMESTEPS}")
    print(f"Features: {len(all_rows[0]) - 4}")  # Exclude ticker, date, and targets
    print(f"\nPrice range: ${market_df['price'].min():.2f} - ${market_df['price'].max():.2f}")
    print(f"Average RSI: {market_df['rsi'].mean():.2f}")
    print(f"Average volatility: {market_df['volatility_5d'].mean():.4f}")
    print(f"\nTrend distribution:")
    for label, name in enumerate(['Strong Sell', 'Sell', 'Hold', 'Buy', 'Strong Buy']):
        count = (market_df['trend_label'] == label).sum()
        pct = (count / len(market_df)) * 100
        print(f"  {name}: {count:,} ({pct:.1f}%)")
    print("="*60)

if __name__ == "__main__":
    generate_enhanced_dataset()
