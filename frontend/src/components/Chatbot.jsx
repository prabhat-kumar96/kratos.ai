import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, User } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../lib/axios";
import { motion, AnimatePresence } from "framer-motion";

export default function Chatbot() {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { role: "bot", content: "Hello! I'm Aletheia AI. Ask me about market data or narratives." }
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
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
        setInput("");
        setLoading(true);

        try {
            // Call our Node backend proxy
            const { data } = await api.post("/chat", {
                query: userMessage.content,
                ticker: null // Optional: extract ticker if possible, or let backend handle
            });

            const botMessage = { role: "bot", content: data.data.response };
            setMessages((prev) => [...prev, botMessage]);
        } catch (error) {
            console.error("Chat error:", error);
            setMessages((prev) => [...prev, { role: "bot", content: "Sorry, I encountered an error connecting to the AI service." }]);
        } finally {
            setLoading(false);
        }
    };

    if (!user) return null;

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-[380px] h-[500px] mb-4 overflow-hidden pointer-events-auto flex flex-col"
                    >
                        {/* Header */}
                        <div className="bg-gray-800/50 backdrop-blur-md p-4 flex items-center justify-between border-b border-gray-800">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-blue-600/20 rounded-lg">
                                    <Bot className="w-5 h-5 text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-white">Aletheia AI</h3>
                                    <p className="text-xs text-gray-400">Market Intelligence Agent</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 hover:bg-gray-700 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-950/50">
                            {messages.map((msg, idx) => (
                                <div
                                    key={idx}
                                    className={`flex w-full ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                                >
                                    <div
                                        className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed ${msg.role === "user"
                                                ? "bg-blue-600 text-white rounded-br-none"
                                                : "bg-gray-800 text-gray-200 rounded-bl-none border border-gray-700"
                                            }`}
                                    >
                                        <div className="whitespace-pre-wrap">{msg.content}</div>
                                    </div>
                                </div>
                            ))}
                            {loading && (
                                <div className="flex justify-start">
                                    <div className="bg-gray-800 p-3 rounded-2xl rounded-bl-none border border-gray-700">
                                        <div className="flex gap-1">
                                            <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
                                            <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-100" />
                                            <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-200" />
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div className="p-4 bg-gray-900 border-t border-gray-800">
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
                                    placeholder="Ask about market data..."
                                    className="flex-1 bg-gray-800 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600/50 border border-gray-700 placeholder:text-gray-500"
                                />
                                <button
                                    type="submit"
                                    disabled={loading || !input.trim()}
                                    className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </form>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Toggle Button */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(!isOpen)}
                className="pointer-events-auto p-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-lg shadow-blue-600/20 transition-all"
            >
                {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
            </motion.button>
        </div>
    );
}