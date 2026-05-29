import axios from "axios";
import { Intelligence } from "../models/intelligence.model.js";
import { User } from "../models/user.model.js";
import { Transaction } from "../models/transaction.model.js";

// --- Helper function to generate mock historical price data ---
const generateMockHistory = (ticker, prediction) => {
    const today = new Date();
    const history = [];
    // Base prices for known tickers, else default to 100
    const basePrice = {
        "NVDA": 480, "AMD": 180, "AAPL": 185, "TSLA": 240,
        "MSFT": 420, "GOOGL": 165, "AMZN": 175, "META": 485, "NFLX": 630
    }[ticker] || 100;

    // Use prediction to bias the random walk, but ensure noise
    // Standard deviation ~2% of price
    const volatility = basePrice * 0.02;
    // Bias is small daily drift based on prediction (-1 to 1 range mapped to slight movement)
    const bias = (prediction || 0) * (basePrice * 0.005);

    let currentPrice = basePrice;

    // Generate 30 days of data
    for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        // Random walk: previous + bias + noise
        const noise = (Math.random() - 0.5) * volatility * 2;
        currentPrice += bias + noise;

        // Ensure price doesn't go negative or too unrealistic
        if (currentPrice < 1) currentPrice = 1;

        history.push({
            date: date.toISOString().split('T')[0],
            price: parseFloat(currentPrice.toFixed(2))
        });
    }
    return history;
};

// Helper: Check if history is "flat" (all prices are the same)
const isHistoryFlat = (history) => {
    if (!history || history.length < 2) return true;
    const firstPrice = history[0].price;
    // Returns true if EVERY price is identical to the first one
    return history.every(pt => Math.abs(pt.price - firstPrice) < 0.01);
};

// --- Mock Data for Reliability Fallback (Requested by User) ---
const MOCK_INTELLIGENCE_DATA = {
    "NVDA": { reliability_score: 88, regime: "Stable Growth", prediction: 0.0045, narrative_summary: "Strong AI demand continues to drive growth.", is_consistent: true },
    "AMD": { reliability_score: 82, regime: "Volatile", prediction: 0.0021, narrative_summary: "Competitive pressure in GPU market, but server growth strong.", is_consistent: true },
    "AAPL": { reliability_score: 94, regime: "Stable Growth", prediction: 0.0012, narrative_summary: "Consistent services revenue offsetting hardware cyclicality.", is_consistent: true },
    "TSLA": { reliability_score: 65, regime: "Volatile", prediction: -0.0015, narrative_summary: "Margins under pressure; autonomous driving timelines uncertain.", is_consistent: false },
    "MSFT": { reliability_score: 91, regime: "Stable Growth", prediction: 0.0032, narrative_summary: "Cloud dominance remains key growth driver.", is_consistent: true },
    "GOOGL": { reliability_score: 89, regime: "Stable Growth", prediction: 0.0028, narrative_summary: "Advertising recovery and AI integration positive.", is_consistent: true },
    "AMZN": { reliability_score: 85, regime: "Stable Growth", prediction: 0.0035, narrative_summary: "AWS and logistics efficiency improving.", is_consistent: true },
    "META": { reliability_score: 78, regime: "Volatile", prediction: 0.0042, narrative_summary: "Ad spend rebounding, but metaverse spending technically risky.", is_consistent: true },
    "NFLX": { reliability_score: 80, regime: "Stable Growth", prediction: 0.0018, narrative_summary: "Subscriber growth re-accelerating from password sharing crackdown.", is_consistent: true }
};

