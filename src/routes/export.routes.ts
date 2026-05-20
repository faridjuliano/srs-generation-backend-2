import { Router } from "express";
import { exportSrsDocx } from "../controllers/export.controller";

const router = Router();

router.post("/srs", exportSrsDocx);

export default router;

