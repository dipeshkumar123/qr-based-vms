import os
import base64
import json
from pathlib import Path
from io import BytesIO
from typing import Optional
import logging

import numpy as np
from fastapi import FastAPI, HTTPException, File, UploadFile, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import face_recognition
from PIL import Image
import httpx

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="II-VMS Biometric Service", version="1.0.0")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
STORAGE_DIR = Path(os.getenv("STORAGE_DIR", "/tmp/ii_vms_photos"))
STORAGE_DIR.mkdir(parents=True, exist_ok=True)

FACE_ENCODING_DIR = STORAGE_DIR / "encodings"
FACE_ENCODING_DIR.mkdir(exist_ok=True)

PHOTO_DIR = STORAGE_DIR / "photos"
PHOTO_DIR.mkdir(exist_ok=True)

# Tolerance for face matching (lower = stricter matching)
FACE_MATCH_TOLERANCE = float(os.getenv("FACE_MATCH_TOLERANCE", "0.6"))
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.70"))
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:4000")


# ============================================================================
# Data Models
# ============================================================================

class CapturePhotoRequest(BaseModel):
    """Capture visitor photo and store encoding"""
    visitor_id: int
    photo_base64: str  # base64 encoded photo


class CapturePhotoResponse(BaseModel):
    """Response for photo capture"""
    success: bool
    visitor_id: int
    encoding_saved: bool
    message: str


class VerifyPhotoRequest(BaseModel):
    """Verify if photo matches stored encoding"""
    visitor_id: int
    photo_base64: str
    match_threshold: Optional[float] = FACE_MATCH_TOLERANCE


class VerifyPhotoResponse(BaseModel):
    """Response for photo verification"""
    success: bool
    visitor_id: int
    is_match: bool
    confidence_score: float
    message: str


class EncodingInfo(BaseModel):
    """Info about stored face encoding"""
    visitor_id: int
    has_encoding: bool
    encoded_at: Optional[str] = None


# ============================================================================
# Helper Functions
# ============================================================================

def base64_to_image(photo_base64: str) -> Optional[Image.Image]:
    """Convert base64 to PIL Image"""
    try:
        # Handle data URI format
        if photo_base64.startswith("data:image"):
            photo_base64 = photo_base64.split(",")[1]
        
        photo_bytes = base64.b64decode(photo_base64)
        image = Image.open(BytesIO(photo_bytes))
        return image
    except Exception as e:
        logger.error(f"Failed to decode image: {e}")
        return None


def image_to_base64(image: Image.Image) -> str:
    """Convert PIL Image to base64"""
    buffer = BytesIO()
    image.save(buffer, format="JPEG")
    return base64.b64encode(buffer.getvalue()).decode()


def extract_face_encoding(image: Image.Image) -> Optional[np.ndarray]:
    """Extract face encoding from image using face_recognition lib"""
    try:
        # Convert PIL to numpy array
        image_array = np.array(image)
        
        # Find faces
        face_locations = face_recognition.face_locations(image_array)
        if not face_locations:
            logger.warning("No face detected in image")
            return None
        
        # Get encoding of first face
        face_encodings = face_recognition.face_encodings(image_array, face_locations)
        if not face_encodings:
            return None
        
        return face_encodings[0]
    except Exception as e:
        logger.error(f"Error extracting face encoding: {e}")
        return None


def compare_face_encodings(encoding1: np.ndarray, encoding2: np.ndarray, tolerance: float = FACE_MATCH_TOLERANCE) -> float:
    """
    Compare two face encodings and return confidence score.
    Returns: float between 0 and 1 (1 = perfect match, 0 = no match)
    """
    try:
        # Calculate distance between encodings
        distance = np.linalg.norm(encoding1 - encoding2)
        # Convert distance to confidence (inverse, normalized)
        confidence = max(0.0, 1.0 - (distance / 2.0))
        return float(confidence)
    except Exception as e:
        logger.error(f"Error comparing encodings: {e}")
        return 0.0


def save_face_encoding(visitor_id: int, encoding: np.ndarray) -> bool:
    """Save face encoding to disk"""
    try:
        encoding_path = FACE_ENCODING_DIR / f"visitor_{visitor_id}_encoding.npy"
        np.save(encoding_path, encoding)
        logger.info(f"Saved encoding for visitor {visitor_id}")
        return True
    except Exception as e:
        logger.error(f"Error saving encoding for visitor {visitor_id}: {e}")
        return False


