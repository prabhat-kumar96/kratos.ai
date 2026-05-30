import express from 'express';
import axios from 'axios';


const router = express.Router();

/**
 * Extension Analysis Endpoint
 * Analyzes webpage content for financial reliability
 */
router.post('/extension/analyze', async (req, res) => {
    try {
        const { url, pageTitle, pageText } = req.body;

        console.log('📊 Extension analysis request received:');
        console.log('  URL:', url);
        console.log('  Page Title:', pageTitle);
        console.log('  Text Length:', pageText?.length || 0, 'characters');

        if (!pageText || pageText.length === 0) {
            return res.status(400).json({
                error: 'Invalid request',
                message: 'Page text is required'
            });
        }

        // Mock analysis - Replace with your actual AI analysis logic
        // You can integrate with your existing ML service or AI service here

        // Simple keyword-based scoring for demo
        const bullishKeywords = ['growth', 'profit', 'gain', 'increase', 'bullish', 'positive'];
        const bearishKeywords = ['loss', 'decline', 'decrease', 'bearish', 'negative', 'risk'];

        const text = pageText.toLowerCase();
        const bullishCount = bullishKeywords.filter(word => text.includes(word)).length;
        const bearishCount = bearishKeywords.filter(word => text.includes(word)).length;

        // Calculate a simple score (0-100)
        let score = 50; // neutral baseline
        score += (bullishCount * 5);
        score -= (bearishCount * 5);
        score = Math.max(0, Math.min(100, score)); // Clamp between 0-100

        // Generate summary
        let summary = '';
        if (score >= 70) {
            summary = `High reliability score. Article appears balanced with positive sentiment. Found ${bullishCount} positive indicators.`;
        } else if (score >= 40) {
            summary = `Moderate reliability. Mixed signals detected with ${bullishCount} positive and ${bearishCount} negative indicators.`;
        } else {
            summary = `Low reliability score. Article shows concerning bias with ${bearishCount} risk indicators and limited positive data.`;
        }

        console.log('  Analysis Result - Score:', Math.round(score));

        res.json({
            score: Math.round(score),
            summary: summary
        });

    } catch (error) {
        console.error('❌ Extension analyze error:', error);
        res.status(500).json({
            error: 'Failed to analyze page',
            message: error.message
        });
    }
});

/**
 * Extension Chat Endpoint
 * Handles chat queries about webpage content using LLM Service
 */
router.post('/chat', async (req, res) => {
    try {
        const { query, context } = req.body;
        const { pageTitle, pageText, url } = context || {};

        // Enhance the query with page context for better responses
        const enhancedQuery = `
Page: "${pageTitle}"
URL: ${url}

User Question: ${query}

Page Content Preview:
${pageText?.substring(0, 1000) || 'No content available'}
`;

        // Call the LLM service (LangGraph agent)
        try {
            const llmResponse = await axios.post('http://localhost:8002/chat', {
                query: enhancedQuery,
                ticker: null // Extension doesn't have ticker context
            }, {
                timeout: 30000 // 30 second timeout
            });

            res.json({
                response: llmResponse.data.response || 'No response from AI service.'
            });

        } catch (llmError) {
            console.error('LLM Service Error:', llmError.message);

            // Fallback to simple response if LLM service is down
            let fallbackResponse = `I'm having trouble connecting to the AI service. Here's what I can tell you about "${pageTitle}": `;

            if (query.toLowerCase().includes('summarize')) {
                fallbackResponse += `The page discusses financial topics. Preview: ${pageText?.substring(0, 200)}...`;
            } else {
                fallbackResponse += `Please make sure the LLM service is running on port 8002 and try again.`;
            }

            res.json({
                response: fallbackResponse
            });
        }

    } catch (error) {
        console.error('Extension chat error:', error);
        res.status(500).json({
            error: 'Failed to process chat',
            message: error.message
        });
    }
});

export default router;