export const getIntelligence = async (req, res) => {
    const { ticker } = req.params;

    if (!ticker) {
        return res.status(400).json({ message: "Ticker is required" });
    }

    const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || "http://localhost:8001";

    // Helper for simple retries - Increased to 30 retries (60s)
    const fetchWithRetry = async (url, retries = 30, delay = 2000) => {
        for (let i = 0; i < retries; i++) {
            try {
                return await axios.get(url);
            } catch (error) {
                if (i === retries - 1) throw error;
                // Retry only on connection refused, 503, or 500 (Internal Server Error)
                if (error.code === 'ECONNREFUSED' || (error.response && (error.response.status === 503 || error.response.status === 500))) {
                    console.log(`Connection to ML Service failed. Retrying in ${delay}ms... (${i + 1}/${retries})`);
                    await new Promise(res => setTimeout(res, delay));
                } else {
                    throw error;
                }
            }
        }
    };

    try {
        // 1. Try fetching from ML Service using retry
        const response = await fetchWithRetry(`${pythonServiceUrl}/predict/${ticker}`);
        const mlData = response.data;

        // Check if ML service is in training mode
        // Check if ML service is in training mode
        if (mlData.status === "training") {
            console.log(`ML Service is training. Attempting to fetch cached data for ${ticker}...`);
            const cachedData = await Intelligence.findOne({ ticker: ticker.toUpperCase() });

            if (cachedData) {
                const dataObj = cachedData.toObject();

                // Ensure history is present
                // We strictly respect the cache/ML data as requested.
                // Only mock if absolutely missing.
                let history = dataObj.history;

                // SANITY CHECK: If price is > 1,000,000 (likely Market Cap leaked), discard and regenerate
                const hasInsaneValues = history && history.some(pt => pt.price > 1000000);

                if (!history || history.length === 0 || hasInsaneValues) {
                    console.log(`[Cache Fix] History missing or corrupted (Values > 1M). Regenerating...`);
                    history = generateMockHistory(ticker.toUpperCase(), dataObj.prediction || 0);
                    // Self-heal the database
                    Intelligence.updateOne({ _id: cachedData._id }, { history }).catch(e => console.error(e));
                }

                return res.status(200).json({
                    ...dataObj,
                    history,
                    source: "cache",
                    system_status: "training",
                    message: "Data served from cache while model retrains."
                });
            } else {
                // If no cache and training, return the training status message
                return res.status(202).json(mlData);
            }
        }

        // 2. If successful and not training, update Cache (Upsert)
        try {
            await Intelligence.findOneAndUpdate(
                { ticker: ticker.toUpperCase() },
                {
                    reliability_score: mlData.reliability_score,
                    regime: mlData.regime,
                    prediction: mlData.prediction,
                    narrative_summary: mlData.narrative_summary,
                    is_consistent: mlData.is_consistent,
                    history: mlData.history || [], // Store real history from ML
                    last_updated: new Date()
                },
                { upsert: true, new: true }
            );
        } catch (dbError) {
            console.error("Failed to cache intelligence data:", dbError.message);
            // Continue serving data even if cache fails
        }

        // Use ML service history if available, otherwise generate mock as fallback
        if (mlData.history && mlData.history.length > 0) {
            console.log(`[Intelligence] Using ${mlData.history.length} history points from ML Service for ${ticker}`);
        } else {
            console.log(`[Intelligence] ML Service returned no history for ${ticker}, using fallback.`);
        }

        const history = (mlData.history && mlData.history.length > 0)
            ? mlData.history
            : generateMockHistory(ticker.toUpperCase(), mlData.prediction || 0);

        return res.status(200).json({ ...mlData, history, source: "live" });

    } catch (error) {
        console.error("Error fetching intelligence data:", error.message);

        // 3. Fallback: Try Mock Data first (User Request)
        const mockRow = MOCK_INTELLIGENCE_DATA[ticker.toUpperCase()];
        if (mockRow) {
            console.log(`Serving MOCK data for ${ticker} due to ML failure.`);
            const history = generateMockHistory(ticker.toUpperCase(), mockRow.prediction);
            // Also simulate saving this to DB so it persists
            try {
                await Intelligence.findOneAndUpdate(
                    { ticker: ticker.toUpperCase() },
                    {
                        ...mockRow,
                        last_updated: new Date(),
                        history
                    },
                    { upsert: true, new: true }
                );
            } catch (e) { }

            return res.status(200).json({
                ...mockRow,
                history,
                source: "static_analysis",
                system_status: "online",
                message: "Analysis provided by Aletheia Intelligence (Static Mode)"
            });
        }

        // 4. Deep Fallback: Try Cache
        try {
            const cachedData = await Intelligence.findOne({ ticker: ticker.toUpperCase() });
            if (cachedData) {
                console.log(`Serving cached data for ${ticker} due to ML service failure.`);
                const dataObj = cachedData.toObject();
                // Ensure history is present
                let history = dataObj.history;

                // SANITY CHECK: If price is > 1,000,000, discard
                const hasInsaneValues = history && history.some(pt => pt.price > 1000000);

                if (!history || history.length === 0 || hasInsaneValues) {
                    history = generateMockHistory(ticker.toUpperCase(), dataObj.prediction || 0);
                }

                return res.status(200).json({
                    ...dataObj,
                    history,
                    source: "cache",
                    system_status: "error_fallback",
                    warning: "Live analysis unavailable. Showing last known data."
                });
            }
        } catch (cacheError) {
            console.error("Cache retrieval failed:", cacheError.message);
        }

        if (error.response) {
            return res.status(error.response.status).json(error.response.data);
        } else if (error.request) {
            return res.status(503).json({ message: "Intelligence service unavailable." });
        } else {
            return res.status(500).json({ message: "Internal Server Error" });
        }
    }
};

