import { motion } from "framer-motion";
import { BarChart3, ShieldCheck, Zap } from "lucide-react";
import { GlassCard } from "../ui/GlassCard";

export default function ProcessFlow() {
    const steps = [
        { icon: Zap, title: "Ingest Data", desc: "Real-time processing of heterogeneous financial data." },
        { icon: ShieldCheck, title: "Analyze Reliability", desc: "Engine computes time-varying reliability scores." },
        { icon: BarChart3, title: "Visualize Uncertainty", desc: "Trust scores displayed alongside data." }
    ];

    return (
        <div className="py-24 sm:py-32 relative z-10 overflow-hidden">
            {/* Background "Pipeline" */}
            <div className="absolute top-1/2 left-0 w-full h-2 bg-gray-800 -translate-y-1/2 hidden md:block">
                <motion.div
                    className="h-full bg-cyan-500 shadow-[0_0_20px_#06b6d4]"
                    initial={{ width: "0%" }}
                    whileInView={{ width: "100%" }}
                    transition={{ duration: 3, ease: "linear", repeat: Infinity }}
                />
            </div>

            <div className="mx-auto max-w-7xl px-6 lg:px-8 relative">
                <div className="mx-auto max-w-2xl lg:text-center mb-16">
                    <h2 className="text-base font-semibold leading-7 text-indigo-400">How It Works</h2>
                    <p className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                        Reliability as a Service
                    </p>
                </div>
                <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                    {steps.map((item, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 50 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.2, duration: 0.5 }}
                            viewport={{ once: true }}
                            className="relative"
                        >
                            <GlassCard className="p-8 h-full border-t-4 border-t-cyan-500">
                                <div className="inline-flex items-center justify-center p-3 bg-indigo-900/50 rounded-xl text-cyan-400 mb-6 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                                    <item.icon size={28} />
                                </div>
                                <h3 className="text-xl font-semibold text-white mb-3">{item.title}</h3>
                                <p className="text-gray-400 leading-relaxed">{item.desc}</p>
                            </GlassCard>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
}