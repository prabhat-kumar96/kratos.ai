import { useState, useEffect } from "react";
import axios from "axios";
import { Activity, TrendingUp, Users, DollarSign, Clock, ArrowUpRight } from "lucide-react";

export default function StartupDashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [socketStatus, setSocketStatus] = useState("disconnected");

    // Initial Fetch
    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await axios.get("http://localhost:8000/api/v1/startup/stats", {
                    withCredentials: true
                });
                if (response.data.success) {
                    setStats(response.data);
                }
            } catch (err) {
                console.error("Failed to fetch startup stats:", err);
                setError("Failed to load dashboard data. Are you logged in as a Founder?");
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    // Live Socket Connection
    useEffect(() => {
        if (!stats?.ticker) return;

        import("socket.io-client").then(({ io }) => {
            const socket = io("http://localhost:8000");

            socket.on('connect', () => {
                console.log('StartupDashboard: Connected to Live Stream');
                setSocketStatus("connected");
            });

            socket.on('disconnect', () => {
                setSocketStatus("disconnected");
            });

            socket.on('live_ticker_update', (updates) => {
                const liveData = updates[stats.ticker];
                if (liveData) {
                    setStats(prev => {
                        if (!prev) return prev;
                        // Calculate new market cap dynamically
                        const newPrice = liveData.price;
                        const netHoldings = prev.stats.net_holdings;
                        const newMarketCap = newPrice * netHoldings;

                        return {
                            ...prev,
                            stats: {
                                ...prev.stats,
                                current_price: newPrice,
                                market_cap: newMarketCap
                            }
                        };
                    });
                }
            });

            return () => socket.disconnect();
        });
    }, [stats?.ticker]);

    if (loading) return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
            <Activity className="w-8 h-8 animate-spin text-indigo-500 mr-2" />
            Loading Startup Metrics...
        </div>
    );

    if (error) return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white p-6">
            <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">Dashboard Error</h2>
                <p className="text-gray-400">{error}</p>
            </div>
        </div>
    );

    const { stats: metrics, reliability, ticker, recent_activity } = stats;

    return (
        <div className="flex min-h-screen bg-gray-950 pt-16">
            {/* Sidebar (Visual Only) */}
            <aside className="w-64 bg-gray-900 border-r border-white/5 hidden md:block fixed h-full z-10">
                <div className="p-6">
                    <h2 className="text-lg font-semibold text-white tracking-wide">Startup Portal</h2>
                    <div className="mt-2 text-xs text-gray-500 font-mono">TICKER: {ticker}</div>
                </div>
                <nav className="px-4 space-y-1">
                    <a href="#" className="bg-indigo-600/10 text-indigo-400 group flex items-center px-4 py-2 text-sm font-medium rounded-md border border-indigo-600/20">
                        <Activity className="mr-3 h-5 w-5" />
                        Overview
                    </a>
                </nav>
            </aside>

            <main className="flex-1 p-8 md:ml-64">
                <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                        <div>
                            <h1 className="text-3xl font-bold text-white">
                                {ticker} Dashboard
                            </h1>
                            <p className="text-gray-400 mt-1">Live Investor metrics and AI Reliability Score</p>
                        </div>
                        <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 px-4 py-2 rounded-lg">
                            <span className="text-sm text-gray-400 uppercase tracking-wider font-medium">Live Price</span>
                            <span className="text-xl font-mono font-bold text-green-400">${metrics.current_price.toFixed(2)}</span>
                        </div>
                    </div>

                    {/* KPI Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        {/* Reliability Score */}
                        <div className="bg-gray-900 rounded-xl border border-white/5 p-6 relative overflow-hidden group hover:border-indigo-500/30 transition-colors">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                            <div className="flex items-start justify-between mb-4">
                                <div className="p-2 bg-indigo-500/10 rounded-lg">
                                    <Activity className="w-6 h-6 text-indigo-400" />
                                </div>
                                <span className={`text-xs font-medium px-2 py-1 rounded-full border ${reliability.score >= 80 ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                    reliability.score >= 50 ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                                        'bg-red-500/10 text-red-400 border-red-500/20'
                                    }`}>
                                    {reliability.label}
                                </span>
                            </div>
                            <div className="text-3xl font-bold text-white mb-1">{reliability.score}%</div>
                            <div className="text-sm text-gray-400">AI Reliability Score</div>
                            <div className="w-full bg-gray-800 h-1 mt-4 rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-1000 ${reliability.score >= 80 ? 'bg-green-500' :
                                        reliability.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                                        }`}
                                    style={{ width: `${reliability.score}%` }}
                                />
                            </div>
                        </div>

                        {/* Net Holdings */}
                        <div className="bg-gray-900 rounded-xl border border-white/5 p-6 group hover:border-purple-500/30 transition-colors">
                            <div className="flex items-start justify-between mb-4">
                                <div className="p-2 bg-purple-500/10 rounded-lg">
                                    <Users className="w-6 h-6 text-purple-400" />
                                </div>
                            </div>
                            <div className="text-3xl font-bold text-white mb-1">{metrics.net_holdings}</div>
                            <div className="text-sm text-gray-400">Shares Held by Investors</div>
                            <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                                <ArrowUpRight className="w-3 h-3" />
                                Tracks active circulation
                            </p>
                        </div>

                        {/* Market Cap */}
                        <div className="bg-gray-900 rounded-xl border border-white/5 p-6 group hover:border-cyan-500/30 transition-colors">
                            <div className="flex items-start justify-between mb-4">
                                <div className="p-2 bg-cyan-500/10 rounded-lg">
                                    <DollarSign className="w-6 h-6 text-cyan-400" />
                                </div>
                            </div>
                            <div className="text-3xl font-bold text-white mb-1">${metrics.market_cap.toLocaleString()}</div>
                            <div className="text-sm text-gray-400">Est. Public Market Cap</div>
                            <p className="text-xs text-gray-500 mt-2">
                                Based on dynamic pricing
                            </p>
                        </div>

                        {/* Trading Volume */}
                        <div className="bg-gray-900 rounded-xl border border-white/5 p-6 group hover:border-pink-500/30 transition-colors">
                            <div className="flex items-start justify-between mb-4">
                                <div className="p-2 bg-pink-500/10 rounded-lg">
                                    <TrendingUp className="w-6 h-6 text-pink-400" />
                                </div>
                            </div>
                            <div className="text-3xl font-bold text-white mb-1">${metrics.total_volume.toLocaleString()}</div>
                            <div className="text-sm text-gray-400">Total Trading Volume</div>
                            <p className="text-xs text-gray-500 mt-2">
                                Cumulative flow
                            </p>
                        </div>
                    </div>

                    {/* Bottom Section: Recent Activity & Placeholder Chart */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Recursive Feed */}
                        <div className="lg:col-span-2 bg-gray-900 rounded-xl border border-white/5 overflow-hidden flex flex-col">
                            <div className="p-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
                                <h3 className="font-semibold text-white flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-gray-400" />
                                    Recent Investor Activity
                                </h3>
                            </div>
                            <div className="p-4 space-y-3">
                                {recent_activity.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500 text-sm">
                                        No recent trading activity.
                                    </div>
                                ) : (
                                    recent_activity.map((activity, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-full ${activity.action === 'BUY' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                                                    }`}>
                                                    {activity.action === 'BUY' ? <TrendingUp className="w-4 h-4" /> : <TrendingUp className="w-4 h-4 rotate-180" />}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-200">
                                                        {activity.actor} {activity.action === 'BUY' ? 'bought' : 'sold'} <span className="text-white font-bold">{activity.quantity}</span> shares
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        {new Date(activity.time).toLocaleString()}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm font-mono text-white">${activity.price.toFixed(2)}</div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Simple Call to Action / Info */}
                        <div className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 rounded-xl border border-indigo-500/20 p-6 flex flex-col justify-center text-center">
                            <h3 className="text-xl font-bold text-white mb-2">Grow Your Trust</h3>
                            <p className="text-sm text-gray-300 mb-6">
                                Your Reliability Score is influenced by consistent market performance and data stability.
                                Keep your company healthy to attract more investors!
                            </p>
                            <div className="p-4 bg-black/30 rounded-lg border border-indigo-500/20">
                                <div className="text-xs text-indigo-300 uppercase tracking-widest mb-1">Current Status</div>
                                <div className="text-lg font-semibold text-white">{reliability.label}</div>
                            </div>
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
}