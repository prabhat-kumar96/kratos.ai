import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { GradientButton } from "../ui/GradientButton";

export default function HeroSection() {
    return (
        <div className="relative isolate px-6 pt-14 lg:px-8 z-10">
            <div className="mx-auto max-w-4xl py-32 sm:py-48 lg:py-56 text-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="hidden sm:mb-8 sm:flex sm:justify-center"
                >
                    <div className="relative rounded-full px-3 py-1 text-sm leading-6 text-gray-400 ring-1 ring-white/10 hover:ring-white/20">
                        Announcing our new reliability engine. <Link to="#" className="font-semibold text-indigo-400"><span className="absolute inset-0" aria-hidden="true"></span>Read more <span aria-hidden="true">&rarr;</span></Link>
                    </div>
                </motion.div>
                <motion.h1
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="text-4xl font-bold tracking-tight text-white sm:text-7xl"
                >
                    Financial intelligence that tells you when <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">insights can’t be trusted.</span>
                </motion.h1>
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                    className="mt-6 text-lg leading-8 text-gray-300"
                >
                    Modern markets generate drifting, unreliable data. Our platform makes uncertainty a first-class citizen, delivering unified latent representations to surface unseen risks before they impact your portfolio.
                </motion.p>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.6 }}
                    className="mt-10 flex items-center justify-center gap-x-6"
                >
                    <Link to="/signup">
                        <GradientButton variant="variant">
                            Get Started
                        </GradientButton>
                    </Link>
                    <Link to="/login" className="text-sm font-semibold leading-6 text-white hover:text-indigo-300 transition-colors">
                        Log in <span aria-hidden="true">→</span>
                    </Link>
                </motion.div>
            </div>

            {/* Massive Stats */}
            <div className="mx-auto max-w-7xl px-6 lg:px-8 pb-24">
                <dl className="grid grid-cols-1 gap-x-8 gap-y-16 text-center lg:grid-cols-3">
                    {[
                        { label: "Reliability Score", value: "99.9%" },
                        { label: "Data Points Analyzed", value: "10B+" },
                        { label: "Market Coverage", value: "Global" },
                    ].map((stat, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.2 + index * 0.1 }}
                            className="mx-auto flex max-w-xs flex-col gap-y-4"
                        >
                            <dt className="text-base leading-7 text-gray-400">{stat.label}</dt>
                            <dd className="order-first text-5xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-purple-400 to-cyan-300 sm:text-6xl">
                                {stat.value}
                            </dd>
                        </motion.div>
                    ))}
                </dl>
            </div>
        </div>
    );
}