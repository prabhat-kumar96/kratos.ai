import { useState } from 'react';
import axios from 'axios';
import { X, ShoppingCart } from 'lucide-react';

export default function BuyModal({ company, onClose, onSuccess }) {
    const [quantity, setQuantity] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const totalCost = (company.price * quantity).toFixed(2);

    const handleBuy = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await axios.post('http://localhost:8000/api/v1/orders', {
                symbol: company.ticker,
                side: 'BUY',
                quantity: parseInt(quantity)
            }, {
                withCredentials: true
            });

            console.log('Order placed:', response.data);

            if (onSuccess) onSuccess(response.data);
            onClose();
        } catch (err) {
            console.error('Error placing order:', err);
            setError(err.response?.data?.message || 'Failed to place order');
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
                        <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                            <ShoppingCart className="w-6 h-6 text-green-400" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white">Buy {company.ticker}</h2>
                            <p className="text-gray-400 text-sm">Market Order</p>
                        </div>
                    </div>
                </div>

                {/* Current Price */}
                <div className="bg-gray-800/50 rounded-lg p-4 mb-5">
                    <div className="flex justify-between items-center">
                        <span className="text-gray-400">Current Price</span>
                        <span className="text-white font-mono text-lg">${company.price}</span>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleBuy} className="space-y-5">
                    {/* Quantity */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Quantity
                        </label>
                        <input
                            type="number"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            min={1}
                            step={1}
                            required
                            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                        />
                    </div>

                    {/* Total Cost */}
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-300 font-medium">Total Cost</span>
                            <span className="text-green-400 font-bold text-xl">${totalCost}</span>
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
                            disabled={loading}
                            className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-gray-600 disabled:to-gray-600 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:cursor-not-allowed"
                        >
                            {loading ? 'Processing...' : `Buy ${quantity} ${quantity > 1 ? 'Shares' : 'Share'}`}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}