"""
II-VMS Biometric Service
========================
Face capture, encoding storage, and verification using face_recognition + dlib.
Stores face encodings on disk (.npy) with optional photo snapshots.
"""

import os
import base64
import time
import threading
from collections import OrderedDict
from contextlib import asynccontextmanager
from pathlib import Path
from io import BytesIO
from typing import Optional
import logging
from datetime import datetime, timezone
from collections import defaultdict, deque

import numpy as np
from fastapi import FastAPI, HTTPException, File, UploadFile, Form, BackgroundTasks, Depends, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator
import face_recognition
from PIL import Image
import httpx

from storage import FileSystemStorage, InMemoryStorage

# ── Logging ─────────────────────────────────────────────────────────
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)
logger = logging.getLogger("biometric-service")

# ── Configuration ───────────────────────────────────────────────────
STORAGE_BACKEND = os.getenv("STORAGE_BACKEND", "filesystem").lower()

# Tolerance for face matching (lower = stricter matching)
FACE_MATCH_TOLERANCE = float(os.getenv("FACE_MATCH_TOLERANCE", "0.6"))
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.70"))
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:4000")

# Service-to-service API key (must match the backend ADMIN_API_KEY)
SERVICE_API_KEY = os.getenv("SERVICE_API_KEY", "")

# Max photo size in bytes (10 MB base64 ≈ 13.3M chars)
MAX_PHOTO_BASE64_LENGTH = int(os.getenv("MAX_PHOTO_BASE64_LENGTH", "15000000"))

# Allowed MIME types for uploaded files
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
METRICS_WINDOW = int(os.getenv("BIOMETRIC_METRICS_WINDOW", "300"))
MAX_IMAGE_DIMENSION = int(os.getenv("BIOMETRIC_MAX_IMAGE_DIM", "1024"))
ENCODING_CACHE_MAX_ITEMS = int(os.getenv("BIOMETRIC_ENCODING_CACHE_MAX", "512"))
VERIFY_MAX_CONCURRENCY = int(os.getenv("BIOMETRIC_VERIFY_MAX_CONCURRENCY", "4"))

if STORAGE_BACKEND == "memory":
    storage = InMemoryStorage()
else:
    storage = FileSystemStorage(
        storage_dir=os.getenv("STORAGE_DIR", "/tmp/ii_vms_photos"),
        cache_max_items=ENCODING_CACHE_MAX_ITEMS
    )

_metrics_lock = threading.Lock()
_request_metrics = defaultdict(lambda: {
    "count": 0,
    "errors": 0,
    "latencies_ms": deque(maxlen=METRICS_WINDOW),
})
_failure_reason_counts = defaultdict(int)
_verify_slots = threading.BoundedSemaphore(max(1, VERIFY_MAX_CONCURRENCY))
_verify_inflight = set()
_verify_inflight_lock = threading.Lock()


# ── Lifespan (replaces deprecated on_event) ─────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    logger.info("Biometric service starting")
    logger.info("Storage backend: %s", storage.get_stats().get("storage_type"))
    logger.info("Face match tolerance: %.2f", FACE_MATCH_TOLERANCE)
    logger.info("Confidence threshold: %.2f", CONFIDENCE_THRESHOLD)
    logger.info("Backend URL: %s", BACKEND_URL)
    logger.info(
        "Service API key: %s",
        "configured" if SERVICE_API_KEY else "NOT SET (backend notifications will fail)",
    )
    yield
    logger.info("Biometric service shutting down")


