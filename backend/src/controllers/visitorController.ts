import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  checkInVisitor,
  checkOutVisitor,
  createVisitor,
  deleteVisitor,
  findVisitorById,
  findVisitorByQrToken,
  getLedger,
  listVisitors,
  updateVisitor,
  verifyLedgerLinks,
  generateAuditReport,
  getVisitorStats,
  exportVisitorsCsv,
} from "../services/visitorService.js";
import { ErrorCodes, sendApiError } from "../utils/errorCatalog.js";

function getRequestIp(req: Request): string | undefined {
  const forwardedFor = req.header("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim();
  }
  return req.ip || req.socket.remoteAddress || undefined;
}

function buildAuditContext(req: Request) {
  const requestId = (req.id as string) === undefined || (req.id as string) === null ? undefined : String((req.id as string));
  return {
    actorType: req.admin?.role ? "admin" : "system",
    actorId: req.admin?.sub,
    requestId,
    ipAddress: getRequestIp(req),
    userAgent: req.header("user-agent") || undefined,
  };
}

const createVisitorSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().regex(/^[+0-9()\-\s]{10,20}$/),
  purpose: z.string().trim().min(3).max(500),
}).strict();

export async function handleCreateVisitor(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = createVisitorSchema.parse(req.body);
    const visitor = await createVisitor(parsed, buildAuditContext(req));
    res.status(201).json(visitor);
  } catch (error) {
    next(error);
  }
}

const listVisitorsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  query: z.string().trim().max(120).optional(),
  status: z.enum(["registered", "checked_in", "checked_out", "all"]).optional(),
}).strict();

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
      return sendApiError(res, {
        status: 400,
        message: "QR token is required",
        code: ErrorCodes.VALIDATION_MISSING_QR_TOKEN,
        requestId: (req.id as string),
      });
    }

    const visitor = await checkInVisitor(token, buildAuditContext(req));
    if (!visitor) {
      return sendApiError(res, {
        status: 404,
        message: "Visitor not found",
        code: ErrorCodes.RESOURCE_NOT_FOUND,
        requestId: (req.id as string),
      });
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
      return sendApiError(res, {
        status: 400,
        message: "QR token is required",
        code: ErrorCodes.VALIDATION_MISSING_QR_TOKEN,
        requestId: (req.id as string),
      });
    }

    const visitor = await checkOutVisitor(token, buildAuditContext(req));
    if (!visitor) {
      return sendApiError(res, {
        status: 404,
        message: "Visitor not found",
        code: ErrorCodes.RESOURCE_NOT_FOUND,
        requestId: (req.id as string),
      });
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
      return sendApiError(res, {
        status: 400,
        message: "QR token is required",
        code: ErrorCodes.VALIDATION_MISSING_QR_TOKEN,
        requestId: (req.id as string),
      });
    }

    const visitor = await findVisitorByQrToken(token);
    if (!visitor) {
      return sendApiError(res, {
        status: 404,
        message: "Visitor not found",
        code: ErrorCodes.RESOURCE_NOT_FOUND,
        requestId: (req.id as string),
      });
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
      return sendApiError(res, {
        status: 400,
        message: "Valid visitor id is required",
        code: ErrorCodes.VALIDATION_INVALID_VISITOR_ID,
        requestId: (req.id as string),
      });
    }

    const deleted = await deleteVisitor(id, buildAuditContext(req));
    if (!deleted) {
      return sendApiError(res, {
        status: 404,
        message: "Visitor not found",
        code: ErrorCodes.RESOURCE_NOT_FOUND,
        requestId: (req.id as string),
      });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function handleGetVisitorById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return sendApiError(res, {
        status: 400,
        message: "Valid visitor id is required",
        code: ErrorCodes.VALIDATION_INVALID_VISITOR_ID,
        requestId: (req.id as string),
      });
    }

    const visitor = await findVisitorById(id);
    if (!visitor) {
      return sendApiError(res, {
        status: 404,
        message: "Visitor not found",
        code: ErrorCodes.RESOURCE_NOT_FOUND,
        requestId: (req.id as string),
      });
    }
    res.json(visitor);
  } catch (error) {
    next(error);
  }
}

const updateVisitorSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().max(200).optional(),
  phone: z.string().trim().regex(/^[+0-9()\-\s]{10,20}$/).optional(),
  purpose: z.string().trim().min(3).max(500).optional(),
}).strict().refine((data) => Object.keys(data).length > 0, {
  message: "At least one field must be provided for update",
});

export async function handleUpdateVisitor(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return sendApiError(res, {
        status: 400,
        message: "Valid visitor id is required",
        code: ErrorCodes.VALIDATION_INVALID_VISITOR_ID,
        requestId: (req.id as string),
      });
    }

    const parsed = updateVisitorSchema.parse(req.body);
    const visitor = await updateVisitor(id, parsed, buildAuditContext(req));
    if (!visitor) {
      return sendApiError(res, {
        status: 404,
        message: "Visitor not found",
        code: ErrorCodes.RESOURCE_NOT_FOUND,
        requestId: (req.id as string),
      });
    }
    res.json(visitor);
  } catch (error) {
    next(error);
  }
}

const listLedgerQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  action: z.string().trim().min(2).max(80).optional(),
  actorType: z.string().trim().min(2).max(40).optional(),
  actorId: z.string().trim().min(1).max(120).optional(),
  outcome: z.string().trim().min(2).max(40).optional(),
  visitorId: z.coerce.number().int().min(1).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
}).strict();

export async function handleListLedger(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, limit, action, actorType, actorId, outcome, visitorId, from, to } = listLedgerQuerySchema.parse(req.query);
    const ledger = await getLedger(page, limit, {
      action,
      actorType,
      actorId,
      outcome,
      visitorId,
      from,
      to,
    });
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

export async function handleVisitorStats(_req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await getVisitorStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
}

const exportQuerySchema = z.object({
  status: z.enum(["registered", "checked_in", "checked_out", "all"]).optional(),
}).strict();

export async function handleExportCsv(req: Request, res: Response, next: NextFunction) {
  try {
    const { status } = exportQuerySchema.parse(req.query);
    const csv = await exportVisitorsCsv(status);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="visitors-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
}
