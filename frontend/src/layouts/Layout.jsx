import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar";

export default function Layout() {
    return (
        <div className="min-h-screen bg-gray-950 text-gray-100 font-sans antialiased selection:bg-indigo-500/30">
            <Navbar />
            <main>
            <Outlet />
            </main>
        </div>
    );
}