import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ allowedRoles }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500 mr-3"></div>
                <span>Loading secure session...</span>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    const userRole = (user.role || "").toLowerCase();
    const normalizedAllowed = (allowedRoles || []).map(r => r.toLowerCase());

    if (allowedRoles && allowedRoles.length > 0 && !normalizedAllowed.includes(userRole)) {
        // Redirect to appropriate dashboard if logged in but wrong role
        const target = (userRole === 'founder' || userRole === 'startup') ? '/dashboard/startup' : '/dashboard/investor';
        return <Navigate to={target} replace />;
    }

    return <Outlet />;
}