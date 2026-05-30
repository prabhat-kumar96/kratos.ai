import express from 'express';
import { createPortfolio, getPortfolio, getHoldings, deletePortfolio } from '../controllers/portfolioController.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';

const router = express.Router();

// All portfolio routes require authentication
router.use(verifyJWT);

// Create new portfolio
router.post('/', createPortfolio);

// Get user's active portfolio
router.get('/', getPortfolio);

// Get detailed holdings
router.get('/holdings', getHoldings);

// Delete user's portfolio
router.delete('/', deletePortfolio);

export default router;
