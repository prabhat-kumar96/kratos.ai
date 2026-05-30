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

        // Forward logic to Python FastAPI Service (LLM)
        try {
            const llmResponse = await axios.post("http://host.docker.internal:8002/chat", {
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
