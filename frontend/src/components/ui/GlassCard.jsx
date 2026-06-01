import { motion } from "framer-motion";
import { cn } from "../../lib/utils"; // Assuming utils exists or I'll create it. 
// If lib/utils doesn't exist, I'll use inline clsx/tailwind-merge. 
// Checking file list, lib exists.

export function GlassCard({ children, className, ...props }) {
    return (
        <motion.div
            className={cn(
                "relative overflow-hidden rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-2xl",
                "before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/10 before:to-transparent before:opacity-50 before:pointer-events-none",
                className
            )}
            {...props}
        >
            {children}
        </motion.div>
    );
}