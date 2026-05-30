import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, TrendingUp, TrendingDown, Wallet, DollarSign, PieChart, Activity, Trash2, ShoppingCart, Briefcase } from 'lucide-react';
import BuyModal from '../../components/BuyModal';
import SellModal from '../../components/SellModal';
import HoldingsTable from '../../components/HoldingsTable';

export default function PortfolioDashboard() {
    const navigate = useNavigate();
    const [portfolio, setPortfolio] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Company list and buy modal states
    const [companies, setCompanies] = useState([]);
    const [loadingCompanies, setLoadingCompanies] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [showBuyModal, setShowBuyModal] = useState(false);

    // Holdings states
    const [holdings, setHoldings] = useState([]);
    const [loadingHoldings, setLoadingHoldings] = useState(false);
    const [activeTab, setActiveTab] = useState('holdings'); // 'holdings' or 'market'

    // Sell modal states
    const [selectedHolding, setSelectedHolding] = useState(null);
    const [showSellModal, setShowSellModal] = useState(false);

    useEffect(() => {
        fetchPortfolio();
        fetchCompanies();
        fetchHoldings();
    }, []);

    const fetchPortfolio = async () => {
        try {
            const response = await axios.get('http://localhost:8000/api/v1/portfolio', {
                withCredentials: true
            });
            setPortfolio(response.data.portfolio);
        } catch (err) {
            console.error('Failed to fetch portfolio:', err);
            setError(err.response?.data?.message || 'Failed to load portfolio');
        } finally {
            setLoading(false);
        }
    };

    const fetchCompanies = async () => {
        setLoadingCompanies(true);
        try {
            const response = await axios.get('http://localhost:8000/api/intelligence/tickers');
            setCompanies(response.data || []);
        } catch (err) {
            console.error('Failed to fetch companies:', err);
        } finally {
            setLoadingCompanies(false);
        }
    };

    const fetchHoldings = async () => {
        setLoadingHoldings(true);
        try {
            const response = await axios.get('http://localhost:8000/api/v1/holdings', {
                withCredentials: true
            });
            setHoldings(response.data.holdings || []);
        } catch (err) {
            console.error('Failed to fetch holdings:', err);
        } finally {
            setLoadingHoldings(false);
        }
    };

    const handleDeletePortfolio = async () => {
        setDeleting(true);
        try {
            await axios.delete('http://localhost:8000/api/v1/portfolio', {
                withCredentials: true
            });

            // Redirect to dashboard after successful deletion
            navigate('/dashboard/investor');
        } catch (err) {
            console.error('Failed to delete portfolio:', err);
            alert(err.response?.data?.message || 'Failed to delete portfolio');
        } finally {
            setDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    const handleBuyClick = (company) => {
        setSelectedCompany(company);
        setShowBuyModal(true);
    };

    const handleBuySuccess = async (orderData) => {
        // Refresh portfolio and holdings to update balances and positions
        await fetchPortfolio();
        await fetchHoldings();
        // Switch to holdings tab to show the new purchase
        setActiveTab('holdings');
        console.log('Purchase successful:', orderData);
    };

    const handleSellClick = (holding) => {
        setSelectedHolding(holding);
        setShowSellModal(true);
    };

    const handleSellSuccess = async (orderData) => {
        // Refresh portfolio and holdings after sale
        await fetchPortfolio();
        await fetchHoldings();
        console.log('Sale successful:', orderData);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
                <Activity className="w-8 h-8 animate-spin text-indigo-500 mr-2" />
                Loading Portfolio...
            </div>
        );
    }

    if (error || !portfolio) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white p-6">
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-2">No Portfolio Found</h2>
                    <p className="text-gray-400 mb-4">{error || 'Create a portfolio to start trading'}</p>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="bg-indigo-600 hover:bg-indigo-500 px-6 py-2 rounded-lg transition-colors"
                    >
                        Go to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    const { summary } = portfolio;

    return (
        <div className="min-h-screen bg-gray-950 p-6 pt-24 text-white">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <button
                            onClick={() => navigate('/dashboard/investor')}
                            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4 group"
                        >
                            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                            Back to Market Overview
                        </button>
                        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
                            {portfolio.name}
                        </h1>
                        <p className="text-gray-400 mt-1">Portfolio Dashboard</p>
                    </div>

                    {/* Delete Portfolio Button */}
                    <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 text-red-400 px-4 py-2 rounded-lg transition-all"
                    >
                        <Trash2 className="w-4 h-4" />
                        Delete Portfolio
                    </button>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {/* Total Value */}
                    <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-xl border border-indigo-500/20 p-6">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-gray-400 text-sm font-medium">Total Value</span>
                            <PieChart className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div className="text-3xl font-bold text-white">
                            ${summary.total_value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                    </div>

                    {/* Cash Balance */}
                    <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-xl border border-green-500/20 p-6">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-gray-400 text-sm font-medium">Cash Balance</span>
                            <Wallet className="w-5 h-5 text-green-400" />
                        </div>
                        <div className="text-3xl font-bold text-white">
                            ${portfolio.cash_balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                    </div>

                    {/* Invested Amount */}
                    <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-xl border border-blue-500/20 p-6">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-gray-400 text-sm font-medium">Invested</span>
                            <DollarSign className="w-5 h-5 text-blue-400" />
                        </div>
                        <div className="text-3xl font-bold text-white">
                            ${summary.invested_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                    </div>

                    {/* Total P&L */}
                    <div className={`bg-gradient-to-br rounded-xl border p-6 ${(summary.unrealized_pnl + summary.realized_pnl) >= 0
                        ? 'from-green-500/10 to-emerald-500/10 border-green-500/20'
                        : 'from-red-500/10 to-rose-500/10 border-red-500/20'
                        }`}>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-gray-400 text-sm font-medium">Total P&L</span>
                            {(summary.unrealized_pnl + summary.realized_pnl) >= 0
                                ? <TrendingUp className="w-5 h-5 text-green-400" />
                                : <TrendingDown className="w-5 h-5 text-red-400" />
                            }
                        </div>
                        <div className={`text-3xl font-bold ${(summary.unrealized_pnl + summary.realized_pnl) >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                            ${Math.abs(summary.unrealized_pnl + summary.realized_pnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                            {((summary.unrealized_pnl + summary.realized_pnl) / portfolio.initial_capital * 100).toFixed(2)}% return
                        </div>
                    </div>
                </div>

                {/* Tabs Section - Holdings & Market */}
                <div className="bg-gray-900/50 rounded-xl border border-white/5 overflow-hidden">
                    {/* Tab Headers */}
                    <div className="flex border-b border-white/5">
                        <button
                            onClick={() => setActiveTab('holdings')}
                            className={`flex-1 px-6 py-4 font-medium transition-all ${activeTab === 'holdings'
                                ? 'bg-white/5 text-white border-b-2 border-indigo-500'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <div className="flex items-center justify-center gap-2">
                                <Briefcase className="w-5 h-5" />
                                <span>Holdings</span>
                                {holdings.length > 0 && (
                                    <span className="bg-indigo-500/20 text-indigo-400 text-xs px-2 py-0.5 rounded-full">
                                        {holdings.length}
                                    </span>
                                )}
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('market')}
                            className={`flex-1 px-6 py-4 font-medium transition-all ${activeTab === 'market'
                                ? 'bg-white/5 text-white border-b-2 border-indigo-500'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <div className="flex items-center justify-center gap-2">
                                <ShoppingCart className="w-5 h-5" />
                                <span>Buy Stocks</span>
                            </div>
                        </button>
                    </div>

                    {/* Tab Content */}
                    {activeTab === 'holdings' ? (
                        <div>
                            <div className="p-4 bg-white/5 border-b border-white/5">
                                <h3 className="text-sm font-medium text-gray-300">Your Stock Positions</h3>
                            </div>
                            <HoldingsTable holdings={holdings} loading={loadingHoldings} onSell={handleSellClick} />
                        </div>
                    ) : (
                        <div>
                            <div className="p-4 bg-white/5 border-b border-white/5">
                                <h3 className="text-sm font-medium text-gray-300">Available Stocks</h3>
                                <p className="text-xs text-gray-400 mt-1">Click Buy to purchase stocks with your cash balance</p>
                            </div>
                            <div className="overflow-x-auto">
                                {loadingCompanies ? (
                                    <div className="p-12 text-center text-gray-500">
                                        <Activity className="w-8 h-8 mx-auto mb-2 animate-spin opacity-50" />
                                        Loading stocks...
                                    </div>
                                ) : companies.length === 0 ? (
                                    <div className="p-12 text-center text-gray-500">
                                        <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                        <p>No stocks available</p>
                                    </div>
                                ) : (
                                    <table className="w-full text-left">
                                        <thead className="bg-white/5 text-xs uppercase text-gray-400 font-medium">
                                            <tr>
                                                <th className="px-6 py-3">Ticker</th>
                                                <th className="px-6 py-3">Price</th>
                                                <th className="px-6 py-3">24h Change</th>
                                                <th className="px-6 py-3 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {companies.map((company) => (
                                                <tr key={company.ticker} className="hover:bg-white/5 transition-colors">
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
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            onClick={() => handleBuyClick(company)}
                                                            className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg transition-all text-sm font-medium"
                                                        >
                                                            Buy
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Buy Modal */}
                {showBuyModal && selectedCompany && (
                    <BuyModal
                        company={selectedCompany}
                        onClose={() => {
                            setShowBuyModal(false);
                            setSelectedCompany(null);
                        }}
                        onSuccess={handleBuySuccess}
                    />
                )}

                {/* Sell Modal */}
                {showSellModal && selectedHolding && (
                    <SellModal
                        holding={selectedHolding}
                        onClose={() => {
                            setShowSellModal(false);
                            setSelectedHolding(null);
                        }}
                        onSuccess={handleSellSuccess}
                    />
                )}

                {/* Delete Confirmation Modal */}
                {showDeleteConfirm && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-gray-900 rounded-xl border border-red-500/30 shadow-2xl max-w-md w-full p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                                    <Trash2 className="w-6 h-6 text-red-400" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white">Delete Portfolio</h3>
                                    <p className="text-sm text-gray-400">This action cannot be undone</p>
                                </div>
                            </div>

                            <p className="text-gray-300 mb-6">
                                Are you sure you want to delete <span className="font-semibold text-white">"{portfolio.name}"</span>?
                                All holdings and transaction history will be permanently removed.
                            </p>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowDeleteConfirm(false)}
                                    disabled={deleting}
                                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeletePortfolio}
                                    disabled={deleting}
                                    className="flex-1 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                                >
                                    {deleting ? 'Deleting...' : 'Delete Portfolio'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}