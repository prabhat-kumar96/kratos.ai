import express from 'express';
import { getCompanyNews } from '../controllers/newsController.js';

const router = express.Router();

router.get('/:ticker', getCompanyNews);

export default router;
