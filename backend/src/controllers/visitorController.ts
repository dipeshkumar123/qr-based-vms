import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  checkInVisitor,
  createVisitor,
  deleteVisitor,
  findVisitorByQrToken,
  getLedger,
  listVisitors,
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

export async function handleListVisitors(_req: Request, res: Response, next: NextFunction) {
  try {
    const visitors = await listVisitors();
    res.json(visitors);
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
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ message: "Valid visitor id is required" });
    }

    await deleteVisitor(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export function handleListLedger(_req: Request, res: Response) {
  res.json(getLedger());
}
