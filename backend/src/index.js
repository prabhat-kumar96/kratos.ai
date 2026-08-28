import connectDB from './db/index.js';
import { app } from './app.js'
import intelligenceRouter from './routes/intelligenceRoutes.js'
import portfolioRouter from './routes/portfolio.routes.js'
import orderRouter from './routes/order.routes.js'
import holdingRouter from './routes/holding.routes.js'
import startupRouter from './routes/startup.routes.js'
import dotenv from "dotenv"
dotenv.config({
    path: './.env'
})

import { createServer } from 'http';
import { Server } from 'socket.io';
import { createClient } from 'redis';

const server = createServer(app);

// Mirror the same CORS_ORIGIN list for Socket.io WebSocket transport
const socketOrigins = (process.env.CORS_ORIGIN || '*') === '*'
    ? '*'
    : [
        'http://localhost:5173',
        'http://localhost:3001',
        ...(process.env.CORS_ORIGIN || '').split(',').map(o => o.trim()).filter(Boolean),
    ];

const io = new Server(server, {
    cors: {
        origin: socketOrigins,
        methods: ["GET", "POST"],
        credentials: true,
    }
});

// Redis Subscriber — connects to Render Redis (internal URL via REDIS_URL env var)
// Local dev fallback: redis://localhost:6379 (or redis://redis:6379 with docker-compose)
const redisSubscriber = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisSubscriber.on('error', (err) => console.error('❌ Redis Subscriber Error:', err.message));

(async () => {
    try {
        await redisSubscriber.connect();
        await redisSubscriber.subscribe('market_updates', (message) => {
            // Broadcast the entire batch of ticker updates to all connected Socket.io clients
            const updates = JSON.parse(message);
            console.log(`DEBUG: Received market_updates from Redis. Tickers: ${Object.keys(updates).length}`);
            io.emit('live_ticker_update', updates);
        });
        console.log('✅ Redis Subscriber connected and listening on channel: market_updates');
    } catch (e) {
        console.error('❌ Failed to connect Redis Subscriber:', e.message);
    }
})();

io.on('connection', (socket) => {
    console.log('User connected to Live Stream:', socket.id);
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

connectDB()
    .then(() => {
        server.listen(process.env.PORT || 8000, () => {
            console.log(`⚙️  Server is running at port : ${process.env.PORT}`);
        })
    })
    .catch((err) => {
        console.log("MONGO db connection failed !!! ", err);
    })

app.use("/api/intelligence", intelligenceRouter);
app.use("/api/v1/intelligence", intelligenceRouter);
app.use("/api/v1/portfolio", portfolioRouter);
app.use("/api/v1/orders", orderRouter);
app.use("/api/v1/holdings", holdingRouter);
app.use("/api/v1/startup", startupRouter);

