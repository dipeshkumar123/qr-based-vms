import { Request, Response } from "express";

export function handleAdminVerify(_req: Request, res: Response) {
  res.status(204).send();
}
