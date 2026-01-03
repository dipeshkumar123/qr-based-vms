# Biometrics Microservice for II-VMS
# Face recognition using face_recognition library (dlib + CNN models)

from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import face_recognition
import numpy as np
import cv2
import io
from PIL import Image
import os
from typing import List, Dict, Optional
import asyncpg
import logging
from datetime import datetime
import json

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="II-VMS Biometrics Service", version="0.1.0")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Backend should validate requests; restrict if needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database connection pool
db_pool: Optional[asyncpg.Pool] = None

# Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5434/ii_vms")
FACE_MATCH_THRESHOLD = float(os.getenv("FACE_MATCH_THRESHOLD", "0.6"))  # 0.6 = more strict, 0.5 = lenient
UPLOADS_DIR = os.getenv("UPLOADS_DIR", "/tmp/uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

@app.on_event("startup")
async def startup():
    global db_pool
    try:
        db_pool = await asyncpg.create_pool(DATABASE_URL, min_size=5, max_size=10)
        logger.info("Database connection pool created")
    except Exception as e:
        logger.error(f"Failed to connect to database: {e}")
        raise

@app.on_event("shutdown")
async def shutdown():
    if db_pool:
        await db_pool.close()
        logger.info("Database connection pool closed")

def image_to_face_encodings(image_data: bytes) -> Optional[List[np.ndarray]]:
    """
    Convert image bytes to face encodings.
    Returns list of face encodings; None on error.
    """
    try:
        image = Image.open(io.BytesIO(image_data))
        image_array = np.array(image)
        
        # Convert RGBA to RGB if needed
        if image_array.shape[-1] == 4:
            image_array = cv2.cvtColor(image_array, cv2.COLOR_RGBA2RGB)
        elif len(image_array.shape) == 2:
            image_array = cv2.cvtColor(image_array, cv2.COLOR_GRAY2RGB)
        
        # Detect face locations and encodings
        face_locations = face_recognition.face_locations(image_array, model="hog")  # Use "cnn" for better accuracy but slower
        if not face_locations:
            logger.warning("No faces detected in image")
            return None
        
        face_encodings = face_recognition.face_encodings(image_array, face_locations)
        return face_encodings if face_encodings else None
    except Exception as e:
        logger.error(f"Error processing image: {e}")
        return None

def compare_face_encodings(face_encoding: np.ndarray, reference_encodings: List[np.ndarray]) -> Dict:
    """
    Compare a face encoding against reference encodings.
    Returns: {
        "matched": bool,
        "best_distance": float,
        "confidence": float,  # 1 - distance, normalized to 0-100
        "threshold": float
    }
    """
    if not reference_encodings:
        return {"matched": False, "best_distance": float('inf'), "confidence": 0.0, "threshold": FACE_MATCH_THRESHOLD}
    
    distances = face_recognition.face_distance(reference_encodings, face_encoding)
    best_distance = float(np.min(distances))
    matched = best_distance < FACE_MATCH_THRESHOLD
    confidence = max(0, 100 * (1 - best_distance))
    
    return {
        "matched": matched,
        "best_distance": float(best_distance),
        "confidence": round(confidence, 2),
        "threshold": FACE_MATCH_THRESHOLD,
    }

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "ok", "service": "biometrics"}

