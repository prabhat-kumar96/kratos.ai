import express from 'express';
import { placeMarketOrder, getOrders } from '../controllers/orderController.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';

const router = express.Router();

// All order routes require authentication
router.use(verifyJWT);

// Place market order (buy/sell)
router.post('/', placeMarketOrder);

// Get order history
router.get('/', getOrders);

export default router;
