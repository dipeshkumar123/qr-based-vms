import { Router } from "express";
import {
  handleCheckIn,
  handleCheckOut,
  handleCreateVisitor,
  handleDeleteVisitor,
  handleFindVisitor,
  handleGetVisitorById,
  handleListLedger,
  handleListVisitors,
  handleUpdateVisitor,
  handleVerifyLedger,
  handleAuditReport,
  handleVisitorStats,
  handleExportCsv,
} from "../controllers/visitorController.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const router = Router();

// Public
router.post("/visitors", handleCreateVisitor);

// Admin-protected visitor endpoints
router.get("/visitors/stats", requireAdmin, handleVisitorStats);
router.get("/visitors/export", requireAdmin, handleExportCsv);
router.get("/visitors", requireAdmin, handleListVisitors);
router.get("/visitors/id/:id", requireAdmin, handleGetVisitorById);
router.put("/visitors/:id", requireAdmin, handleUpdateVisitor);
router.get("/visitors/:token", requireAdmin, handleFindVisitor);
router.post("/visitors/:token/check-in", requireAdmin, handleCheckIn);
router.post("/visitors/:token/check-out", requireAdmin, handleCheckOut);
router.delete("/visitors/:id", requireAdmin, handleDeleteVisitor);

// Admin-protected ledger endpoints
router.get("/ledger", requireAdmin, handleListLedger);
router.get("/ledger/verify", requireAdmin, handleVerifyLedger);
router.get("/ledger/report", requireAdmin, handleAuditReport);

export default router;
