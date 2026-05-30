import express from 'express';
import { getHoldings } from '../controllers/holdingController.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';

const router = express.Router();

// All holding routes require authentication
router.use(verifyJWT);

// Get user's holdings
router.get('/', getHoldings);

export default router;
