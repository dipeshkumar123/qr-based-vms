import { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Wraps an async route handler to automatically catch errors and forward
 * them to the Express error handler via next(). This eliminates the need
 * for try/catch blocks in every async route.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
