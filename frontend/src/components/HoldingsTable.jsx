import { TrendingUp, TrendingDown } from 'lucide-react';

export default function HoldingsTable({ holdings, loading, onSell }) {
    if (loading) {
        return (
            <div className="p-12 text-center text-gray-500">
                <div className="w-8 h-8 mx-auto mb-2 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                Loading holdings...
            </div>
        );
    }

    if (!holdings || holdings.length === 0) {
        return (
            <div className="p-12 text-center text-gray-500">
                <p className="text-lg">No holdings yet</p>
                <p className="text-sm mt-2">Buy some stocks to see them here</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead className="bg-white/5 text-xs uppercase text-gray-400 font-medium">
                    <tr>
                        <th className="px-6 py-3">Symbol</th>
                        <th className="px-6 py-3">Quantity</th>
                        <th className="px-6 py-3">Avg Price</th>
                        <th className="px-6 py-3">Current Price</th>
                        <th className="px-6 py-3">Current Value</th>
                        <th className="px-6 py-3">Total Cost</th>
                        <th className="px-6 py-3">P&L</th>
                        <th className="px-6 py-3">Allocation</th>
                        <th className="px-6 py-3 text-right">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {holdings.map((holding) => {
                        const isProfitable = holding.unrealized_pnl >= 0;

                        return (
                            <tr key={holding.symbol} className="hover:bg-white/5 transition-colors">
                                {/* Symbol */}
                                <td className="px-6 py-4 font-medium flex items-center gap-2">
                                    <span className="w-8 h-8 rounded bg-indigo-500/10 flex items-center justify-center text-xs font-bold text-indigo-400">
                                        {holding.symbol[0]}
                                    </span>
                                    {holding.symbol}
                                </td>

                                {/* Quantity */}
                                <td className="px-6 py-4 text-gray-300">
                                    {holding.quantity}
                                </td>

                                {/* Average Price */}
                                <td className="px-6 py-4 font-mono text-gray-300">
                                    ${holding.average_buy_price.toFixed(2)}
                                </td>

                                {/* Current Price */}
                                <td className="px-6 py-4 font-mono text-white">
                                    ${holding.current_price?.toFixed(2) || holding.average_buy_price.toFixed(2)}
                                </td>

                                {/* Current Value */}
                                <td className="px-6 py-4 font-mono text-white font-medium">
                                    ${holding.current_value.toFixed(2)}
                                </td>

                                {/* Total Cost */}
                                <td className="px-6 py-4 font-mono text-gray-300">
                                    ${holding.total_cost.toFixed(2)}
                                </td>

                                {/* P&L */}
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        {isProfitable ? (
                                            <TrendingUp className="w-4 h-4 text-green-400" />
                                        ) : (
                                            <TrendingDown className="w-4 h-4 text-red-400" />
                                        )}
                                        <div className="flex flex-col">
                                            <span className={`font-mono font-medium ${isProfitable ? 'text-green-400' : 'text-red-400'}`}>
                                                {isProfitable ? '+' : ''}${holding.unrealized_pnl.toFixed(2)}
                                            </span>
                                            <span className={`text-xs ${isProfitable ? 'text-green-400/70' : 'text-red-400/70'}`}>
                                                {isProfitable ? '+' : ''}{holding.unrealized_pnl_percent?.toFixed(2) || 0}%
                                            </span>
                                        </div>
                                    </div>
                                </td>

                                {/* Allocation */}
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 bg-gray-700 rounded-full h-2 max-w-[80px]">
                                            <div
                                                className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full"
                                                style={{ width: `${Math.min(holding.allocation_percent || 0, 100)}%` }}
                                            ></div>
                                        </div>
                                        <span className="text-sm text-gray-400 min-w-[45px]">
                                            {holding.allocation_percent?.toFixed(1) || 0}%
                                        </span>
                                    </div>
                                </td>

                                {/* Sell Button */}
                                <td className="px-6 py-4 text-right">
                                    <button
                                        onClick={() => onSell && onSell(holding)}
                                        className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg transition-all text-sm font-medium"
                                    >
                                        Sell
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}