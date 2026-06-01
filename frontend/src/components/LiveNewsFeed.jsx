import { useState, useEffect } from 'react';
import axios from 'axios';
import { Newspaper, ExternalLink, RefreshCw, AlertCircle } from 'lucide-react';

export default function LiveNewsFeed({ ticker }) {
    const [news, setNews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchNews = async () => {
        setLoading(true);
        setError(null);
        try {
            // Updated URL to match the backend route registration
            const response = await axios.get(`http://localhost:8000/api/v1/news/${ticker}`);
            setNews(response.data.news);
        } catch (err) {
            console.error("Failed to load news", err);
            setError("Could not load live news feed.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (ticker) {
            fetchNews();
        }
    }, [ticker]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500 animate-pulse">
                <Newspaper className="w-8 h-8 mb-2 opacity-50" />
                <p>Scanning global news wires...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-red-400">
                <AlertCircle className="w-8 h-8 mb-2" />
                <p>{error}</p>
                <button onClick={fetchNews} className="mt-2 text-sm underline hover:text-red-300">
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-gray-900/50 rounded-xl border border-white/10 overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Newspaper className="w-5 h-5 text-indigo-400" />
                    Live Market News
                </h3>
                <button onClick={fetchNews} className="text-gray-400 hover:text-white transition-colors">
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-3 custom-scrollbar">
                {news.map((item) => (
                    <div key={item.id} className="bg-gray-800/50 p-4 rounded-lg border border-white/5 hover:bg-gray-800 transition-colors group">
                        <div className="flex justify-between items-start gap-4">
                            <h4 className="text-white font-medium leading-snug group-hover:text-indigo-300 transition-colors">
                                {item.headline}
                            </h4>
                            <span className={`
                                text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold shrink-0
                                ${item.sentiment === 'Positive' ? 'bg-green-500/20 text-green-400' :
                                    item.sentiment === 'Negative' ? 'bg-red-500/20 text-red-400' :
                                        'bg-gray-500/20 text-gray-400'}
                            `}>
                                {item.sentiment}
                            </span>
                        </div>
                        <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                                {item.source} • {new Date(item.published_at).toLocaleDateString()}
                            </span>
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    </div>
                ))}
            </div>

            <div className="p-3 bg-indigo-900/10 border-t border-indigo-500/20 text-center">
                <p className="text-xs text-indigo-300/60">
                    Real-time aggregation from authorized financial sources.
                </p>
            </div>
        </div>
    );
}