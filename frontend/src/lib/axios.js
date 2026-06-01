import axios from "axios";

// Create an Axios instance
// Check if VITE_API_URL is defined, otherwise fallback to localhost (useful for easy dev)
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

const api = axios.create({
    baseURL: BASE_URL,
    withCredentials: true, // Important: Send cookies (refresh token) with requests
});

// Request Interceptor: Attach Access Token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("accessToken");
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response Interceptor: Handle 401 & Token Refresh
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // If error is 401 and we haven't tried refreshing yet
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                // Call refresh endpoint
                // Note: We use a separate axios instance or the same one? 
                // Using the same one might be risky if we don't skip interceptors, 
                // but since /refresh-token doesn't need access token, it's okay IF we handle the loop.
                // However, safely, we want to just hit the endpoint. credentials are sent via cookie.
                const response = await axios.post(`${BASE_URL}/users/refresh-token`, {}, { withCredentials: true });

                const { accessToken } = response.data.data;

                // Update local storage (or memory)
                // In our design we are keeping it simple: localStorage or Memory. 
                // Implementation plan said "Add accessToken state (in memory)". 
                // BUT Axios interceptor needs access to it. 
                // Common pattern: Store in localStorage for Axios access, OR use a variable in this file.
                // Given the User Constraint: "Store access token securely (memory or state)" -> Memory is better but reload loses it.
                // "Persist login across page reloads" -> Requires Refresh Token. 
                // So: 
                // 1. Refresh Token is HttpOnly Cookie (Backend does this).
                // 2. Access Token in Memory (State/Context).
                // PROBLEM: Axios interceptor is outside React Context. How does it get the new token?
                // Solution: We can export a function `setAccessToken` or verify if we can just rely on the component re-render.
                // ACTUALLY: The standard way for "Memory Only" is to have a variable `let accessToken = ''` in this module 
                // and export `setAccessToken`.

                // Let's stick to the Plan: 
                // "Request Interceptor: Attach Authorization: Bearer <token>"
                // If we use Memory, we need to export a getter/setter or subscribe.

                // Let's use a simpler approach for now to ensure it works reliably:
                // We will use a closure variable for the token in this file.

                setAccessToken(accessToken);

                // Retry original request with new token
                originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                return api(originalRequest);

            } catch (refreshError) {
                // Refresh failed - force logout
                // Since we are outside React, we might need to redirect via window.location 
                // or dispatch an event that the Context listens to.
                // ideally:
                // setAccessToken(null);
                // window.location.href = "/login"; 
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

let _accessToken = null;

export const setAccessToken = (token) => {
    _accessToken = token;
    // We also sync with localStorage if we wanted standard persistent auth, 
    // but requirements say "Securely (memory)". 
    // BUT "Persist login across page reloads".
    // This implies on reload, we hit /refresh-token to get a new AccessToken.
};

export const getAccessToken = () => _accessToken;

// Re-configure interceptor to use the variable
api.interceptors.request.use(
    (config) => {
        if (_accessToken) {
            config.headers.Authorization = `Bearer ${_accessToken}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

export default api;