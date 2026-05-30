import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { getStartupStats } from "../controllers/startupController.js";

const router = Router();

// Protect all routes
router.use(verifyJWT);

router.route("/stats").get(getStartupStats);

export default router;
