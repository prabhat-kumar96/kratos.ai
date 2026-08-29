import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, Maximize2, Copy, Check, Sparkles, ChevronRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../lib/axios";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function Chatbot() {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { role: "bot", content: "Hello! I'm KratosAI. Ask me about market data or narratives." }
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [expandedMessage, setExpandedMessage] = useState(null);
    const [copied, setCopied] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMessage = { role: "user", content: input };
        setMessages((prev) => [...prev, userMessage]);
        const currentQuery = input;
        setInput("");
        setLoading(true);

        try {
            // Call our Node backend proxy
            const { data } = await api.post("/chat", {
                query: currentQuery,
                ticker: null // Optional: extract ticker if possible, or let backend handle
            });

            const botMessage = { 
                role: "bot", 
                content: data.data.response,
                query: currentQuery
            };
            setMessages((prev) => [...prev, botMessage]);
        } catch (error) {
            console.error("Chat error:", error);
            setMessages((prev) => [...prev, { role: "bot", content: "Sorry, I encountered an error connecting to the AI service." }]);
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = (text) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!user) return null;

    return (
        <>
            {/* ---------------- CHAT WIDGET ---------------- */}
            <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none">
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-[400px] sm:w-[440px] h-[540px] mb-4 overflow-hidden pointer-events-auto flex flex-col"
                        >
                            {/* Header */}
                            <div className="bg-gray-800/80 backdrop-blur-md p-4 flex items-center justify-between border-b border-gray-800">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-indigo-600/20 rounded-lg border border-indigo-500/30">
                                        <Bot className="w-5 h-5 text-indigo-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-white tracking-tight flex items-center gap-1.5">
                                            KratosAI
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono">Agent</span>
                                        </h3>
                                        <p className="text-xs text-gray-400">Market Intelligence & Neural Analytics</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-1 hover:bg-gray-700 rounded-full transition-colors text-gray-400 hover:text-white"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Messages List */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-950/70 custom-scrollbar">
                                {messages.map((msg, idx) => {
                                    const hasTable = msg.content && (msg.content.includes('|') || msg.content.length > 250);
                                    return (
                                        <div
                                            key={idx}
                                            className={`flex w-full ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                                        >
                                            <div
                                                className={`max-w-[90%] p-3.5 rounded-2xl text-sm leading-relaxed ${msg.role === "user"
                                                        ? "bg-indigo-600 text-white rounded-br-none shadow-md"
                                                        : "bg-gray-800/90 text-gray-200 rounded-bl-none border border-gray-700/60 shadow-lg"
                                                    }`}
                                            >
                                                {msg.role === "user" ? (
                                                    <div className="whitespace-pre-wrap">{msg.content}</div>
                                                ) : (
                                                    <div>
                                                        <div className="prose prose-invert prose-sm max-w-none overflow-x-auto text-gray-200 leading-relaxed">
                                                            <ReactMarkdown 
                                                                remarkPlugins={[remarkGfm]}
                                                                components={{
                                                                    table: ({node, ...props}) => (
                                                                        <div className="overflow-x-auto my-2 rounded-lg border border-white/10">
                                                                            <table className="min-w-full text-xs text-left divide-y divide-white/10" {...props} />
                                                                        </div>
                                                                    ),
                                                                    thead: ({node, ...props}) => (
                                                                        <thead className="bg-indigo-950/70 text-indigo-300 font-semibold" {...props} />
                                                                    ),
                                                                    th: ({node, ...props}) => (
                                                                        <th className="px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap" {...props} />
                                                                    ),
                                                                    td: ({node, ...props}) => (
                                                                        <td className="px-2.5 py-1.5 font-mono text-xs border-t border-white/5 whitespace-nowrap" {...props} />
                                                                    ),
                                                                    p: ({node, ...props}) => (
                                                                        <p className="mb-2 last:mb-0 leading-relaxed" {...props} />
                                                                    ),
                                                                    ul: ({node, ...props}) => (
                                                                        <ul className="list-disc pl-4 space-y-1 my-1.5" {...props} />
                                                                    ),
                                                                    ol: ({node, ...props}) => (
                                                                        <ol className="list-decimal pl-4 space-y-1 my-1.5" {...props} />
                                                                    ),
                                                                    strong: ({node, ...props}) => (
                                                                        <strong className="text-indigo-300 font-semibold" {...props} />
                                                                    )
                                                                }}
                                                            >
                                                                {msg.content}
                                                            </ReactMarkdown>
                                                        </div>

                                                        {/* Open in Fullscreen Analysis Card Button */}
                                                        {hasTable && (
                                                            <button
                                                                onClick={() => setExpandedMessage(msg)}
                                                                className="mt-3 w-full flex items-center justify-center gap-1.5 bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 hover:text-indigo-200 text-xs font-medium py-1.5 px-3 rounded-lg transition-all"
                                                            >
                                                                <Maximize2 className="w-3.5 h-3.5" />
                                                                <span>View in Full Analysis Card</span>
                                                                <ChevronRight className="w-3.5 h-3.5 ml-auto" />
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                                {loading && (
                                    <div className="flex justify-start">
                                        <div className="bg-gray-800/90 p-3 rounded-2xl rounded-bl-none border border-gray-700">
                                            <div className="flex items-center gap-2 text-xs text-indigo-400">
                                                <Sparkles className="w-4 h-4 animate-spin text-indigo-400" />
                                                <span>Analyzing market tensors & metrics...</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input Field */}
                            <div className="p-3 bg-gray-900 border-t border-gray-800">
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        handleSend();
                                    }}
                                    className="flex gap-2"
                                >
                                    <input
                                        type="text"
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        placeholder="Ask about metrics, RSI, MACD, or compare tickers..."
                                        className="flex-1 bg-gray-800/90 text-white text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 border border-gray-700 placeholder:text-gray-500"
                                    />
                                    <button
                                        type="submit"
                                        disabled={loading || !input.trim()}
                                        className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-indigo-500/20"
                                    >
                                        <Send className="w-4 h-4" />
                                    </button>
                                </form>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Floating Launcher Button */}
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsOpen(!isOpen)}
                    className="pointer-events-auto p-4 bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white rounded-full shadow-xl shadow-indigo-500/30 transition-all border border-white/10 flex items-center justify-center"
                >
                    {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
                </motion.button>
            </div>

            {/* ---------------- EXPANDED ANALYSIS CARD MODAL DIALOG ---------------- */}
            <AnimatePresence>
                {expandedMessage && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-10 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 15 }}
                            className="bg-gray-900 border border-indigo-500/30 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-white"
                        >
                            {/* Modal Header */}
                            <div className="bg-gradient-to-r from-gray-900 via-indigo-950/40 to-gray-900 p-5 border-b border-white/10 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-indigo-600/20 border border-indigo-500/30 rounded-xl text-indigo-400">
                                        <Bot className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-lg font-bold text-white tracking-tight">KratosAI Intelligence Report</h2>
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium">
                                                Verified Analysis
                                            </span>
                                        </div>
                                        {expandedMessage.query && (
                                            <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                                                Query: <span className="text-gray-200 italic font-normal">"{expandedMessage.query}"</span>
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleCopy(expandedMessage.content)}
                                        className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                                        title="Copy response"
                                    >
                                        {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                                        <span>{copied ? "Copied" : "Copy"}</span>
                                    </button>
                                    <button
                                        onClick={() => setExpandedMessage(null)}
                                        className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Modal Body with Full High-Definition Typography & Formatted Tables */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-gray-950/80">
                                <div className="prose prose-invert prose-base max-w-none text-gray-200 leading-relaxed">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            table: ({node, ...props}) => (
                                                <div className="overflow-x-auto my-4 rounded-xl border border-indigo-500/20 shadow-lg bg-gray-900/60">
                                                    <table className="min-w-full text-sm text-left divide-y divide-white/10" {...props} />
                                                </div>
                                            ),
                                            thead: ({node, ...props}) => (
                                                <thead className="bg-indigo-950/80 text-indigo-300 font-semibold text-xs uppercase tracking-wider" {...props} />
                                            ),
                                            th: ({node, ...props}) => (
                                                <th className="px-4 py-3.5 font-semibold text-indigo-200 border-b border-indigo-500/20" {...props} />
                                            ),
                                            td: ({node, ...props}) => (
                                                <td className="px-4 py-3 font-mono text-sm border-t border-white/5 text-gray-200 hover:bg-white/5 transition-colors" {...props} />
                                            ),
                                            p: ({node, ...props}) => (
                                                <p className="mb-4 leading-relaxed text-gray-300" {...props} />
                                            ),
                                            h1: ({node, ...props}) => (
                                                <h1 className="text-2xl font-bold text-white mt-4 mb-2 pb-2 border-b border-white/10 bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-300" {...props} />
                                            ),
                                            h2: ({node, ...props}) => (
                                                <h2 className="text-xl font-bold text-white mt-5 mb-2 pb-1 text-indigo-300" {...props} />
                                            ),
                                            h3: ({node, ...props}) => (
                                                <h3 className="text-lg font-semibold text-white mt-4 mb-2 text-cyan-300" {...props} />
                                            ),
                                            ul: ({node, ...props}) => (
                                                <ul className="list-disc pl-6 space-y-2 my-3 text-gray-300" {...props} />
                                            ),
                                            ol: ({node, ...props}) => (
                                                <ol className="list-decimal pl-6 space-y-2 my-3 text-gray-300" {...props} />
                                            ),
                                            strong: ({node, ...props}) => (
                                                <strong className="text-indigo-300 font-semibold" {...props} />
                                            ),
                                            blockquote: ({node, ...props}) => (
                                                <blockquote className="border-l-4 border-indigo-500 pl-4 py-1.5 my-3 bg-indigo-500/10 rounded-r-lg text-gray-300 italic" {...props} />
                                            )
                                        }}
                                    >
                                        {expandedMessage.content}
                                    </ReactMarkdown>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="p-4 bg-gray-900 border-t border-white/10 flex items-center justify-between text-xs text-gray-400">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                    <span>Synthesized from Kratos AI Multi-Asset Dataframe & Earnings Transcripts</span>
                                </div>
                                <button
                                    onClick={() => setExpandedMessage(null)}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-1.5 rounded-lg transition-all shadow-md"
                                >
                                    Close Card
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}