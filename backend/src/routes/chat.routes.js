import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import axios from "axios";

const router = Router();

router.route("/").post(verifyJWT, async (req, res) => {
    try {
        const { query, ticker } = req.body;

        if (!query) {
            return res.status(400).json({ message: "Query is required" });
        }

        // Forward logic to Python FastAPI Service (LLM) with automated retry for cold starts
        try {
            const llmServiceUrl = process.env.LLM_SERVICE_URL || "http://localhost:8002";
            const cleanLlmUrl = llmServiceUrl.replace(/\/+$/, "");
            
            const postWithRetry = async (url, payload, retries = 10, delay = 5000) => {
                for (let i = 0; i < retries; i++) {
                    try {
                        return await axios.post(url, payload, { timeout: 90000 });
                    } catch (err) {
                        const isRetryable = !err.response || err.response.status === 502 || err.response.status === 503 || err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT';
                        if (i === retries - 1 || !isRetryable) {
                            throw err;
                        }
                        console.log(`[ChatProxy] LLM service waking up, retry ${i + 1}/${retries}...`);
                        await new Promise(r => setTimeout(r, delay));
                    }
                }
            };

            const llmResponse = await postWithRetry(`${cleanLlmUrl}/chat`, {
                query,
                ticker
            });

            return res.status(200).json({
                data: llmResponse.data,
                message: "Chat response fetched successfully"
            });
        } catch (error) {
            console.error("LLM Service Error:", error.message);
            return res.status(502).json({
                message: "Error communicating with AI Service",
                error: error.message
            });
        }

    } catch (error) {
        console.error("Chat Proxy Error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
});

export default router;
