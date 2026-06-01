import { motion } from "framer-motion";
import { Activity, BarChart3, ShieldCheck, Zap } from "lucide-react";
import { GlassCard } from "../ui/GlassCard";

export default function BentoGrid() {
    return (
        <div className="relative py-24 sm:py-32 overflow-hidden z-10">
            <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-10">
                <div className="mx-auto max-w-2xl lg:text-center text-white mb-16">
                    <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">Built for the Modern Market</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 grid-rows-2 gap-4 h-[400px]">

                    {/* Large Panel: Startups */}
                    <GlassCard className="col-span-1 md:col-span-2 row-span-2 p-8 flex flex-col justify-between group hover:border-indigo-500/50 transition-colors">
                        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Activity size={150} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-white mb-2">Startups</h3>
                            <p className="text-gray-400">Verify your asset reliability and secure top-tier funding.</p>
                        </div>
                        {/* Mock Graph Visual */}
                        <div className="mt-4 h-32 w-full bg-gradient-to-t from-indigo-500/20 to-transparent rounded-lg relative overflow-hidden">
                            <motion.div
                                className="absolute bottom-0 left-0 w-full h-1 bg-indigo-400 shadow-[0_0_10px_#818cf8]"
                                initial={{ width: "0%" }}
                                whileInView={{ width: "100%" }}
                                transition={{ duration: 2, ease: "easeInOut" }}
                            />
                            <svg className="absolute bottom-0 left-0 w-full h-full" preserveAspectRatio="none">
                                <motion.path
                                    d="M0,100 C50,80 100,90 150,60 S250,40 300,10"
                                    fill="none"
                                    stroke="#818cf8"
                                    strokeWidth="2"
                                    initial={{ pathLength: 0 }}
                                    whileInView={{ pathLength: 1 }}
                                    transition={{ duration: 2, ease: "easeInOut" }}
                                />
                            </svg>
                        </div>
                    </GlassCard>

                    {/* Small Panel: Asset Verification */}
                    <GlassCard className="col-span-1 md:col-span-1 min-h-[180px] p-6 flex flex-col items-center justify-center text-center hover:bg-white/10 transition-colors shadow-[0_0_25px_rgba(6,182,212,0.15)] border-cyan-500/20">
                        <ShieldCheck className="w-10 h-10 text-cyan-400 mb-3" />
                        <h4 className="text-lg font-semibold text-white">Asset Verification</h4>
                    </GlassCard>

                    {/* Small Panel: Drift Detection */}
                    <GlassCard className="col-span-1 md:col-span-1 min-h-[180px] p-6 flex flex-col items-center justify-center text-center hover:bg-white/10 transition-colors shadow-[0_0_25px_rgba(234,179,8,0.15)] border-yellow-500/20">
                        <Zap className="w-10 h-10 text-yellow-400 mb-3" />
                        <h4 className="text-lg font-semibold text-white">Drift Detection</h4>
                    </GlassCard>

                    {/* Large Panel: Investors */}
                    <GlassCard className="col-span-1 md:col-span-2 row-span-2 p-8 flex flex-col justify-between group hover:border-cyan-500/50 transition-colors">
                        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                            <BarChart3 size={150} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-white mb-2">Investors</h3>
                            <p className="text-gray-400">Filter noise and detect regime shifts before they happen.</p>
                        </div>
                        <div className="mt-4 flex items-center justify-center h-full">
                            <div className="relative w-24 h-24 rounded-full border-2 border-cyan-500/30 flex items-center justify-center animate-pulse">
                                <div className="absolute w-full h-full rounded-full border border-cyan-400 animate-ping opacity-20"></div>
                                <ShieldCheck className="w-10 h-10 text-cyan-400" />
                            </div>
                        </div>
                    </GlassCard>
                </div>
            </div>
        </div>
    );
}