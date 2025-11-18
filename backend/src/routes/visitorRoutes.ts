import { Router } from "express";
import {
  handleCheckIn,
  handleCreateVisitor,
  handleDeleteVisitor,
  handleFindVisitor,
  handleListLedger,
  handleListVisitors,
} from "../controllers/visitorController.js";

const router = Router();

router.post("/visitors", handleCreateVisitor);
router.get("/visitors", handleListVisitors);
router.get("/visitors/:token", handleFindVisitor);
router.post("/visitors/:token/check-in", handleCheckIn);
router.delete("/visitors/:id", handleDeleteVisitor);
router.get("/ledger", handleListLedger);

export default router;
