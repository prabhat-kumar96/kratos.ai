import { useState } from 'react';
import axios from 'axios';
import { X } from 'lucide-react';

export default function CreatePortfolioModal({ onClose, onSuccess }) {
    const [name, setName] = useState('');
    const [initialCapital, setInitialCapital] = useState(100000);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await axios.post('http://localhost:8000/api/v1/portfolio', {
                name,
                initial_capital: initialCapital
            }, {
                withCredentials: true
            });

            console.log('Portfolio created:', response.data);

            // Success callback
            if (onSuccess) onSuccess(response.data.portfolio);

            onClose();
        } catch (err) {
            console.error('Error creating portfolio:', err);
            setError(err.response?.data?.message || 'Failed to create portfolio');
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
                    <h2 className="text-2xl font-bold text-white mb-2">Create Portfolio</h2>
                    <p className="text-gray-400 text-sm">Start your virtual trading journey with paper money</p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Portfolio Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Portfolio Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., My Trading Portfolio"
                            required
                            minLength={3}
                            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        />
                    </div>

                    {/* Initial Capital */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Initial Capital (USD)
                        </label>
                        <input
                            type="number"
                            value={initialCapital}
                            onChange={(e) => setInitialCapital(Number(e.target.value))}
                            min={1000}
                            step={1000}
                            required
                            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        />
                        <p className="mt-2 text-xs text-gray-500">Minimum: $1,000 (virtual money)</p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                            <p className="text-red-400 text-sm">{error}</p>
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-gray-600 disabled:to-gray-600 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:cursor-not-allowed"
                    >
                        {loading ? 'Creating...' : 'Create Portfolio'}
                    </button>
                </form>
            </div>
        </div>
    );
}