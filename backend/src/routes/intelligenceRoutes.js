import { Router } from "express";
import { getIntelligence, getTickers, getNews } from "../controllers/intelligenceController.js";

const router = Router();

router.route("/tickers").get(getTickers);
router.route("/news/:ticker").get(getNews); // Add news route BEFORE /:ticker generic route to avoid collision
router.route("/:ticker").get(getIntelligence);

export default router;