def load_face_encoding(visitor_id: int) -> Optional[np.ndarray]:
    """Load face encoding from disk"""
    try:
        encoding_path = FACE_ENCODING_DIR / f"visitor_{visitor_id}_encoding.npy"
        if encoding_path.exists():
            return np.load(encoding_path)
        return None
    except Exception as e:
        logger.error(f"Error loading encoding for visitor {visitor_id}: {e}")
        return None


def save_photo(visitor_id: int, image: Image.Image, suffix: str = "capture") -> bool:
    """Save photo to disk"""
    try:
        photo_path = PHOTO_DIR / f"visitor_{visitor_id}_{suffix}.jpg"
        image.save(photo_path, "JPEG")
        logger.info(f"Saved {suffix} photo for visitor {visitor_id}")
        return True
    except Exception as e:
        logger.error(f"Error saving photo for visitor {visitor_id}: {e}")
        return False


async def notify_backend(event: str, data: dict):
    """Notify Node backend of biometric events"""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(
                f"{BACKEND_URL}/api/analytics/events",
                json={"name": event, "payload": data}
            )
            logger.info(f"Notified backend: {event} - {response.status_code}")
    except Exception as e:
        logger.warning(f"Failed to notify backend: {e}")


# ============================================================================
# Endpoints
# ============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "biometric-recognition"}


@app.post("/capture", response_model=CapturePhotoResponse)
async def capture_photo(request: CapturePhotoRequest, background_tasks: BackgroundTasks):
    """
    Capture visitor photo and extract face encoding.
    POST /capture
    Body: { visitor_id: int, photo_base64: string }
    """
    if not request.photo_base64:
        raise HTTPException(status_code=400, detail="Photo is required")
    
    # Decode image
    image = base64_to_image(request.photo_base64)
    if not image:
        raise HTTPException(status_code=400, detail="Invalid image format")
    
    # Extract face encoding
    encoding = extract_face_encoding(image)
    if encoding is None:
        background_tasks.add_task(
            notify_backend,
            "visitor_face_capture_failed",
            {"visitor_id": request.visitor_id, "reason": "no_face_detected"}
        )
        return CapturePhotoResponse(
            success=False,
            visitor_id=request.visitor_id,
            encoding_saved=False,
            message="No face detected in photo. Please provide a clear face image."
        )
    
    # Save encoding and photo
    encoding_saved = save_face_encoding(request.visitor_id, encoding)
    photo_saved = save_photo(request.visitor_id, image, suffix="registered")
    
    # Notify backend
    background_tasks.add_task(
        notify_backend,
        "visitor_face_captured",
        {
            "visitor_id": request.visitor_id,
            "encoding_saved": encoding_saved,
            "photo_saved": photo_saved,
        }
    )
    
    return CapturePhotoResponse(
        success=encoding_saved,
        visitor_id=request.visitor_id,
        encoding_saved=encoding_saved,
        message="Face encoding saved successfully" if encoding_saved else "Failed to save encoding"
    )


@app.post("/verify", response_model=VerifyPhotoResponse)
async def verify_photo(request: VerifyPhotoRequest, background_tasks: BackgroundTasks):
    """
    Verify if provided photo matches stored face encoding.
    POST /verify
    Body: { visitor_id: int, photo_base64: string, match_threshold?: float }
    """
    # Load stored encoding
    stored_encoding = load_face_encoding(request.visitor_id)
    if stored_encoding is None:
        background_tasks.add_task(
            notify_backend,
            "visitor_face_verify_failed",
            {"visitor_id": request.visitor_id, "reason": "no_stored_encoding"}
        )
        return VerifyPhotoResponse(
            success=False,
            visitor_id=request.visitor_id,
            is_match=False,
            confidence_score=0.0,
            message="No stored face encoding found for this visitor"
        )
    
    # Decode and extract new face encoding
    image = base64_to_image(request.photo_base64)
    if not image:
        raise HTTPException(status_code=400, detail="Invalid image format")
    
    new_encoding = extract_face_encoding(image)
    if new_encoding is None:
        background_tasks.add_task(
            notify_backend,
            "visitor_face_verify_failed",
            {"visitor_id": request.visitor_id, "reason": "no_face_detected"}
        )
        return VerifyPhotoResponse(
            success=False,
            visitor_id=request.visitor_id,
            is_match=False,
            confidence_score=0.0,
            message="No face detected in verification photo"
        )
    
    # Compare encodings
    confidence_score = compare_face_encodings(stored_encoding, new_encoding, request.match_threshold)
    is_match = confidence_score >= CONFIDENCE_THRESHOLD
    
    # Save verification attempt
    save_photo(request.visitor_id, image, suffix=f"verify_{'matched' if is_match else 'unmatched'}")
    
    # Notify backend
    background_tasks.add_task(
        notify_backend,
        "visitor_face_verified",
        {
            "visitor_id": request.visitor_id,
            "is_match": is_match,
            "confidence_score": float(confidence_score),
        }
    )
    
    return VerifyPhotoResponse(
        success=True,
        visitor_id=request.visitor_id,
        is_match=is_match,
        confidence_score=float(confidence_score),
        message="Face matches stored encoding" if is_match else "Face does not match stored encoding"
    )


