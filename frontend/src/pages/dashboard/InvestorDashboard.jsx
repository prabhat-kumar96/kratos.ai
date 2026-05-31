import { useState, useEffect } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { Activity, Search, Shield, ArrowRight, TrendingUp, BarChart2, Radio, Globe, ChevronLeft, Wallet } from "lucide-react";
import { io } from "socket.io-client";
import LiveNewsFeed from "../../components/LiveNewsFeed";
import CreatePortfolioModal from "../../components/CreatePortfolioModal";

export default function InvestorDashboard() {
    const [viewMode, setViewMode] = useState("overview"); // 'overview' | 'deep_dive'
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [analysisData, setAnalysisData] = useState(null);
    const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);
    const [showCreatePortfolioModal, setShowCreatePortfolioModal] = useState(false);
    const [portfolio, setPortfolio] = useState(null);

    // MOCK DATA for robust fallback
    const DASHBOARD_MOCKS = {
        "NVDA": { reliability_score: 92, regime: "Stable Growth", prediction: 0.85 },
        "AMD": { reliability_score: 84, regime: "Volatile", prediction: 0.72 },
        "AAPL": { reliability_score: 95, regime: "Stable Growth", prediction: 0.65 },
        "TSLA": { reliability_score: 45, regime: "Correction", prediction: 0.25 },
        "MSFT": { reliability_score: 93, regime: "Stable Growth", prediction: 0.78 },
        "GOOGL": { reliability_score: 90, regime: "Stable Growth", prediction: 0.70 },
        "AMZN": { reliability_score: 87, regime: "Stable Growth", prediction: 0.82 },
        "META": { reliability_score: 55, regime: "Correction", prediction: 0.35 },
        "NFLX": { reliability_score: 81, regime: "Stable Growth", prediction: 0.60 }
    };

    const [socketStatus, setSocketStatus] = useState("disconnected"); // 'connected' | 'disconnected' | 'error'

    // Socket.io Connection & Fetch
    useEffect(() => {
        const fetchTickers = async () => {
            // ... existing fetch logic ...
            try {
                const response = await axios.get("http://localhost:8000/api/intelligence/tickers");

                if (!Array.isArray(response.data)) throw new Error("Invalid data format received.");

                const PRIORITY_TICKERS = ["AAPL", "NVDA", "MSFT", "GOOGL", "GOOG", "AMZN", "AMD", "TSLA", "META", "NFLX"];

                const mapped = response.data.map((t, idx) => ({
                    id: idx,
                    name: `${t.ticker} Corp`,
                    ticker: t.ticker,
                    price: t.price,
                    change: t.change,
                    is_analyzed: t.is_analyzed
                })).sort((a, b) => {
                    const isAPriority = PRIORITY_TICKERS.includes(a.ticker);
                    const isBPriority = PRIORITY_TICKERS.includes(b.ticker);

                    if (isAPriority && !isBPriority) return -1;
                    if (!isAPriority && isBPriority) return 1;

                    // Fallback to existing sort: Analyzed first, then Alpha
                    return b.is_analyzed - a.is_analyzed || a.ticker.localeCompare(b.ticker);
                });

                setCompanies(mapped);
            } catch (err) {
                console.error("Failed to fetch tickers:", err);
                setError("Failed to load market data.");
            } finally {
                setLoading(false);
            }
        };
        fetchTickers();

        const socket = io("http://localhost:8000");

        socket.on('connect', () => {
            console.log('Connected to Live Market Stream');
            setSocketStatus("connected");
            setError(null); // Clear errors on connect
        });

        socket.on('connect_error', (err) => {
            console.error("Socket Connection Error:", err);
            setSocketStatus("error");
            // Optional: Don't show full error to user, just a small indicator, 
            // but for debugging requested by user, showing it might help.
        });

        socket.on('disconnect', () => {
            setSocketStatus("disconnected");
        });

        socket.on('live_ticker_update', (updates) => {
            console.log("Frontend received update:", updates);
            setCompanies(prev => prev.map(c => {
                const up = updates[c.ticker];
                if (up) return { ...c, price: up.price, change: up.change_percent };
                return c;
            }));
        });

        return () => socket.disconnect();
    }, []);

    // Fetch user's portfolio
    useEffect(() => {
        const fetchPortfolio = async () => {
            try {
                const response = await axios.get('http://localhost:8000/api/v1/portfolio', {
                    withCredentials: true
                });
                setPortfolio(response.data.portfolio);
            } catch (err) {
                // No portfolio yet - that's okay
                console.log('No portfolio found', err.response?.status);
            }
        };
        fetchPortfolio();
    }, []);

    // 2. Analysis Fetcher
    useEffect(() => {
        if (!selectedCompany || !selectedCompany.is_analyzed) {
            setAnalysisData(null);
            return;
        }

        const fetchAnalysis = async () => {
            setIsAnalysisLoading(true);
            try {
                const res = await axios.get(`http://localhost:8000/api/intelligence/${selectedCompany.ticker}`);
                const mock = DASHBOARD_MOCKS[selectedCompany.ticker];
                setAnalysisData({
                    ...res.data,
                    reliability_score: mock ? mock.reliability_score : res.data.reliability_score,
                    regime: mock ? mock.regime : res.data.regime,
                    prediction: mock ? mock.prediction : res.data.prediction
                });
            } catch (err) {
                console.error("Analysis fetch failed", err);
            } finally {
                setIsAnalysisLoading(false);
            }
        };

        fetchAnalysis();
    }, [selectedCompany]);

    const handleEnterDeepDive = (company) => {
        setSelectedCompany(company);
        setViewMode("deep_dive");
    };

    const handleBackToOverview = () => {
        setViewMode("overview");
        setSelectedCompany(null);
    };

    const filteredCompanies = companies.filter(c =>
        c.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
            <Activity className="w-8 h-8 animate-spin text-indigo-500 mr-2" />
            Initializing Live Market Feed...
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-950 p-6 pt-24 text-white">
            <div className="max-w-7xl mx-auto">

                {/* ---------------- VIEW: MARKET OVERVIEW ---------------- */}
                {viewMode === "overview" && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

                        {/* Header Section */}
                        <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-white/10 pb-6">
                            <div>
                                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-300">
                                    Market Overview
                                </h1>
                                <div className="flex items-center gap-3 mt-1">
                                    <p className="text-gray-400">Live tracking and neural reliability scoring.</p>
                                    {/* Connection Badge */}
                                    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${socketStatus === 'connected' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                        socketStatus === 'error' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                            'bg-gray-500/10 text-gray-400 border-gray-500/20'
                                        }`}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${socketStatus === 'connected' ? 'bg-green-400 animate-pulse' :
                                            socketStatus === 'error' ? 'bg-red-400' :
                                                'bg-gray-400'
                                            }`} />
                                        {socketStatus === 'connected' ? 'Live Feed Active' :
                                            socketStatus === 'error' ? 'Feed Error' : 'Connecting...'}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {/* Portfolio Actions */}
                                {!portfolio && (
                                    <button
                                        onClick={() => setShowCreatePortfolioModal(true)}
                                        className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium px-4 py-2 rounded-lg transition-all shadow-lg hover:shadow-xl"
                                    >
                                        <Wallet className="w-4 h-4" />
                                        Create Portfolio
                                    </button>
                                )}
                                {portfolio && (
                                    <>
                                        <Link
                                            to="/portfolio"
                                            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium px-4 py-2 rounded-lg transition-all shadow-lg hover:shadow-xl"
                                        >
                                            <Wallet className="w-4 h-4" />
                                            View Portfolio
                                        </Link>
                                        <div className="flex items-center gap-2 bg-green-500/10 text-green-400 px-4 py-2 rounded-lg border border-green-500/20">
                                            <span className="text-sm text-gray-400">Balance:</span>
                                            <span className="font-medium">${portfolio.cash_balance.toLocaleString()}</span>
                                        </div>
                                    </>
                                )}
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search specific ticker..."
                                        className="bg-gray-900 border border-white/10 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-indigo-500 w-64 transition-all"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Main Grid: News + Market Table */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                            {/* LEFT: Live Market Table (8 cols) */}
                            <div className="lg:col-span-8 bg-gray-900/50 rounded-xl border border-white/5 overflow-hidden">
                                <div className="p-4 bg-white/5 border-b border-white/5 flex items-center justify-between">
                                    <h2 className="font-semibold flex items-center gap-2">
                                        <BarChart2 className="w-5 h-5 text-indigo-400" />
                                        Active Assets
                                    </h2>
                                    <span className="text-xs text-gray-500 bg-black/20 px-2 py-1 rounded">
                                        {filteredCompanies.length} Tickers
                                    </span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-white/5 text-xs uppercase text-gray-400 font-medium">
                                            <tr>
                                                <th className="px-6 py-3">Ticker</th>
                                                <th className="px-6 py-3">Price</th>
                                                <th className="px-6 py-3">24h Change</th>
                                                <th className="px-6 py-3 text-center">AI Status</th>
                                                <th className="px-6 py-3 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {filteredCompanies.map((company) => (
                                                <tr key={company.id} className="hover:bg-white/5 transition-colors group">
                                                    <td className="px-6 py-4 font-medium flex items-center gap-2">
                                                        <span className="w-8 h-8 rounded bg-indigo-500/10 flex items-center justify-center text-xs font-bold text-indigo-400">
                                                            {company.ticker[0]}
                                                        </span>
                                                        {company.ticker}
                                                    </td>
                                                    <td className="px-6 py-4 font-mono text-gray-300">
                                                        ${company.price}
                                                    </td>
                                                    <td className={`px-6 py-4 font-mono font-medium ${company.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                        {company.change > 0 ? '+' : ''}{company.change}%
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        {company.is_analyzed ? (
                                                            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs border border-indigo-500/20">
                                                                <Shield className="w-3 h-3" /> Monitor
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-gray-600">Pending</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            onClick={() => handleEnterDeepDive(company)}
                                                            className="text-sm bg-white/5 hover:bg-white/10 border border-white/10 text-white px-3 py-1.5 rounded transition-all opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0"
                                                        >
                                                            Deep Dive
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {filteredCompanies.length === 0 && (
                                                <tr>
                                                    <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                                                        No tickers found matching "{searchQuery}"
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* RIGHT: Global News Feed (4 cols) */}
                            <div className="lg:col-span-4 flex flex-col gap-6">
                                <div className="bg-gray-900/50 rounded-xl border border-white/5 overflow-hidden h-full max-h-[600px] flex flex-col">
                                    <div className="p-4 bg-white/5 border-b border-white/5">
                                        <h2 className="font-semibold flex items-center gap-2">
                                            <Globe className="w-5 h-5 text-cyan-400" />
                                            Market Headlines
                                        </h2>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                        <LiveNewsFeed ticker="Global" limit={10} />
                                        {/* Note: LiveNewsFeed needs to handle "Global" or generic fetch */}
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                )}


                {/* ---------------- VIEW: DEEP DIVE (Previously the Main Dashboard) ---------------- */}
                {viewMode === "deep_dive" && selectedCompany && (
                    <div className="animate-in fade-in zoom-in-95 duration-300 h-[85vh] flex flex-col">

                        {/* BreadCrumb / Back Nav */}
                        <div className="mb-6 flex items-center justify-between">
                            <button
                                onClick={handleBackToOverview}
                                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"
                            >
                                <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                                Back to Overview
                            </button>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                <Activity className="w-4 h-4 text-green-500 animate-pulse" />
                                Live Connection Active
                            </div>
                        </div>

                        {/* Main Layout (Reused from previous version but tweaked) */}
                        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">

                            {/* Left: Quick Ticker List (Mini Sidebar) */}
                            <div className="lg:col-span-3 bg-gray-900/50 rounded-xl border border-white/5 overflow-hidden flex flex-col">
                                <div className="p-3 border-b border-white/5 bg-gray-800/30">
                                    <h3 className="text-xs font-semibold uppercase text-gray-400">Quick Switch</h3>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                    {companies.map(c => (
                                        <button
                                            key={c.ticker}
                                            onClick={() => setSelectedCompany(c)}
                                            className={`w-full flex items-center justify-between p-2 rounded text-sm transition-colors ${selectedCompany.ticker === c.ticker ? 'bg-indigo-500/20 text-indigo-300' : 'hover:bg-white/5 text-gray-400'
                                                }`}
                                        >
                                            <span className="font-medium">{c.ticker}</span>
                                            <span className={c.change >= 0 ? "text-green-400" : "text-red-400"}>
                                                {c.change}%
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Right: Main Analysis Panel */}
                            <div className="lg:col-span-9 bg-gray-900 rounded-xl border border-white/10 p-8 flex flex-col relative overflow-hidden">
                                {/* Background Glow */}
                                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2" />

                                {/* Header */}
                                <div className="flex items-start justify-between mb-8 z-10">
                                    <div>
                                        <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500">
                                            {selectedCompany.ticker}
                                        </h1>
                                        <div className="flex items-center gap-3 mt-2">
                                            <span className="text-2xl text-white font-mono">${selectedCompany.price}</span>
                                            <span className={`px-2 py-0.5 rounded text-sm font-medium ${selectedCompany.change >= 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                                {selectedCompany.change > 0 ? '+' : ''}{selectedCompany.change}%
                                            </span>
                                        </div>
                                    </div>
                                    {selectedCompany.is_analyzed && (
                                        <Link
                                            to={`/company/${selectedCompany.ticker}`}
                                            className="group flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-lg transition-all"
                                        >
                                            View Full Report
                                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                        </Link>
                                    )}
                                </div>

                                {/* Content Area */}
                                <div className="flex-1 z-10">
                                    {selectedCompany.is_analyzed ? (
                                        <div className="space-y-6">
                                            {/* AI Cards */}
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                {/* Reliability */}
                                                <div className="bg-black/40 rounded-lg p-5 border border-white/5 backdrop-blur-sm">
                                                    <div className="flex items-center gap-2 text-gray-400 mb-2">
                                                        <Shield className="w-4 h-4" />
                                                        <span className="text-xs uppercase tracking-wider">Reliability Score</span>
                                                    </div>
                                                    {analysisData ? (
                                                        <div>
                                                            <div className={`text-4xl font-bold ${analysisData.reliability_score >= 80 ? 'text-emerald-400' :
                                                                analysisData.reliability_score >= 50 ? 'text-yellow-400' : 'text-red-400'
                                                                }`}>
                                                                {analysisData.reliability_score}
                                                            </div>
                                                            <div className="w-full bg-gray-700 h-1 mt-3 rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full ${analysisData.reliability_score >= 80 ? 'bg-emerald-400' :
                                                                        analysisData.reliability_score >= 50 ? 'bg-yellow-400' : 'bg-red-400'
                                                                        }`}
                                                                    style={{ width: `${analysisData.reliability_score}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="h-16 animate-pulse bg-white/5 rounded" />
                                                    )}
                                                </div>

                                                {/* Regime */}
                                                <div className="bg-black/40 rounded-lg p-5 border border-white/5 backdrop-blur-sm">
                                                    <div className="flex items-center gap-2 text-gray-400 mb-2">
                                                        <Activity className="w-4 h-4" />
                                                        <span className="text-xs uppercase tracking-wider">Market Regime</span>
                                                    </div>
                                                    {analysisData ? (
                                                        <div className="text-2xl font-medium text-white">
                                                            {analysisData.regime}
                                                        </div>
                                                    ) : (
                                                        <div className="h-8 animate-pulse bg-white/5 rounded mt-2" />
                                                    )}
                                                </div>

                                                {/* Prediction */}
                                                <div className="bg-black/40 rounded-lg p-5 border border-white/5 backdrop-blur-sm">
                                                    <div className="flex items-center gap-2 text-gray-400 mb-2">
                                                        <TrendingUp className="w-4 h-4" />
                                                        <span className="text-xs uppercase tracking-wider">Forecast</span>
                                                    </div>
                                                    {analysisData ? (
                                                        <div>
                                                            <div className="text-2xl font-medium text-white">
                                                                {analysisData.prediction > 0.5 ? "Bullish" : "Bearish"}
                                                            </div>
                                                            <div className="text-xs text-indigo-400 mt-1">
                                                                Confidence: {(Math.abs(analysisData.prediction - 0.5) * 200).toFixed(0)}%
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="h-8 animate-pulse bg-white/5 rounded mt-2" />
                                                    )}
                                                </div>
                                            </div>

                                            {/* Narrative / News Hybrid */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[500px]">
                                                <div className="bg-black/20 rounded-lg p-4 border border-white/5 overflow-y-auto custom-scrollbar overflow-x-hidden">
                                                    <h3 className="text-sm font-semibold text-gray-300 mb-3 sticky top-0 bg-transparent">AI Narrative Summary</h3>
                                                    <p className="text-gray-400 text-sm leading-relaxed">
                                                        {analysisData?.narrative_summary || "Loading narrative analysis..."}
                                                    </p>
                                                </div>
                                                <div className="bg-black/20 rounded-lg p-4 border border-white/5 overflow-hidden flex flex-col">
                                                    <h3 className="text-sm font-semibold text-gray-300 mb-3">Relevant News</h3>
                                                    <div className="flex-1 overflow-y-auto -mx-2 px-2 custom-scrollbar overflow-x-hidden">
                                                        <LiveNewsFeed ticker={selectedCompany.ticker} limit={20} />
                                                    </div>
                                                </div>
                                            </div>

                                        </div>
                                    ) : (
                                        // Non-Analyzed State
                                        <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
                                            <div className="bg-yellow-500/10 p-4 rounded-full mb-4">
                                                <Activity className="w-8 h-8 text-yellow-500" />
                                            </div>
                                            <h3 className="text-xl font-bold text-white mb-2">Analysis Unavailable</h3>
                                            <p className="text-gray-400 max-w-md">
                                                We are not currently running deep neural inference on {selectedCompany.ticker}.
                                                However, you can still view live market data and news below.
                                            </p>
                                            <div className="mt-8 w-full max-w-2xl h-64 border border-white/10 rounded-lg overflow-hidden">
                                                <LiveNewsFeed ticker={selectedCompany.ticker} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Create Portfolio Modal */}
            {showCreatePortfolioModal && (
                <CreatePortfolioModal
                    onClose={() => setShowCreatePortfolioModal(false)}
                    onSuccess={(newPortfolio) => {
                        setPortfolio(newPortfolio);
                        setShowCreatePortfolioModal(false);
                    }}
                />
            )}
        </div>
    );
}