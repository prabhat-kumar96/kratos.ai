import { Holding } from "../models/holding.model.js";
import { Portfolio } from "../models/portfolio.model.js";
import axios from 'axios';

export const getHoldings = async (req, res) => {
    try {
        const userId = req.user._id;

        // Get user's portfolio
        const portfolio = await Portfolio.findOne({ user: userId, is_active: true });
        if (!portfolio) {
            return res.status(404).json({ message: "No active portfolio found" });
        }

        // Get all holdings for this portfolio
        const holdings = await Holding.find({ portfolio: portfolio._id, quantity: { $gt: 0 } });

        if (holdings.length === 0) {
            return res.status(200).json({ success: true, holdings: [] });
        }

        // Fetch current prices for all holdings
        try {
            const tickersResponse = await axios.get('http://localhost:8000/api/intelligence/tickers');
            const tickers = tickersResponse.data || [];

            // Enrich holdings with current prices and calculations
            const enrichedHoldings = holdings.map(holding => {
                const ticker = tickers.find(t => t.ticker === holding.symbol);
                const currentPrice = ticker?.price || holding.average_buy_price;

                const currentValue = holding.quantity * currentPrice;
                const unrealizedPnL = currentValue - holding.total_cost;
                const unrealizedPnLPercent = (unrealizedPnL / holding.total_cost) * 100;

                return {
                    ...holding.toObject(),
                    current_price: currentPrice,
                    current_value: currentValue,
                    unrealized_pnl: unrealizedPnL,
                    unrealized_pnl_percent: unrealizedPnLPercent
                };
            });

            // Calculate total portfolio value
            const totalHoldingsValue = enrichedHoldings.reduce((sum, h) => sum + h.current_value, 0);
            const totalInvested = enrichedHoldings.reduce((sum, h) => sum + h.total_cost, 0);

            // Calculate allocation percentages
            const holdingsWithAllocation = enrichedHoldings.map(holding => ({
                ...holding,
                allocation_percent: (holding.current_value / totalHoldingsValue) * 100
            }));

            res.status(200).json({
                success: true,
                holdings: holdingsWithAllocation,
                summary: {
                    total_holdings_value: totalHoldingsValue,
                    total_invested: totalInvested,
                    total_unrealized_pnl: totalHoldingsValue - totalInvested
                }
            });

        } catch (priceError) {
            console.error('Failed to fetch current prices:', priceError);
            // Return holdings without current prices
            res.status(200).json({ success: true, holdings: holdings.map(h => h.toObject()) });
        }

    } catch (error) {
        console.error("Error fetching holdings:", error);
        res.status(500).json({ message: "Failed to fetch holdings", error: error.message });
    }
};
