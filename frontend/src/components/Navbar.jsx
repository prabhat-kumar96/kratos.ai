import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LogOut, User, Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "../lib/utils";

function Navbar() {
    const { user, logout } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const location = useLocation();

    const isLanding = location.pathname === "/";
    // Sticky navbar state
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <nav className={cn(
            "fixed top-0 w-full z-50 transition-all duration-300",
            isLanding
                ? scrolled
                    ? "bg-gray-950/80 backdrop-blur-md border-b border-white/10"
                    : "bg-transparent"
                : "bg-gray-950 border-b border-white/10"
        )}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    <div className="flex items-center">
                        <Link to="/" className="flex-shrink-0 flex items-center">
                            <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">Aletheia AI</span>
                        </Link>
                    </div>

                    <div className="hidden sm:ml-6 sm:flex sm:items-center space-x-4">
                        {!user ? (
                            <>
                                <Link to="/login" className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors">
                                    Login
                                </Link>
                                <Link to="/signup" className="bg-indigo-600 text-white hover:bg-indigo-500 px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-lg shadow-indigo-500/20">
                                    Get Started
                                </Link>
                            </>
                        ) : (
                            <div className="flex items-center space-x-4">
                                <div className="flex items-center space-x-2 text-gray-300">
                                    <User size={18} />
                                    <span className="text-sm font-medium">{user.username} ({user.role})</span>
                                </div>
                                <button onClick={logout} className="text-gray-400 hover:text-red-400 transition-colors">
                                    <LogOut size={20} />
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="-mr-2 flex items-center sm:hidden">
                        <button
                            onClick={() => setIsOpen(!isOpen)}
                            className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white focus:outline-none"
                        >
                            {isOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile menu */}
            {isOpen && (
                <div className="sm:hidden bg-gray-900 border-b border-white/10">
                    <div className="pt-2 pb-3 space-y-1">
                        {!user ? (
                            <>
                                <Link to="/login" className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-white/5">Login</Link>
                                <Link to="/signup" className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-white/5">Get Started</Link>
                            </>
                        ) : (
                            <button onClick={logout} className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-500 hover:bg-red-500/10">
                                Logout
                            </button>
                        )}
                    </div>
                </div>
            )}
        </nav>
    );
}

export default Navbar;