app = FastAPI(
    title="II-VMS Biometric Service",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Auth dependency ─────────────────────────────────────────────────
async def verify_service_key(x_service_key: Optional[str] = Header(None)):
    """
    Optional service-to-service authentication.
    When SERVICE_API_KEY is set, all mutating endpoints require
    the matching header.  Read-only endpoints (health, info) are open.
    """
    if not SERVICE_API_KEY:
        return  # auth disabled
    if x_service_key != SERVICE_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing service key")


def _percentile(sorted_values, pct: float) -> float:
    if not sorted_values:
        return 0.0
    idx = int(round((pct / 100.0) * (len(sorted_values) - 1)))
    return float(sorted_values[max(0, min(idx, len(sorted_values) - 1))])


def mark_failure(reason: str):
    with _metrics_lock:
        _failure_reason_counts[reason] += 1


@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or f"biometric-{int(time.time() * 1000)}"
    request.state.request_id = request_id
    start = time.perf_counter()
    path = request.url.path
    status_code = 500
    try:
        response = await call_next(request)
        status_code = response.status_code
        response.headers["x-request-id"] = request_id
        return response
    finally:
        elapsed_ms = (time.perf_counter() - start) * 1000.0
        with _metrics_lock:
            row = _request_metrics[path]
            row["count"] += 1
            if status_code >= 400:
                row["errors"] += 1
            row["latencies_ms"].append(elapsed_ms)
        logger.info("request_id=%s path=%s status=%s latency_ms=%.2f", request_id, path, status_code, elapsed_ms)


# ── Data Models ─────────────────────────────────────────────────────

class CapturePhotoRequest(BaseModel):
    """Capture visitor photo and store encoding."""
    visitor_id: int = Field(..., gt=0)
    photo_base64: str = Field(..., min_length=100, max_length=MAX_PHOTO_BASE64_LENGTH)


class CapturePhotoResponse(BaseModel):
    success: bool
    visitor_id: int
    encoding_saved: bool
    message: str


class VerifyPhotoRequest(BaseModel):
    """Verify if photo matches stored encoding."""
    visitor_id: int = Field(..., gt=0)
    photo_base64: str = Field(..., min_length=100, max_length=MAX_PHOTO_BASE64_LENGTH)
    match_threshold: Optional[float] = Field(default=None, ge=0.0, le=1.0)

    @field_validator("match_threshold", mode="before")
    @classmethod
    def default_threshold(cls, v):
        return v if v is not None else FACE_MATCH_TOLERANCE


class VerifyPhotoResponse(BaseModel):
    success: bool
    visitor_id: int
    is_match: bool
    confidence_score: float
    message: str


class EncodingInfo(BaseModel):
    visitor_id: int
    has_encoding: bool
    encoded_at: Optional[str] = None
    photo_count: int = 0


# ── Helper Functions ────────────────────────────────────────────────

def base64_to_image(photo_base64: str) -> Optional[Image.Image]:
    """Convert base64 string (with or without data-URI prefix) to PIL Image."""
    try:
        if photo_base64.startswith("data:image"):
            photo_base64 = photo_base64.split(",", 1)[1]
        photo_bytes = base64.b64decode(photo_base64)
        image = Image.open(BytesIO(photo_bytes))
        # Validate it's a real image
        image.verify()
        # Re-open after verify (verify consumes the stream)
        image = Image.open(BytesIO(photo_bytes)).convert("RGB")

        # Downscale large images to speed up face detection/encoding.
        width, height = image.size
        max_dim = max(width, height)
        if max_dim > MAX_IMAGE_DIMENSION:
            scale = MAX_IMAGE_DIMENSION / float(max_dim)
            resized = (max(1, int(width * scale)), max(1, int(height * scale)))
            image = image.resize(resized, Image.Resampling.LANCZOS)

        return image
    except Exception as e:
        logger.error("Failed to decode image: %s", e)
        return None


def extract_face_encoding(image: Image.Image) -> Optional[np.ndarray]:
    """Extract the primary face encoding from a PIL image."""
    try:
        image_array = np.array(image)
        face_locations = face_recognition.face_locations(image_array)
        if not face_locations:
            logger.warning("No face detected in image")
            return None
        face_encodings = face_recognition.face_encodings(image_array, face_locations)
        if not face_encodings:
            return None
        if len(face_locations) > 1:
            logger.info("Multiple faces detected (%d), using largest", len(face_locations))
            # Pick the face with the largest bounding box area
            areas = [
                (bottom - top) * (right - left)
                for top, right, bottom, left in face_locations
            ]
            best_idx = int(np.argmax(areas))
            return face_encodings[best_idx]
        return face_encodings[0]
    except Exception as e:
        logger.error("Error extracting face encoding: %s", e)
        return None


def compare_face_encodings(
    encoding1: np.ndarray,
    encoding2: np.ndarray,
    tolerance: float = FACE_MATCH_TOLERANCE,
) -> tuple:
    """
    Compare two face encodings.

    Returns:
        (confidence, distance) where confidence is 0..1 (1 = identical).
    """
    try:
        distance = float(np.linalg.norm(encoding1 - encoding2))
        # Normalise: face_recognition distances are typically 0..1.2
        # We map [0, 2*tolerance] → [1, 0] linearly, clamped.
        confidence = max(0.0, min(1.0, 1.0 - (distance / (2 * tolerance))))
        return confidence, distance
    except Exception as e:
        logger.error("Error comparing encodings: %s", e)
        return 0.0, 999.0


async def notify_backend(event: str, data: dict):
    """
    Notify Node backend of biometric events via analytics events endpoint.
    Uses SERVICE_API_KEY for service-to-service auth.
    """
    headers: dict = {"Content-Type": "application/json"}
    if SERVICE_API_KEY:
        headers["x-admin-key"] = SERVICE_API_KEY

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(
                f"{BACKEND_URL}/api/analytics/events",
                json={"name": event, "payload": data},
                headers=headers,
            )
            if response.status_code >= 400:
                logger.warning(
                    "Backend notification rejected: %d %s",
                    response.status_code,
                    response.text[:200],
                )
            else:
                logger.info("Notified backend: %s -> %d", event, response.status_code)
    except Exception as e:
        logger.warning("Failed to notify backend: %s", e)


# ── Endpoints ───────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    """Health check — always returns 200."""
    stats = storage.get_stats()
    return {
        "status": "healthy",
        "service": "biometric-recognition",
        "version": "2.0.0",
        "storage_backend": stats.get("storage_type"),
        "storage_dir": stats.get("storage_dir", "N/A"),
        "encoding_count": stats.get("encodings_stored", 0),
    }


@app.get("/metrics")
async def metrics(_auth: None = Depends(verify_service_key)):
    with _metrics_lock:
        endpoints = {}
        total_count = 0
        total_errors = 0
        for path, stat in _request_metrics.items():
            latencies = sorted(stat["latencies_ms"])
            count = int(stat["count"])
            errors = int(stat["errors"])
            total_count += count
            total_errors += errors
            endpoints[path] = {
                "count": count,
                "errors": errors,
                "error_rate": round((errors / count) if count else 0.0, 4),
                "latency_ms": {
                    "p50": round(_percentile(latencies, 50), 2),
                    "p95": round(_percentile(latencies, 95), 2),
                    "max": round(float(latencies[-1]) if latencies else 0.0, 2),
                },
            }

        failure_reasons = dict(_failure_reason_counts)

    return {
        "service": "biometric-recognition",
        "window_size": METRICS_WINDOW,
        "summary": {
            "requests": total_count,
            "errors": total_errors,
            "error_rate": round((total_errors / total_count) if total_count else 0.0, 4),
        },
        "endpoints": endpoints,
        "failure_reasons": failure_reasons,
    }


@app.post("/capture", response_model=CapturePhotoResponse)
async def capture_photo(
    request: CapturePhotoRequest,
    background_tasks: BackgroundTasks,
    _auth: None = Depends(verify_service_key),
):
    """
    Capture visitor photo and extract face encoding.

    POST /capture
    Body: { visitor_id: int, photo_base64: string }
    """
    image = base64_to_image(request.photo_base64)
    if not image:
        mark_failure("capture_invalid_image")
        raise HTTPException(status_code=400, detail="Invalid image format")

    encoding = extract_face_encoding(image)
    if encoding is None:
        mark_failure("capture_no_face_detected")
        background_tasks.add_task(
            notify_backend,
            "visitor_face_capture_failed",
            {"visitor_id": request.visitor_id, "reason": "no_face_detected"},
        )
        return CapturePhotoResponse(
            success=False,
            visitor_id=request.visitor_id,
            encoding_saved=False,
            message="No face detected in photo. Please provide a clear face image.",
        )

    encoding_saved = storage.save_face_encoding(request.visitor_id, encoding)
    photo_saved = storage.save_photo(request.visitor_id, image, suffix="registered")

    background_tasks.add_task(
        notify_backend,
        "visitor_face_captured",
        {
            "visitor_id": request.visitor_id,
            "encoding_saved": encoding_saved,
            "photo_saved": photo_saved,
        },
    )

    return CapturePhotoResponse(
        success=encoding_saved,
        visitor_id=request.visitor_id,
        encoding_saved=encoding_saved,
        message="Face encoding saved successfully"
        if encoding_saved
        else "Failed to save encoding",
    )


@app.post("/verify", response_model=VerifyPhotoResponse)
async def verify_photo(
    request: VerifyPhotoRequest,
    background_tasks: BackgroundTasks,
    _auth: None = Depends(verify_service_key),
):
    """
    Verify if provided photo matches stored face encoding.

    POST /verify
    Body: { visitor_id: int, photo_base64: string, match_threshold?: float }
    """
    acquired_slot = _verify_slots.acquire(blocking=False)
    if not acquired_slot:
        mark_failure("verify_over_capacity")
        raise HTTPException(
            status_code=503,
            detail="Verification service is busy. Please retry shortly.",
        )

    with _verify_inflight_lock:
        if request.visitor_id in _verify_inflight:
            _verify_slots.release()
            mark_failure("verify_concurrent_same_visitor")
            raise HTTPException(
                status_code=409,
                detail="Verification already in progress for this visitor. Retry in a moment.",
            )
        _verify_inflight.add(request.visitor_id)

    try:
        stored_encoding = storage.load_face_encoding(request.visitor_id)
        if stored_encoding is None:
            mark_failure("verify_no_stored_encoding")
            background_tasks.add_task(
                notify_backend,
                "visitor_face_verify_failed",
                {"visitor_id": request.visitor_id, "reason": "no_stored_encoding"},
            )
            return VerifyPhotoResponse(
                success=False,
                visitor_id=request.visitor_id,
                is_match=False,
                confidence_score=0.0,
                message="No stored face encoding found for this visitor",
            )

        image = base64_to_image(request.photo_base64)
        if not image:
            mark_failure("verify_invalid_image")
            raise HTTPException(status_code=400, detail="Invalid image format")

        new_encoding = extract_face_encoding(image)
        if new_encoding is None:
            mark_failure("verify_no_face_detected")
            background_tasks.add_task(
                notify_backend,
                "visitor_face_verify_failed",
                {"visitor_id": request.visitor_id, "reason": "no_face_detected"},
            )
            return VerifyPhotoResponse(
                success=False,
                visitor_id=request.visitor_id,
                is_match=False,
                confidence_score=0.0,
                message="No face detected in verification photo",
            )

        confidence, distance = compare_face_encodings(
            stored_encoding, new_encoding, request.match_threshold
        )
        is_match = confidence >= CONFIDENCE_THRESHOLD
        if not is_match:
            mark_failure("verify_face_mismatch")

        # Save verification photo (timestamped — no overwrites)
        storage.save_photo(
            request.visitor_id,
            image,
            suffix=f"verify_{'matched' if is_match else 'unmatched'}",
        )

        background_tasks.add_task(
            notify_backend,
            "visitor_face_verified",
            {
                "visitor_id": request.visitor_id,
                "is_match": is_match,
                "confidence_score": float(confidence),
                "distance": float(distance),
            },
        )

        return VerifyPhotoResponse(
            success=True,
            visitor_id=request.visitor_id,
            is_match=is_match,
            confidence_score=float(confidence),
            message="Face matches stored encoding"
            if is_match
            else "Face does not match stored encoding",
        )
    finally:
        with _verify_inflight_lock:
            _verify_inflight.discard(request.visitor_id)
        _verify_slots.release()


@app.get("/info/{visitor_id}", response_model=EncodingInfo)
async def get_encoding_info(visitor_id: int):
    """Check if a visitor has a stored face encoding."""
    if visitor_id <= 0:
        raise HTTPException(status_code=400, detail="visitor_id must be positive")

    return EncodingInfo(
        visitor_id=visitor_id,
        has_encoding=storage.has_encoding(visitor_id),
        encoded_at=storage.get_encoding_time(visitor_id),
        photo_count=storage.count_visitor_photos(visitor_id),
    )


@app.post("/batch-verify")
async def batch_verify(
    visitor_id: int = Form(..., gt=0),
    stored_photo: UploadFile = File(...),
    verify_photo_file: UploadFile = File(..., alias="verify_photo"),
    _auth: None = Depends(verify_service_key),
):
    """
    Verify by uploading actual files (alternative to base64).

    POST /batch-verify (multipart form)
    Fields: visitor_id, stored_photo, verify_photo
    """
    # Validate file types
    for f in (stored_photo, verify_photo_file):
        if f.content_type and f.content_type not in ALLOWED_MIME_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {f.content_type}. Allowed: {', '.join(ALLOWED_MIME_TYPES)}",
            )

    try:
        stored_bytes = await stored_photo.read()
        if len(stored_bytes) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=400, detail="Stored photo exceeds 10 MB limit")
        stored_image = Image.open(BytesIO(stored_bytes)).convert("RGB")
        stored_enc = extract_face_encoding(stored_image)
        if stored_enc is None:
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": "No face detected in stored photo"},
            )

        verify_bytes = await verify_photo_file.read()
        if len(verify_bytes) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=400, detail="Verify photo exceeds 10 MB limit")
        verify_image = Image.open(BytesIO(verify_bytes)).convert("RGB")
        verify_enc = extract_face_encoding(verify_image)
        if verify_enc is None:
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": "No face detected in verification photo"},
            )

        confidence, distance = compare_face_encodings(stored_enc, verify_enc)
        is_match = confidence >= CONFIDENCE_THRESHOLD

        return {
            "success": True,
            "visitor_id": visitor_id,
            "is_match": is_match,
            "confidence_score": float(confidence),
            "distance": float(distance),
            "message": "Face matches" if is_match else "Face does not match",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Batch verify failed: %s", e)
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": "Internal verification error"},
        )


@app.delete("/encoding/{visitor_id}")
async def delete_encoding(
    visitor_id: int,
    _auth: None = Depends(verify_service_key),
):
    """
    Delete stored face encoding and photos for a visitor (GDPR compliance).

    DELETE /encoding/{visitor_id}
    """
    if visitor_id <= 0:
        raise HTTPException(status_code=400, detail="visitor_id must be positive")

    try:
        deleted_files = storage.delete_visitor_data(visitor_id)

        return {
            "success": True,
            "deleted_files": deleted_files,
            "message": f"Deleted all biometric data for visitor {visitor_id}",
        }
    except Exception as e:
        logger.error("Error deleting encoding for visitor %d: %s", visitor_id, e)
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": "Failed to delete biometric data"},
        )


@app.get("/stats")
async def service_stats():
    """
    Service statistics — encoding count, storage usage, etc.
    Useful for monitoring dashboards.
    """
    return storage.get_stats()
