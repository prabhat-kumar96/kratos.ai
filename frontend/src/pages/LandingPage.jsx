import { Link } from "react-router-dom";
import ParticleBackground from "../components/landing/ParticleBackground";
import HeroSection from "../components/landing/HeroSection";
import BentoGrid from "../components/landing/BentoGrid";
import ProcessFlow from "../components/landing/ProcessFlow";
import { FooterSection } from "../components/ui/FooterSection";

export default function LandingPage() {
    return (
        <div className="bg-black min-h-screen font-sans selection:bg-cyan-500/30">
            {/* Background Layer */}
            <div className="fixed inset-0 z-0">
                <ParticleBackground />

                {/* 1. Atmospheric "Ceiling" Lighting */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#7c3aed]/40 via-[#7c3aed]/10 to-transparent blur-3xl pointer-events-none"></div>

                {/* 2. Perspective Grid */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" style={{ transform: 'perspective(1000px) rotateX(20deg) scale(1.2)', transformOrigin: 'top center' }}></div>

                {/* 3. Depth Elements (Orbs) */}
                <div className="absolute top-20 left-20 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none"></div>
                <div className="absolute top-40 right-20 w-80 h-80 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none"></div>

                {/* Vignette Overlays */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gray-950/20 to-gray-950 pointer-events-none"></div>
            </div>

            {/* Content Layer */}
            <div className="relative z-10 flex flex-col min-h-screen">

                <main className="flex-grow">
                    <HeroSection />
                    <BentoGrid />
                    <ProcessFlow />
                </main>

                {/* Footer */}
                <FooterSection />
            </div>
        </div>
    );
}