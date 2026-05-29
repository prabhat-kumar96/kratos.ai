import axios from "axios";

export const getCompanyNews = async (req, res) => {
    const { ticker } = req.params;
    const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || "http://localhost:8001";

    try {
        // Map "Global" to a market index for general news (e.g., SPY or ^GSPC)
        // Yahoo Finance works best with tickers, so SPY (S&P 500 ETF) is a good proxy for "Market News"
        const searchTicker = (ticker.toUpperCase() === 'GLOBAL') ? 'SPY' : ticker.toUpperCase();

        const response = await axios.get(`${pythonServiceUrl}/news/${searchTicker}`);

        // Transform the ML service response if necessary, or just pass it through
        // ML service returns { news: [ ... ] }
        return res.status(200).json({
            ticker: ticker.toUpperCase(),
            news: response.data.news || [],
            source: "Yahoo Finance (Live)"
        });

    } catch (error) {
        console.error("Error fetching live news:", error.message);
        // Fallback or empty list on error
        return res.status(500).json({
            ticker: ticker,
            news: [],
            message: "Failed to fetch live news"
        });
    }
};