export const getTickers = async (req, res) => {
    const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || "http://localhost:8001";

    // Helper for simple retries
    const fetchWithRetry = async (url, retries = 30, delay = 2000) => {
        for (let i = 0; i < retries; i++) {
            try {
                return await axios.get(url);
            } catch (error) {
                if (i === retries - 1) throw error;
                if (error.code === 'ECONNREFUSED' || (error.response && error.response.status === 503)) {
                    await new Promise(res => setTimeout(res, delay));
                } else {
                    throw error;
                }
            }
        }
    };

    try {
        let allTickers = [];

        // 1. Fetch Public Tickers from Python Service
        try {
            const response = await fetchWithRetry(`${pythonServiceUrl}/tickers`);
            if (Array.isArray(response.data)) {
                allTickers = response.data;
            }
        } catch (serviceError) {
            console.error("Warning: Python ML service unavailable for tickers:", serviceError.message);

            // FAILSAFE: If service is down, ensure we still list major public tickers so they aren't hijacked by startup logic
            const FAILSAFE_TICKERS = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "AMD", "NFLX"];

            try {
                // Try to fetch from DB cache first to show last known price
                const cachedDocs = await Intelligence.find({ ticker: { $in: FAILSAFE_TICKERS } });

                allTickers = FAILSAFE_TICKERS.map(t => {
                    const cached = cachedDocs.find(d => d.ticker === t);
                    // Assuming history is sorted ascending (latest last) or we take what we have
                    let lastPrice = 0;
                    if (cached && cached.history && cached.history.length > 0) {
                        lastPrice = cached.history[cached.history.length - 1].price;
                    }

                    return {
                        ticker: t,
                        name: t + " (Offline Mode)",
                        price: lastPrice > 0 ? lastPrice : 150.00, // Reasonable default to avoid $0 shock
                        change: 0,
                        is_analyzed: true
                    };
                });
                console.log(`Loaded ${allTickers.length} failsafe public tickers from cache/defaults.`);
            } catch (dbError) {
                console.error("Failed to load failsafe tickers from DB:", dbError);
            }
        }

        // 2. Fetch "IPO" Startups (Founders)
        const founders = await User.find({ role: "founder" });

        // Optimize: Fetch all transactions at once to calculate prices
        const allTransactions = await Transaction.find({});

        // Create a set of existing tickers to avoid duplicates
        // distinct public tickers
        const publicTickerSymbolSet = new Set();
        if (Array.isArray(allTickers)) {
            allTickers.forEach(t => publicTickerSymbolSet.add(t.ticker));
        }

        const startupTickers = await Promise.all(founders.map(async (founder) => {
            const tickerSymbol = founder.companyName?.trim().toUpperCase();
            if (!tickerSymbol) return null;

            // CRITICAL CHECK: If this ticker already exists in real market data (e.g. NVDA), 
            // DO NOT create a "fake" startup version. Let the real one exist.
            if (publicTickerSymbolSet.has(tickerSymbol)) {
                return null;
            }

            // Calculate Dynamic Price for NEW startups
            // Price = $10 + ($0.10 * Net Holdings)
            let netHoldings = 0;
            allTransactions.forEach(tx => {
                if (tx.symbol === tickerSymbol) {
                    if (tx.side === 'BUY') netHoldings += tx.quantity;
                    else if (tx.side === 'SELL') netHoldings -= tx.quantity;
                }
            });

            const currentPrice = Math.max(1.00, 10.00 + (netHoldings * 0.10));

            return {
                ticker: tickerSymbol,
                name: founder.companyName,
                price: parseFloat(currentPrice.toFixed(2)),
                change: 0.00,
                is_analyzed: false,
                is_startup: true
            };
        }));

        // Filter valid startups
        const validStartups = startupTickers.filter(t => t !== null);

        // 3. Merge Lists
        const finalTickers = [...validStartups, ...allTickers];

        return res.status(200).json(finalTickers);

    } catch (error) {
        console.error("Error fetching tickers:", error.message);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
}


export const getNews = async (req, res) => {
    const { ticker } = req.params;
    const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || "http://localhost:8001";

    try {
        const response = await axios.get(`${pythonServiceUrl}/news/${ticker}`);
        return res.status(200).json(response.data);
    } catch (error) {
        console.error("Error fetching news:", error.message);
        if (error.response) {
            return res.status(error.response.status).json(error.response.data);
        }
        return res.status(500).json({ message: "News service unavailable", news: [] });
    }
}
