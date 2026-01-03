"""
Analytics API endpoint for II-VMS
Integrates with biometric service
"""

import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import logging
import sys

# Add parent directory to path for analytics import
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from analytics import get_analytics_report

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="II-VMS Analytics Service", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyticsRequest(BaseModel):
    days: Optional[int] = 30


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "analytics"}


@app.get("/analytics")
async def get_analytics(days: int = 30):
    """
    Get comprehensive analytics report
    Query params:
    - days: Number of days to analyze (default: 30)
    """
    try:
        if days < 1 or days > 365:
            raise ValueError("Days must be between 1 and 365")

        report = get_analytics_report(days)
        return report
    except Exception as e:
        logger.error(f"Analytics generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/analytics/peak-hours")
async def get_peak_hours(days: int = 30):
    """Get peak hour predictions"""
    try:
        from analytics import AnalyticsEngine

        engine = AnalyticsEngine()
        result = engine.predict_peak_hours(days)
        return result
    except Exception as e:
        logger.error(f"Peak hours failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/analytics/frequent-visitors")
async def get_frequent_visitors(limit: int = 10, min_visits: int = 2):
    """Get frequent visitors"""
    try:
        from analytics import AnalyticsEngine

        engine = AnalyticsEngine()
        result = engine.get_frequent_visitors(limit, min_visits)
        return {"visitors": result}
    except Exception as e:
        logger.error(f"Frequent visitors failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/analytics/suspicious-activity")
async def get_suspicious_activity(threshold: float = 0.05):
    """Detect suspicious activity patterns"""
    try:
        if threshold < 0.01 or threshold > 0.5:
            raise ValueError("Threshold must be between 0.01 and 0.5")

        from analytics import AnalyticsEngine

        engine = AnalyticsEngine()
        result = engine.detect_suspicious_activity(threshold)
        return result
    except Exception as e:
        logger.error(f"Suspicious activity detection failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/analytics/trends")
async def get_visitor_trends(days: int = 30):
    """Get visitor count trends"""
    try:
        from analytics import AnalyticsEngine

        engine = AnalyticsEngine()
        result = engine.get_visitor_trends(days)
        return {"trends": result}
    except Exception as e:
        logger.error(f"Trends failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("ANALYTICS_PORT", "8001"))
    uvicorn.run(app, host="0.0.0.0", port=port)
