import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import userRouter from './routes/user.routes.js'
import chatRouter from './routes/chat.routes.js'
import newsRouter from './routes/news.routes.js'
import extensionRouter from './routes/extension.routes.js'

const app = express()

// ---------------------------------------------------------------------------
// CORS Configuration
// CORS_ORIGIN env var accepts a comma-separated list of allowed origins.
// Example: "https://kratos-ai.vercel.app,http://localhost:5173"
// For local dev only, set CORS_ORIGIN=* and credentials handling is skipped.
// ---------------------------------------------------------------------------
const buildAllowedOrigins = () => {
    const base = [
        'http://localhost:5173', // Vite dev server
        'http://localhost:3001', // Docker compose frontend
    ];
    const envVal = process.env.CORS_ORIGIN || '';
    if (envVal === '*') return '*'; // wildcard (dev only — cookies won't work)
    const fromEnv = envVal
        .split(',')
        .map(o => o.trim())
        .filter(Boolean);
    return [...new Set([...base, ...fromEnv])];
};

const allowedOrigins = buildAllowedOrigins();

app.use(cors({
    origin: function (origin, callback) {
        // Allow server-to-server and curl requests (no Origin header)
        if (!origin) return callback(null, true);

        // Always allow Chrome extension requests
        if (origin.startsWith('chrome-extension://')) {
            return callback(null, true);
        }

        // Wildcard mode (dev only — credentials won't work with this)
        if (allowedOrigins === '*') return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS: origin '${origin}' not allowed`));
        }
    },
    credentials: true,   // Required for cookie-based auth (withCredentials: true)
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Set-Cookie'],
}))

// Health check endpoint (used by Render for liveness probing)
app.get('/api/v1/health', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'kratos-backend' });
});

app.use(express.json({ limit: "1mb" }))
app.use(express.urlencoded({ extended: true, limit: "1mb" }))
app.use(express.static("public"))
app.use(cookieParser())

app.use("/api/v1/users", userRouter)
app.use("/api/v1/chat", chatRouter)
app.use("/api/v1/news", newsRouter)
app.use("/api", extensionRouter)

import { errorMiddleware } from "./middlewares/error.middleware.js"
app.use(errorMiddleware)

export { app }