@app.post("/api/biometrics/verify/{visitor_token}")
async def verify_face(visitor_token: str, file: UploadFile = File(...)):
    """
    Verify a captured face against stored reference photos for a visitor.
    
    Returns:
    {
        "verified": bool,
        "confidence": float,
        "distance": float,
        "reference_count": int,
        "message": str
    }
    """
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database unavailable")
    
    try:
        image_data = await file.read()
        if not image_data:
            raise HTTPException(status_code=400, detail="Empty image file")
        
        # Extract face encoding from captured image
        captured_encodings = image_to_face_encodings(image_data)
        if not captured_encodings:
            return JSONResponse(
                status_code=400,
                content={
                    "verified": False,
                    "confidence": 0.0,
                    "distance": float('inf'),
                    "reference_count": 0,
                    "message": "No face detected in captured image"
                }
            )
        
        captured_encoding = captured_encodings[0]  # Use first face if multiple
        
        # Fetch reference photos for this visitor
        async with db_pool.acquire() as conn:
            photos = await conn.fetch(
                """
                SELECT id, encoding FROM visitor_photos 
                WHERE visitor_token = $1 AND encoding IS NOT NULL
                ORDER BY created_at DESC
                """,
                visitor_token
            )
        
        if not photos:
            return JSONResponse(
                status_code=404,
                content={
                    "verified": False,
                    "confidence": 0.0,
                    "distance": float('inf'),
                    "reference_count": 0,
                    "message": "No reference photos found for this visitor"
                }
            )
        
        # Deserialize reference encodings
        reference_encodings = []
        for photo in photos:
            try:
                enc = json.loads(photo['encoding'])
                reference_encodings.append(np.array(enc))
            except:
                continue
        
        if not reference_encodings:
            return JSONResponse(
                status_code=400,
                content={
                    "verified": False,
                    "confidence": 0.0,
                    "distance": float('inf'),
                    "reference_count": len(photos),
                    "message": "Reference encodings corrupted or unavailable"
                }
            )
        
        # Compare faces
        result = compare_face_encodings(captured_encoding, reference_encodings)
        
        # Log verification attempt
        async with db_pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO verification_logs 
                (visitor_token, captured_encoding, confidence, distance, verified, created_at)
                VALUES ($1, $2, $3, $4, $5, NOW())
                """,
                visitor_token,
                json.dumps(captured_encoding.tolist()),
                result["confidence"],
                result["best_distance"],
                result["matched"]
            )
        
        return {
            "verified": result["matched"],
            "confidence": result["confidence"],
            "distance": result["best_distance"],
            "reference_count": len(reference_encodings),
            "message": "Face verification successful" if result["matched"] else "Face does not match stored references"
        }
    
    except Exception as e:
        logger.error(f"Verification error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/biometrics/photos/{visitor_token}")
async def add_reference_photo(visitor_token: str, file: UploadFile = File(...)):
    """
    Add a reference photo for a visitor.
    Extracts and stores the face encoding.
    
    Returns:
    {
        "photo_id": int,
        "visitor_token": str,
        "faces_detected": int,
        "encoding_stored": bool,
        "message": str
    }
    """
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database unavailable")
    
    try:
        image_data = await file.read()
        if not image_data:
            raise HTTPException(status_code=400, detail="Empty image file")
        
        # Extract face encodings
        face_encodings = image_to_face_encodings(image_data)
        if not face_encodings:
            return JSONResponse(
                status_code=400,
                content={
                    "photo_id": None,
                    "visitor_token": visitor_token,
                    "faces_detected": 0,
                    "encoding_stored": False,
                    "message": "No face detected in image"
                }
            )
        
        primary_encoding = face_encodings[0]  # Use first/primary face
        
        # Save photo metadata and encoding
        async with db_pool.acquire() as conn:
            photo_id = await conn.fetchval(
                """
                INSERT INTO visitor_photos 
                (visitor_token, encoding, created_at)
                VALUES ($1, $2, NOW())
                RETURNING id
                """,
                visitor_token,
                json.dumps(primary_encoding.tolist())
            )
        
        return {
            "photo_id": photo_id,
            "visitor_token": visitor_token,
            "faces_detected": len(face_encodings),
            "encoding_stored": True,
            "message": f"Reference photo stored with {len(face_encodings)} face(s) detected"
        }
    
    except Exception as e:
        logger.error(f"Photo upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/biometrics/photos/{visitor_token}")
async def list_visitor_photos(visitor_token: str):
    """
    List all reference photos for a visitor.
    
    Returns:
    {
        "visitor_token": str,
        "photos": [{"id": int, "created_at": str}],
        "count": int
    }
    """
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database unavailable")
    
    try:
        async with db_pool.acquire() as conn:
            photos = await conn.fetch(
                """
                SELECT id, created_at FROM visitor_photos 
                WHERE visitor_token = $1
                ORDER BY created_at DESC
                """,
                visitor_token
            )
        
        return {
            "visitor_token": visitor_token,
            "photos": [{"id": p['id'], "created_at": p['created_at'].isoformat()} for p in photos],
            "count": len(photos)
        }
    
    except Exception as e:
        logger.error(f"Error fetching photos: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/biometrics/photos/{photo_id}")
async def delete_reference_photo(photo_id: int):
    """
    Delete a reference photo by ID.
    """
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database unavailable")
    
    try:
        async with db_pool.acquire() as conn:
            result = await conn.execute(
                "DELETE FROM visitor_photos WHERE id = $1",
                photo_id
            )
        
        if result == "DELETE 0":
            raise HTTPException(status_code=404, detail="Photo not found")
        
        return {"ok": True, "photo_id": photo_id, "message": "Photo deleted"}
    
    except Exception as e:
        logger.error(f"Error deleting photo: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/biometrics/verification-logs/{visitor_token}")
async def get_verification_logs(visitor_token: str, limit: int = 50):
    """
    Retrieve verification logs for a visitor.
    
    Returns:
    {
        "visitor_token": str,
        "logs": [{"id": int, "verified": bool, "confidence": float, "distance": float, "created_at": str}],
        "count": int
    }
    """
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database unavailable")
    
    try:
        limit = min(limit, 500)
        async with db_pool.acquire() as conn:
            logs = await conn.fetch(
                """
                SELECT id, verified, confidence, distance, created_at FROM verification_logs 
                WHERE visitor_token = $1
                ORDER BY created_at DESC
                LIMIT $2
                """,
                visitor_token,
                limit
            )
        
        return {
            "visitor_token": visitor_token,
            "logs": [
                {
                    "id": log['id'],
                    "verified": log['verified'],
                    "confidence": log['confidence'],
                    "distance": log['distance'],
                    "created_at": log['created_at'].isoformat()
                } 
                for log in logs
            ],
            "count": len(logs)
        }
    
    except Exception as e:
        logger.error(f"Error fetching verification logs: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
