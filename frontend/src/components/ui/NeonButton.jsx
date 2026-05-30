import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

export function NeonButton({ children, className, variant = "primary", ...props }) {
    const variants = {
        primary: "bg-indigo-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.5)] hover:bg-indigo-500 hover:shadow-[0_0_30px_rgba(79,70,229,0.8)]",
        secondary: "bg-transparent text-white border border-indigo-500/50 shadow-[0_0_10px_rgba(79,70,229,0.2)] hover:bg-indigo-500/20 hover:border-indigo-500",
        cyan: "bg-cyan-500 text-black font-bold shadow-[0_0_20px_rgba(6,182,212,0.6)] hover:bg-cyan-400 hover:shadow-[0_0_30px_rgba(6,182,212,0.9)]"
    };

    return (
        <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={cn(
                "relative rounded-md px-6 py-3 text-sm font-semibold transition-all duration-300",
                variants[variant],
                className
            )}
            {...props}
        >
            {children}
        </motion.button>
    );
}