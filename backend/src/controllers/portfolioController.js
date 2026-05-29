import { Portfolio } from "../models/portfolio.model.js";
import { Holding } from "../models/holding.model.js";
import { Transaction } from "../models/transaction.model.js";
import axios from 'axios';

// --- Helper Functions ---

/**
 * Fetch current prices for multiple tickers from the intelligence service
 * @param {Array<string>} symbols - Array of ticker symbols
 * @returns {Object} Map of symbol -> price
 */
const fetchCurrentPrices = async (symbols) => {
    try {
        const response = await axios.get('http://localhost:8000/api/intelligence/tickers');
        const tickers = response.data;

        const priceMap = {};
        symbols.forEach(symbol => {
            const ticker = tickers.find(t => t.ticker === symbol.toUpperCase());
            if (ticker && ticker.price) {
                priceMap[symbol.toUpperCase()] = ticker.price;
            }
        });

        return priceMap;
    } catch (error) {
        console.error("Error fetching current prices:", error.message);
        return {}; // Return empty map on error
    }
};

/**
 * Calculate total realized P&L from all sell transactions
 * @param {ObjectId} portfolioId - Portfolio ID
 * @returns {Number} Total realized P&L
 */
const calculateRealizedPnL = async (portfolioId) => {
    try {
        const sellTransactions = await Transaction.find({
            portfolio: portfolioId,
            side: 'SELL'
        });

        let totalRealizedPnL = 0;

        for (const tx of sellTransactions) {
            // For each sell transaction, we need to calculate the cost basis
            // We'll use the average cost method based on holdings at the time of sale

            // Get all buy transactions for this symbol up to this sell transaction
            const buyTransactions = await Transaction.find({
                portfolio: portfolioId,
                symbol: tx.symbol,
                side: 'BUY',
                timestamp: { $lte: tx.timestamp }
            }).sort({ timestamp: 1 });

            // Calculate average cost basis
            let totalCost = 0;
            let totalQuantity = 0;

            for (const buy of buyTransactions) {
                totalCost += buy.total_amount;
                totalQuantity += buy.quantity;
            }

            // Get all previous sell transactions for this symbol
            const previousSells = await Transaction.find({
                portfolio: portfolioId,
                symbol: tx.symbol,
                side: 'SELL',
                timestamp: { $lt: tx.timestamp }
            });

            // Subtract previously sold quantities from total
            let previouslySoldQty = 0;
            for (const prevSell of previousSells) {
                previouslySoldQty += prevSell.quantity;
            }

            const remainingQty = totalQuantity - previouslySoldQty;
            const avgCostBasis = remainingQty > 0 ? totalCost / totalQuantity : 0;
            const costBasisForThisSale = avgCostBasis * tx.quantity;
            const realizedPnL = tx.total_amount - costBasisForThisSale;

            totalRealizedPnL += realizedPnL;
        }

        return totalRealizedPnL;
    } catch (error) {
        console.error("Error calculating realized P&L:", error.message);
        return 0;
    }
};

// --- Controller Functions ---

export const createPortfolio = async (req, res) => {
    try {
        const { name, initial_capital = 100000 } = req.body;
        const userId = req.user._id;

        // Validate: One active portfolio per user
        const existingPortfolio = await Portfolio.findOne({ user: userId, is_active: true });
        if (existingPortfolio) {
            return res.status(400).json({
                message: "You already have an active portfolio. Please deactivate it before creating a new one."
            });
        }

        // Validate inputs
        if (!name || name.trim().length < 3) {
            return res.status(400).json({ message: "Portfolio name is required (minimum 3 characters)" });
        }

        if (initial_capital < 1000) {
            return res.status(400).json({ message: "Minimum initial capital is $1,000" });
        }

        // Create portfolio
        const portfolio = await Portfolio.create({
            user: userId,
            name: name.trim(),
            initial_capital,
            cash_balance: initial_capital,
            is_active: true
        });

        res.status(201).json({
            success: true,
            message: "Portfolio created successfully",
            portfolio
        });

    } catch (error) {
        console.error("Error creating portfolio:", error);
        res.status(500).json({ message: "Failed to create portfolio", error: error.message });
    }
};