@app.get("/info/{visitor_id}", response_model=EncodingInfo)
async def get_encoding_info(visitor_id: int):
    """
    Check if a visitor has a stored face encoding.
    GET /info/{visitor_id}
    """
    encoding_path = FACE_ENCODING_DIR / f"visitor_{visitor_id}_encoding.npy"
    has_encoding = encoding_path.exists()
    
    encoded_at = None
    if has_encoding:
        try:
            stat = encoding_path.stat()
            encoded_at = stat.st_mtime  # modification time
        except:
            pass
    
    return EncodingInfo(
        visitor_id=visitor_id,
        has_encoding=has_encoding,
        encoded_at=encoded_at
    )


@app.post("/batch-verify")
async def batch_verify(
    visitor_id: int = Form(...),
    stored_photo: UploadFile = File(...),
    verify_photo: UploadFile = File(...)
):
    """
    Verify by uploading actual files (alternative to base64).
    POST /batch-verify
    Form: visitor_id, stored_photo, verify_photo
    """
    try:
        # Read stored photo
        stored_bytes = await stored_photo.read()
        stored_image = Image.open(BytesIO(stored_bytes))
        stored_encoding = extract_face_encoding(stored_image)
        
        if stored_encoding is None:
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": "No face in stored photo"}
            )
        
        # Read verification photo
        verify_bytes = await verify_photo.read()
        verify_image = Image.open(BytesIO(verify_bytes))
        verify_encoding = extract_face_encoding(verify_image)
        
        if verify_encoding is None:
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": "No face in verification photo"}
            )
        
        # Compare
        confidence_score = compare_face_encodings(stored_encoding, verify_encoding)
        is_match = confidence_score >= CONFIDENCE_THRESHOLD
        
        return {
            "success": True,
            "visitor_id": visitor_id,
            "is_match": is_match,
            "confidence_score": float(confidence_score),
            "message": "Face matches" if is_match else "Face does not match"
        }
    except Exception as e:
        logger.error(f"Batch verify failed: {e}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": str(e)}
        )


@app.delete("/encoding/{visitor_id}")
async def delete_encoding(visitor_id: int):
    """
    Delete stored face encoding for a visitor (GDPR compliance).
    DELETE /encoding/{visitor_id}
    """
    try:
        encoding_path = FACE_ENCODING_DIR / f"visitor_{visitor_id}_encoding.npy"
        if encoding_path.exists():
            encoding_path.unlink()
        
        # Also delete photos
        for photo in PHOTO_DIR.glob(f"visitor_{visitor_id}_*"):
            photo.unlink()
        
        return {"success": True, "message": f"Deleted all biometric data for visitor {visitor_id}"}
    except Exception as e:
        logger.error(f"Error deleting encoding: {e}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": str(e)}
        )


@app.on_event("startup")
async def startup():
    """Log startup information"""
    logger.info(f"Biometric service starting...")
    logger.info(f"Storage directory: {STORAGE_DIR}")
    logger.info(f"Face match tolerance: {FACE_MATCH_TOLERANCE}")
    logger.info(f"Confidence threshold: {CONFIDENCE_THRESHOLD}")
    logger.info(f"Backend URL: {BACKEND_URL}")
