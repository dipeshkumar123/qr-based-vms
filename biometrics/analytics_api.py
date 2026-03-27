"""
Analytics API for II-VMS
========================
FastAPI wrapper around the AnalyticsEngine.
Uses a singleton engine with connection pooling.
Sync handlers let FastAPI offload blocking I/O to a thread pool automatically.
"""

import os
import logging

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional

from analytics import get_analytics_report, get_engine

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)
logger = logging.getLogger("analytics-api")

# Service-to-service auth (optional, same key as backend)
SERVICE_API_KEY = os.getenv("SERVICE_API_KEY", "")

app = FastAPI(title="II-VMS Analytics Service", version="2.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def verify_key(x_service_key: Optional[str] = None):
    """Verify service key if configured."""
    if SERVICE_API_KEY and x_service_key != SERVICE_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing service key")


# ── Health ──────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "analytics", "version": "2.0.0"}


# ── Endpoints ───────────────────────────────────────────────────────
# Using `def` (not `async def`) so FastAPI runs them in a thread pool,
# preventing the synchronous pandas/psycopg2 calls from blocking the event loop.

@app.get("/analytics")
def get_analytics(
    days: int = 30,
    x_service_key: Optional[str] = Header(None),
):
    """Get comprehensive analytics report."""
    verify_key(x_service_key)
    try:
        if days < 1 or days > 365:
            raise HTTPException(status_code=400, detail="days must be between 1 and 365")
        return get_analytics_report(days)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Analytics generation failed: %s", e)
        raise HTTPException(status_code=500, detail="Analytics generation failed")


@app.get("/analytics/peak-hours")
def get_peak_hours(
    days: int = 30,
    x_service_key: Optional[str] = Header(None),
):
    """Get peak hour predictions."""
    verify_key(x_service_key)
    try:
        if days < 1 or days > 365:
            raise HTTPException(status_code=400, detail="days must be between 1 and 365")
        engine = get_engine()
        return engine.predict_peak_hours(days)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Peak hours failed: %s", e)
        raise HTTPException(status_code=500, detail="Peak hours analysis failed")


@app.get("/analytics/frequent-visitors")
def get_frequent_visitors(
    limit: int = 10,
    min_visits: int = 2,
    x_service_key: Optional[str] = Header(None),
):
    """Get frequent visitors."""
    verify_key(x_service_key)
    try:
        if limit < 1 or limit > 100:
            raise HTTPException(status_code=400, detail="limit must be between 1 and 100")
        if min_visits < 1:
            raise HTTPException(status_code=400, detail="min_visits must be >= 1")
        engine = get_engine()
        return {"visitors": engine.get_frequent_visitors(limit, min_visits)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Frequent visitors failed: %s", e)
        raise HTTPException(status_code=500, detail="Frequent visitors analysis failed")


@app.get("/analytics/suspicious-activity")
def get_suspicious_activity(
    threshold: float = 0.05,
    x_service_key: Optional[str] = Header(None),
):
    """Detect suspicious activity patterns."""
    verify_key(x_service_key)
    try:
        if threshold < 0.01 or threshold > 0.5:
            raise HTTPException(
                status_code=400, detail="threshold must be between 0.01 and 0.5"
            )
        engine = get_engine()
        return engine.detect_suspicious_activity(threshold)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Suspicious activity detection failed: %s", e)
        raise HTTPException(status_code=500, detail="Suspicious activity analysis failed")


@app.get("/analytics/trends")
def get_visitor_trends(
    days: int = 30,
    x_service_key: Optional[str] = Header(None),
):
    """Get visitor count trends."""
    verify_key(x_service_key)
    try:
        if days < 1 or days > 365:
            raise HTTPException(status_code=400, detail="days must be between 1 and 365")
        engine = get_engine()
        return {"trends": engine.get_visitor_trends(days)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Trends failed: %s", e)
        raise HTTPException(status_code=500, detail="Trends analysis failed")


@app.get("/analytics/status-distribution")
def get_status_distribution(x_service_key: Optional[str] = Header(None)):
    """Get visitor count by status."""
    verify_key(x_service_key)
    try:
        engine = get_engine()
        return engine.get_status_distribution()
    except Exception as e:
        logger.error("Status distribution failed: %s", e)
        raise HTTPException(status_code=500, detail="Status distribution failed")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "analytics_api:app",
        host="0.0.0.0",
        port=int(os.getenv("ANALYTICS_PORT", os.getenv("PORT", "8001"))),
        log_level="info",
    )
