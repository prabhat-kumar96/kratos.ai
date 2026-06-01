import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function PublicRoute() {
    const { user, loading } = useAuth();

    if (loading) return null; // Or a spinner

    if (user) {
        // Redirect based on role
        if (user.role === 'Startup' || user.role === 'founder') {
            return <Navigate to="/dashboard/startup" replace />;
        } else {
            return <Navigate to="/dashboard/investor" replace />;
        }
    }

    return <Outlet />;
}