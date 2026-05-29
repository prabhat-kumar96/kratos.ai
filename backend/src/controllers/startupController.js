import { Transaction } from "../models/transaction.model.js";
import { User } from "../models/user.model.js";
import { Intelligence } from "../models/intelligence.model.js";

// Helper to calculate estimated price based on demand
import axios from 'axios';

const calculateEstimatedPrice = async (ticker) => {
    // 1. Check if it's a real-world ticker (e.g. AAPL, TSLA)
    // We can check against the Intelligence Service or Ticker List
    try {
        // Try fetching from our own Intelligence API (which caches from Python ML service)
        // Since we are inside the backend, we can't easily call our own API via HTTP without issues if port changes.
        // Better: Query the Intelligence Model directly or call the Python Service directly.
        // Let's call Python Service directly like intelligenceController does.

        const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || "http://localhost:8001";

        // Quick check: Is it in the "known" list?
        // Let's try to fetch prediction/price for this ticker. 
        // If it returns valid data, use the last historical price or base price.
        const response = await axios.get(`${pythonServiceUrl}/predict/${ticker}`);

        if (response.data && response.data.history && response.data.history.length > 0) {
            const latest = response.data.history[response.data.history.length - 1];
            return latest.price;
        }
    } catch (error) {
        // If error (404 etc), it means it could be a public stock but service is down, OR it's a real startup.
        console.error(`[StartupStats] Failed to fetch live price from ML service for ${ticker}:`, error.message);
    }

    // 2. FAILSAFE: If ML failed, check if it's a known public ticker before using startup logic
    const MAJOR_TICKERS = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "AMD", "NFLX"];
    if (MAJOR_TICKERS.includes(ticker)) {
        try {
            // Try DB Cache
            const cached = await Intelligence.findOne({ ticker: ticker });
            if (cached && cached.history && cached.history.length > 0) {
                console.log(`[StartupStats] Using cached DB price for ${ticker}`);
                return cached.history[cached.history.length - 1].price;
            }

            // Better fallback prices to avoid user confusion if live data fails
            const FALLBACK_PRICES = {
                "AAPL": 255.41,
                "MSFT": 415.32,
                "GOOGL": 173.50,
                "AMZN": 185.00,
                "NVDA": 120.50,
                "TSLA": 220.30,
                "META": 475.20,
                "AMD": 160.40,
                "NFLX": 650.00
            };
            return FALLBACK_PRICES[ticker] || 150.00;
        } catch (dbErr) {
            console.error("DB fallback failed", dbErr);
        }
    }

    // 3. Fallback: Synthetic Pricing for New Startups
    // Basic formula: Base $10 + ($0.10 * Net Holdings)
    const basePrice = 10.00;

    // Get all transactions for this ticker
    const transactions = await Transaction.find({ symbol: ticker.toUpperCase() });

    let netHoldings = 0;
    if (transactions.length > 0) {
        transactions.forEach(tx => {
            if (tx.side === 'BUY') netHoldings += tx.quantity;
            else if (tx.side === 'SELL') netHoldings -= tx.quantity;
        });
    }

    // Prevent negative price impact below base for now, or allow it? 
    // Let's keep it simple: price grows with demand.
    // Use Math.max to ensure it doesn't drop below $1.00
    const priceImpact = netHoldings * 0.10;
    return Math.max(1.00, basePrice + priceImpact);
};

export const getStartupStats = async (req, res) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId);

        if (!user || user.role !== "founder") {
            return res.status(403).json({ message: "Access denied. Founder role required." });
        }

        const companyTicker = user.companyName?.trim().toUpperCase();

        if (!companyTicker) {
            return res.status(400).json({ message: "Company ticker not found in user profile." });
        }

        // 1. Aggregate Transactions
        const transactions = await Transaction.find({ symbol: companyTicker }).sort({ timestamp: -1 });

        let totalSharesBought = 0;
        let totalSharesSold = 0;
        let totalTradingVolume = 0; // Total money exchanged
        let uniqueInvestors = new Set();
        let netHoldings = 0;

        transactions.forEach(tx => {
            if (tx.side === 'BUY') {
                totalSharesBought += tx.quantity;
            } else {
                totalSharesSold += tx.quantity;
            }
            totalTradingVolume += tx.total_amount;

            // Assume the portfolio belongs to a user, but we'd need to look up portfolio->user
            // For unique investor count, we can use portfolio ID as a proxy for "Investor Entity"
            uniqueInvestors.add(tx.portfolio.toString());
        });

        netHoldings = totalSharesBought - totalSharesSold;

        // 2. Get Reliability Score
        // Try getting real AI data if available, else default
        let reliabilityScore = 50; // Default Unknown
        let reliabilityLabel = "Unverified";

        try {
            const intelligence = await Intelligence.findOne({ ticker: companyTicker });

            // Hardcoded fail-safes for demo purposes (matching frontend mocks)
            const MOCK_SCORES = {
                "AAPL": 95, "NVDA": 92, "MSFT": 93, "GOOGL": 90, "GOOG": 90, "AMZN": 87, "AMD": 84, "NFLX": 81, "TSLA": 45, "META": 55
            };

            if (intelligence && intelligence.reliability_score > 0) {
                reliabilityScore = intelligence.reliability_score;
            } else if (MOCK_SCORES[companyTicker]) {
                // Determine if we should use mock score (if DB is missing or 0)
                console.log(`[StartupStats] Using Hardcoded Reliability for ${companyTicker}`);
                reliabilityScore = MOCK_SCORES[companyTicker];
            } else {
                // If it's a new startup with no data yet
                // Maybe calculate a "Base Score" based on netHoldings?
                const demandBoost = Math.min(Math.floor(netHoldings / 100), 40); // Max 40 bonus points
                reliabilityScore = 50 + demandBoost;
            }

            // Simple label mapping
            if (reliabilityScore >= 80) reliabilityLabel = "High Trust";
            else if (reliabilityScore >= 50) reliabilityLabel = "Moderate";
            else reliabilityLabel = "Low Trust";

        } catch (e) {
            console.log("Error fetching intelligence for startup stats:", e);
        }

        // 3. Current Dynamic Price
        const currentPrice = await calculateEstimatedPrice(companyTicker);

        // 4. Recent Activity (Anonymized)
        const recentActivity = transactions.slice(0, 5).map(tx => ({
            action: tx.side,
            quantity: tx.quantity,
            price: tx.execution_price,
            time: tx.timestamp,
            // "An investor"
            actor: "An Investor"
        }));

        res.status(200).json({
            success: true,
            ticker: companyTicker,
            stats: {
                net_holdings: netHoldings,
                total_volume: parseFloat(totalTradingVolume.toFixed(2)),
                investor_count: uniqueInvestors.size,
                current_price: parseFloat(currentPrice.toFixed(2)),
                market_cap: parseFloat((currentPrice * netHoldings).toFixed(2)) // Approximate "Public Float Market Cap"
            },
            reliability: {
                score: Math.min(reliabilityScore, 100),
                label: reliabilityLabel
            },
            recent_activity: recentActivity
        });

    } catch (error) {
        console.error("Error fetching startup stats:", error);
        res.status(500).json({ message: "Failed to fetch startup stats", error: error.message });
    }
};
