import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { serverConfig } from "../config.js";

const router = Router();

const uploadDir = path.resolve(serverConfig.uploadDir);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

const storage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => cb(null, uploadDir),
  filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    // Sanitize extension to prevent path traversal
    let ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) ext = ".jpg";
    const name = uuidv4() + ext;
    cb(null, name);
  },
});

function fileFilter(_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  const ok = /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype);
  if (!ok) return cb(new Error("Only image files are allowed"));
  cb(null, true);
}

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

router.post("/uploads", requireAdmin, upload.single("image"), (req: Request, res: Response) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ message: "No file uploaded" });
  }
  const baseUrl = serverConfig.publicBaseUrl || `${req.protocol}://${req.get("host")}`;
  const urlPath = `/uploads/${file.filename}`;
  return res.json({ url: `${baseUrl}${urlPath}` });
});

export default router;
