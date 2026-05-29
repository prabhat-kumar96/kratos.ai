import { Order } from "../models/order.model.js";
import { Transaction } from "../models/transaction.model.js";
import { Portfolio } from "../models/portfolio.model.js";
import { Holding } from "../models/holding.model.js";
import axios from 'axios';

// Fetch current price from intelligence service
const fetchCurrentPrice = async (symbol) => {
    try {
        const response = await axios.get(`http://localhost:8000/api/intelligence/tickers`);
        const ticker = response.data.find(t => t.ticker === symbol.toUpperCase());

        if (!ticker || !ticker.price) {
            throw new Error(`Price not available for ${symbol}`);
        }

        return ticker.price;
    } catch (error) {
        console.error(`Failed to fetch price for ${symbol}:`, error.message);
        throw new Error(`Unable to get current price for ${symbol}`);
    }
};

export const placeMarketOrder = async (req, res) => {
    try {
        const { symbol, side, quantity } = req.body;
        const userId = req.user._id;

        // Validate inputs
        if (!symbol || !side || !quantity) {
            return res.status(400).json({ message: "Missing required fields: symbol, side, quantity" });
        }

        if (!['BUY', 'SELL'].includes(side.toUpperCase())) {
            return res.status(400).json({ message: "Invalid side. Must be BUY or SELL" });
        }

        if (quantity < 1 || !Number.isInteger(quantity)) {
            return res.status(400).json({ message: "Quantity must be a positive integer" });
        }

        // Get user's portfolio
        const portfolio = await Portfolio.findOne({ user: userId, is_active: true });
        if (!portfolio) {
            return res.status(404).json({ message: "No active portfolio found" });
        }

        // Fetch current market price
        const currentPrice = await fetchCurrentPrice(symbol);
        const totalAmount = currentPrice * quantity;

        // Validate sufficient cash for BUY orders
        if (side.toUpperCase() === 'BUY') {
            if (portfolio.cash_balance < totalAmount) {
                return res.status(400).json({
                    message: `Insufficient funds. Required: $${totalAmount.toFixed(2)}, Available: $${portfolio.cash_balance.toFixed(2)}`
                });
            }
        }

        // Validate sufficient holdings for SELL orders
        if (side.toUpperCase() === 'SELL') {
            const holding = await Holding.findOne({
                portfolio: portfolio._id,
                symbol: symbol.toUpperCase()
            });

            if (!holding || holding.quantity < quantity) {
                return res.status(400).json({
                    message: `Insufficient holdings. You own ${holding?.quantity || 0} shares, trying to sell ${quantity}`
                });
            }
        }

        // Create order
        const order = await Order.create({
            portfolio: portfolio._id,
            symbol: symbol.toUpperCase(),
            order_type: 'MARKET',
            side: side.toUpperCase(),
            quantity,
            status: 'FILLED',
            filled_quantity: quantity,
            average_fill_price: currentPrice,
            total_amount: totalAmount,
            executed_at: new Date()
        });

        // Create transaction record (immutable)
        const transaction = await Transaction.create({
            portfolio: portfolio._id,
            order: order._id,
            symbol: symbol.toUpperCase(),
            side: side.toUpperCase(),
            quantity,
            execution_price: currentPrice,
            total_amount: totalAmount,
            timestamp: new Date()
        });

        // Update or create holding for BUY
        if (side.toUpperCase() === 'BUY') {
            const existingHolding = await Holding.findOne({
                portfolio: portfolio._id,
                symbol: symbol.toUpperCase()
            });

            if (existingHolding) {
                // Update existing holding with new average price
                const newTotalQuantity = existingHolding.quantity + quantity;
                const newTotalCost = existingHolding.total_cost + totalAmount;
                const newAveragePrice = newTotalCost / newTotalQuantity;

                existingHolding.quantity = newTotalQuantity;
                existingHolding.total_cost = newTotalCost;
                existingHolding.average_buy_price = newAveragePrice;
                await existingHolding.save();
            } else {
                // Create new holding
                await Holding.create({
                    portfolio: portfolio._id,
                    symbol: symbol.toUpperCase(),
                    quantity,
                    average_buy_price: currentPrice,
                    total_cost: totalAmount
                });
            }
        }

        // Update holding for SELL
        if (side.toUpperCase() === 'SELL') {
            const holding = await Holding.findOne({
                portfolio: portfolio._id,
                symbol: symbol.toUpperCase()
            });

            if (holding) {
                // Calculate realized P&L
                const costBasis = (holding.total_cost / holding.quantity) * quantity;
                const realizedPnL = totalAmount - costBasis;

                if (holding.quantity === quantity) {
                    // Selling all shares - remove holding
                    await Holding.deleteOne({ _id: holding._id });
                } else {
                    // Partial sale - update holding
                    holding.quantity -= quantity;
                    holding.total_cost -= costBasis;
                    await holding.save();
                }

                console.log(`Realized P&L for ${symbol}: $${realizedPnL.toFixed(2)}`);
            }
        }

        // Update portfolio cash balance
        if (side.toUpperCase() === 'BUY') {
            portfolio.cash_balance -= totalAmount;
        } else {
            portfolio.cash_balance += totalAmount;
        }
        await portfolio.save();

        res.status(201).json({
            success: true,
            message: `Market ${side.toLowerCase()} order executed successfully`,
            order,
            transaction,
            new_cash_balance: portfolio.cash_balance
        });

    } catch (error) {
        console.error("Error placing market order:", error);
        res.status(500).json({ message: error.message || "Failed to place order" });
    }
};

export const getOrders = async (req, res) => {
    try {
        const userId = req.user._id;

        const portfolio = await Portfolio.findOne({ user: userId, is_active: true });
        if (!portfolio) {
            return res.status(404).json({ message: "No active portfolio found" });
        }

        const orders = await Order.find({ portfolio: portfolio._id })
            .sort({ created_at: -1 })
            .limit(50);

        res.status(200).json({ success: true, orders });

    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).json({ message: "Failed to fetch orders" });
    }
};