export const getPortfolio = async (req, res) => {
    try {
        const userId = req.user._id;

        const portfolio = await Portfolio.findOne({ user: userId, is_active: true });

        if (!portfolio) {
            return res.status(404).json({ message: "No active portfolio found" });
        }

        // Fetch all holdings for this portfolio
        const holdings = await Holding.find({ portfolio: portfolio._id });

        let totalHoldingsValue = 0;
        let totalInvestedAmount = 0;

        if (holdings.length > 0) {
            // Get symbols from holdings
            const symbols = holdings.map(h => h.symbol);

            // Fetch current prices
            const priceMap = await fetchCurrentPrices(symbols);

            // Calculate holdings value and invested amount
            holdings.forEach(holding => {
                const currentPrice = priceMap[holding.symbol] || 0;
                const currentValue = currentPrice * holding.quantity;

                totalHoldingsValue += currentValue;
                totalInvestedAmount += holding.total_cost;
            });
        }

        // Calculate unrealized P&L
        const unrealizedPnL = totalHoldingsValue - totalInvestedAmount;

        // Calculate realized P&L from transaction history
        const realizedPnL = await calculateRealizedPnL(portfolio._id);

        // Calculate total portfolio value
        const totalValue = portfolio.cash_balance + totalHoldingsValue;

        const summary = {
            total_value: parseFloat(totalValue.toFixed(2)),
            invested_amount: parseFloat(totalInvestedAmount.toFixed(2)),
            unrealized_pnl: parseFloat(unrealizedPnL.toFixed(2)),
            realized_pnl: parseFloat(realizedPnL.toFixed(2)),
            cash_balance: parseFloat(portfolio.cash_balance.toFixed(2)),
            holdings_value: parseFloat(totalHoldingsValue.toFixed(2)),
            total_pnl: parseFloat((unrealizedPnL + realizedPnL).toFixed(2)),
            total_return_pct: totalInvestedAmount > 0
                ? parseFloat((((totalValue - portfolio.initial_capital) / portfolio.initial_capital) * 100).toFixed(2))
                : 0
        };

        res.status(200).json({
            success: true,
            portfolio: {
                ...portfolio.toObject(),
                summary
            }
        });

    } catch (error) {
        console.error("Error fetching portfolio:", error);
        res.status(500).json({ message: "Failed to fetch portfolio", error: error.message });
    }
};

export const getHoldings = async (req, res) => {
    try {
        const userId = req.user._id;

        // Get user's active portfolio
        const portfolio = await Portfolio.findOne({ user: userId, is_active: true });

        if (!portfolio) {
            return res.status(404).json({ message: "No active portfolio found" });
        }

        // Fetch all holdings
        const holdings = await Holding.find({ portfolio: portfolio._id });

        if (holdings.length === 0) {
            return res.status(200).json({
                success: true,
                holdings: [],
                message: "No holdings in portfolio"
            });
        }

        // Get symbols and fetch current prices
        const symbols = holdings.map(h => h.symbol);
        const priceMap = await fetchCurrentPrices(symbols);

        // Calculate total portfolio value for allocation percentages
        let totalPortfolioValue = portfolio.cash_balance;
        holdings.forEach(h => {
            const price = priceMap[h.symbol] || 0;
            totalPortfolioValue += price * h.quantity;
        });

        // Enrich holdings with current data
        const enrichedHoldings = holdings.map(holding => {
            const currentPrice = priceMap[holding.symbol] || 0;
            const currentValue = currentPrice * holding.quantity;
            const unrealizedPnL = currentValue - holding.total_cost;
            const unrealizedPnLPct = holding.total_cost > 0
                ? ((unrealizedPnL / holding.total_cost) * 100)
                : 0;
            const allocationPct = totalPortfolioValue > 0
                ? ((currentValue / totalPortfolioValue) * 100)
                : 0;

            return {
                symbol: holding.symbol,
                quantity: holding.quantity,
                average_buy_price: parseFloat(holding.average_buy_price.toFixed(2)),
                total_cost: parseFloat(holding.total_cost.toFixed(2)),
                current_price: parseFloat(currentPrice.toFixed(2)),
                current_value: parseFloat(currentValue.toFixed(2)),
                unrealized_pnl: parseFloat(unrealizedPnL.toFixed(2)),
                unrealized_pnl_pct: parseFloat(unrealizedPnLPct.toFixed(2)),
                allocation_pct: parseFloat(allocationPct.toFixed(2)),
                price_available: currentPrice > 0
            };
        });

        // Sort by current value (descending)
        enrichedHoldings.sort((a, b) => b.current_value - a.current_value);

        res.status(200).json({
            success: true,
            holdings: enrichedHoldings,
            total_holdings_count: enrichedHoldings.length
        });

    } catch (error) {
        console.error("Error fetching holdings:", error);
        res.status(500).json({ message: "Failed to fetch holdings", error: error.message });
    }
};

export const deletePortfolio = async (req, res) => {
    try {
        const userId = req.user._id;

        const portfolio = await Portfolio.findOne({ user: userId, is_active: true });

        if (!portfolio) {
            return res.status(404).json({ message: "No active portfolio found" });
        }

        // Soft delete by setting is_active to false
        portfolio.is_active = false;
        await portfolio.save();

        res.status(200).json({
            success: true,
            message: "Portfolio deleted successfully"
        });

    } catch (error) {
        console.error("Error deleting portfolio:", error);
        res.status(500).json({ message: "Failed to delete portfolio", error: error.message });
    }
};
