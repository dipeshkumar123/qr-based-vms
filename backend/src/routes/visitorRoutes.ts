import { Router } from "express";
import {
  handleCheckIn,
  handleCheckOut,
  handleCreateVisitor,
  handleDeleteVisitor,
  handleFindVisitor,
  handleListLedger,
  handleListVisitors,
  handleVerifyLedger,
  handleAuditReport,
} from "../controllers/visitorController.js";
import { handleAdminVerify } from "../controllers/adminController.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const router = Router();

router.post("/visitors", handleCreateVisitor);
router.post("/admin/verify", requireAdmin, handleAdminVerify);
router.get("/visitors", requireAdmin, handleListVisitors);
router.get("/visitors/:token", requireAdmin, handleFindVisitor);
router.post("/visitors/:token/check-in", requireAdmin, handleCheckIn);
router.post("/visitors/:token/check-out", requireAdmin, handleCheckOut);
router.delete("/visitors/:id", requireAdmin, handleDeleteVisitor);
router.get("/ledger", requireAdmin, handleListLedger);
router.get("/ledger/verify", requireAdmin, handleVerifyLedger);
router.get("/ledger/report", requireAdmin, handleAuditReport);

export default router;
