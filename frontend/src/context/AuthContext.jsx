import { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api, { setAccessToken } from "../lib/axios";
import { jwtDecode } from "jwt-decode";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    // Helper to decode token and set user state
    const handleToken = (accessToken) => {
        setAccessToken(accessToken);
        try {
            const decoded = jwtDecode(accessToken);
            // Verify what's in the token. Based on user model:
            // { _id, email, username, role }
            setUser(decoded);
            return decoded;
        } catch (error) {
            console.error("Invalid token", error);
            setUser(null);
            return null;
        }
    };

    // Check auth on mount (refresh token flow)
    useEffect(() => {
        const checkAuth = async () => {
            try {
                // Try to get a new access token using the HttpOnly refresh cookie
                const { data } = await api.post("/users/refresh-token");
                handleToken(data.data.accessToken);
            } catch (error) {
                // If refresh fails, user is not logged in
                console.log("Not authenticated", error);
                setUser(null);
            } finally {
                setLoading(false);
            }
        };

        checkAuth();
    }, []);

    const login = async (credentials) => {
        try {
            const { data } = await api.post("/users/login", credentials);
            const decodedUser = handleToken(data.data.accessToken);

            // Navigate based on role (Case Insensitive)
            const role = decodedUser?.role?.toLowerCase();
            if (role === "startup" || role === "founder") {
                navigate("/dashboard/startup");
            } else {
                // Default to investor for safety
                navigate("/dashboard/investor");
            }

            return data;
        } catch (error) {
            throw error; // Let the component handle the error display
        }
    };

    const googleLogin = async (credential) => {
        try {
            const { data } = await api.post("/users/google", { credential });
            const decodedUser = handleToken(data.data.accessToken);

            // Navigate based on role (Case Insensitive)
            const role = decodedUser?.role?.toLowerCase();
            if (role === "startup" || role === "founder") {
                navigate("/dashboard/startup");
            } else {
                navigate("/dashboard/investor");
            }
            return data;
        } catch (error) {
            throw error;
        }
    };

    const signup = async (userData) => {
        try {
            const { data } = await api.post("/users/register", userData);
            // Note: Register usually doesn't auto-login in some APIs, but often does.
            // If the backend returns tokens on register, we can login immediately.
            // Looking at user.controller.js: registerUser returns "createdUser" BUT NO TOKENS.
            // So we must redirect to login or auto-login.
            // Let's assume we redirect to login for now as per typical security flow.
            navigate("/login");
            return data;
        } catch (error) {
            throw error;
        }
    };

    const logout = async () => {
        try {
            await api.post("/users/logout");
        } catch (error) {
            console.error("Logout failed", error);
        } finally {
            setAccessToken(null);
            setUser(null);
            navigate("/login");
        }
    };

    return (
        <AuthContext.Provider value={{ user, login, signup, logout, googleLogin, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);