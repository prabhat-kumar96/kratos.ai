import { useState } from 'react';
import axios from 'axios';
import { X, TrendingDown } from 'lucide-react';

export default function SellModal({ holding, onClose, onSuccess }) {
    const [quantity, setQuantity] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const maxQuantity = holding.quantity;
    const currentPrice = holding.current_price || holding.average_buy_price;
    const totalProceeds = (currentPrice * quantity).toFixed(2);

    // Calculate P&L for this sale
    const costBasis = (holding.total_cost / holding.quantity) * quantity;
    const estimatedPnL = (currentPrice * quantity) - costBasis;

    const handleSell = async (e) => {
        e.preventDefault();
        setError('');

        if (quantity > maxQuantity) {
            setError(`You only own ${maxQuantity} shares`);
            return;
        }

        setLoading(true);

        try {
            const response = await axios.post('http://localhost:8000/api/v1/orders', {
                symbol: holding.symbol,
                side: 'SELL',
                quantity: parseInt(quantity)
            }, {
                withCredentials: true
            });

            console.log('Sell order placed:', response.data);

            if (onSuccess) onSuccess(response.data);
            onClose();
        } catch (err) {
            console.error('Error placing sell order:', err);
            setError(err.response?.data?.message || 'Failed to place sell order');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-2xl border border-white/10 shadow-2xl max-w-md w-full p-6 relative">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Header */}
                <div className="mb-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                            <TrendingDown className="w-6 h-6 text-red-400" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white">Sell {holding.symbol}</h2>
                            <p className="text-gray-400 text-sm">Market Order</p>
                        </div>
                    </div>
                </div>

                {/* Holdings Info */}
                <div className="bg-gray-800/50 rounded-lg p-4 mb-5 space-y-2">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-400">You Own</span>
                        <span className="text-white font-medium">{maxQuantity} shares</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-400">Avg Buy Price</span>
                        <span className="text-white font-mono">${holding.average_buy_price.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-400">Current Price</span>
                        <span className="text-white font-mono">${currentPrice.toFixed(2)}</span>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSell} className="space-y-5">
                    {/* Quantity */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Quantity (Max: {maxQuantity})
                        </label>
                        <input
                            type="number"
                            value={quantity}
                            onChange={(e) => setQuantity(Math.min(parseInt(e.target.value) || 0, maxQuantity))}
                            min={1}
                            max={maxQuantity}
                            step={1}
                            required
                            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                        />
                    </div>

                    {/* Total Proceeds */}
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-gray-300 font-medium">Total Proceeds</span>
                            <span className="text-red-400 font-bold text-xl">${totalProceeds}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-400">Est. P&L</span>
                            <span className={`font-medium ${estimatedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {estimatedPnL >= 0 ? '+' : ''}${estimatedPnL.toFixed(2)}
                            </span>
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                            <p className="text-red-400 text-sm">{error}</p>
                        </div>
                    )}

                    {/* Buttons */}
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-medium py-3 px-4 rounded-lg transition-all disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || quantity < 1}
                            className="flex-1 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:from-gray-600 disabled:to-gray-600 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:cursor-not-allowed"
                        >
                            {loading ? 'Processing...' : `Sell ${quantity} ${quantity > 1 ? 'Shares' : 'Share'}`}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}