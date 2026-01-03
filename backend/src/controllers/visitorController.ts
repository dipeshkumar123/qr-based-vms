import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  checkInVisitor,
  checkOutVisitor,
  createVisitor,
  deleteVisitor,
  findVisitorByQrToken,
  getLedger,
  listVisitors,
  verifyLedgerLinks,
  generateAuditReport,
} from "../services/visitorService.js";

const createVisitorSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(10),
  purpose: z.string().min(3),
});

export async function handleCreateVisitor(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = createVisitorSchema.parse(req.body);
    const visitor = await createVisitor(parsed);
    res.status(201).json(visitor);
  } catch (error) {
    next(error);
  }
}

const listVisitorsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  query: z.string().optional(),
  status: z.enum(["registered", "checked_in", "checked_out", "all"]).optional(),
});

export async function handleListVisitors(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, limit, query, status } = listVisitorsQuerySchema.parse(req.query);
    const result = await listVisitors({ page, limit, query, status });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function handleCheckIn(req: Request, res: Response, next: NextFunction) {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ message: "QR token is required" });
    }

    const visitor = await checkInVisitor(token);
    if (!visitor) {
      return res.status(404).json({ message: "Visitor not found" });
    }

    res.json(visitor);
  } catch (error) {
    next(error);
  }
}

export async function handleCheckOut(req: Request, res: Response, next: NextFunction) {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ message: "QR token is required" });
    }

    const visitor = await checkOutVisitor(token);
    if (!visitor) {
      return res.status(404).json({ message: "Visitor not found" });
    }

    res.json(visitor);
  } catch (error) {
    next(error);
  }
}

export async function handleFindVisitor(req: Request, res: Response, next: NextFunction) {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ message: "QR token is required" });
    }

    const visitor = await findVisitorByQrToken(token);
    if (!visitor) {
      return res.status(404).json({ message: "Visitor not found" });
    }

    res.json(visitor);
  } catch (error) {
    next(error);
  }
}

export async function handleDeleteVisitor(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Valid visitor id is required" });
    }

    await deleteVisitor(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

const listLedgerQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export async function handleListLedger(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, limit } = listLedgerQuerySchema.parse(req.query);
    const ledger = await getLedger(page, limit);
    res.json(ledger);
  } catch (error) {
    next(error);
  }
}

export async function handleVerifyLedger(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await verifyLedgerLinks();
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function handleAuditReport(_req: Request, res: Response, next: NextFunction) {
  try {
    const report = await generateAuditReport();
    res.json(report);
  } catch (error) {
    next(error);
  }
}
