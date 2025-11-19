import { Router } from "express";
import {
  handleCheckIn,
  handleCreateVisitor,
  handleDeleteVisitor,
  handleFindVisitor,
  handleListLedger,
  handleListVisitors,
} from "../controllers/visitorController.js";
import { handleAdminVerify } from "../controllers/adminController.js";
import { requireAdminKey } from "../middleware/adminAuth.js";

const router = Router();

router.post("/visitors", handleCreateVisitor);
router.post("/admin/verify", requireAdminKey, handleAdminVerify);
router.get("/visitors", requireAdminKey, handleListVisitors);
router.get("/visitors/:token", requireAdminKey, handleFindVisitor);
router.post("/visitors/:token/check-in", requireAdminKey, handleCheckIn);
router.delete("/visitors/:id", requireAdminKey, handleDeleteVisitor);
router.get("/ledger", requireAdminKey, handleListLedger);

export default router;
