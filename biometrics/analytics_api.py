"""
Analytics API for II-VMS
========================
FastAPI wrapper around the AnalyticsEngine.
Uses a singleton engine with connection pooling.
Sync handlers let FastAPI offload blocking I/O to a thread pool automatically.
"""

import os
import logging
import time
import threading
from collections import defaultdict, deque
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Header, Request
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

METRICS_WINDOW = int(os.getenv("ANALYTICS_METRICS_WINDOW", "300"))
_metrics_lock = threading.Lock()
_request_metrics = defaultdict(lambda: {
    "count": 0,
    "errors": 0,
    "latencies_ms": deque(maxlen=METRICS_WINDOW),
})

SNAPSHOT_DAYS = [
    int(x.strip())
    for x in os.getenv("ANALYTICS_SNAPSHOT_DAYS", "7,30,90").split(",")
    if x.strip().isdigit()
]
SNAPSHOT_REFRESH_SECONDS = int(os.getenv("ANALYTICS_SNAPSHOT_REFRESH_SECONDS", "300"))
_snapshots = {}
_snapshot_lock = threading.Lock()
_snapshot_thread_started = False

SUSPICIOUS_THRESHOLDS = [
    float(x.strip())
    for x in os.getenv("ANALYTICS_SUSPICIOUS_THRESHOLDS", "0.03,0.05,0.08").split(",")
    if x.strip()
]
SUSPICIOUS_REFRESH_SECONDS = int(os.getenv("ANALYTICS_SUSPICIOUS_REFRESH_SECONDS", "300"))
_suspicious_snapshots = {}
_suspicious_lock = threading.Lock()


def _compute_snapshot(days: int):
    try:
        report = get_analytics_report(days)
        with _snapshot_lock:
            _snapshots[days] = {
                "data": report,
                "generatedAt": datetime.now(timezone.utc).isoformat(),
            }
    except Exception as e:
        logger.warning("Snapshot compute failed for %s days: %s", days, e)


def _compute_suspicious_snapshot(threshold: float):
    try:
        engine = get_engine()
        data = engine.detect_suspicious_activity(threshold)
        with _suspicious_lock:
            _suspicious_snapshots[threshold] = {
                "data": data,
                "generatedAt": datetime.now(timezone.utc).isoformat(),
            }
    except Exception as e:
        logger.warning("Suspicious snapshot compute failed for threshold=%s: %s", threshold, e)


def _snapshot_loop():
    logger.info(
        "Starting analytics snapshot precompute loop for days=%s thresholds=%s",
        SNAPSHOT_DAYS,
        SUSPICIOUS_THRESHOLDS,
    )
    while True:
        for d in SNAPSHOT_DAYS:
            _compute_snapshot(d)
        for t in SUSPICIOUS_THRESHOLDS:
            # Ensure threshold stays in model bounds
            safe_t = max(0.01, min(float(t), 0.5))
            _compute_suspicious_snapshot(safe_t)

        sleep_for = max(30, min(SNAPSHOT_REFRESH_SECONDS, SUSPICIOUS_REFRESH_SECONDS))
        time.sleep(sleep_for)


def _ensure_snapshot_thread_started():
    global _snapshot_thread_started
    if _snapshot_thread_started:
        return
    t = threading.Thread(target=_snapshot_loop, daemon=True, name="analytics-snapshot-loop")
    t.start()
    _snapshot_thread_started = True


def _percentile(sorted_values, pct: float) -> float:
    if not sorted_values:
        return 0.0
    idx = int(round((pct / 100.0) * (len(sorted_values) - 1)))
    return float(sorted_values[max(0, min(idx, len(sorted_values) - 1))])

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or f"analytics-{int(time.time() * 1000)}"
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


@app.on_event("startup")
def start_snapshot_precompute():
    _ensure_snapshot_thread_started()


def verify_key(x_service_key: Optional[str] = None):
    """Verify service key if configured."""
    if SERVICE_API_KEY and x_service_key != SERVICE_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing service key")


# ── Health ──────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "analytics", "version": "2.0.0"}


@app.get("/metrics")
def metrics(x_service_key: Optional[str] = Header(None)):
    """Service telemetry summary (request counts, error rates, latency percentiles)."""
    verify_key(x_service_key)
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

    return {
        "service": "analytics",
        "window_size": METRICS_WINDOW,
        "summary": {
            "requests": total_count,
            "errors": total_errors,
            "error_rate": round((total_errors / total_count) if total_count else 0.0, 4),
        },
        "endpoints": endpoints,
    }


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
        _ensure_snapshot_thread_started()
        with _snapshot_lock:
            snap = _snapshots.get(days)
        if snap:
            data = dict(snap["data"])
            data["snapshot"] = {
                "hit": True,
                "generatedAt": snap.get("generatedAt"),
            }
            return data

        report = get_analytics_report(days)
        with _snapshot_lock:
            _snapshots[days] = {
                "data": report,
                "generatedAt": datetime.now(timezone.utc).isoformat(),
            }
        report = dict(report)
        report["snapshot"] = {"hit": False}
        return report
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
        _ensure_snapshot_thread_started()

        with _suspicious_lock:
            snap = _suspicious_snapshots.get(threshold)
        if snap:
            data = dict(snap["data"])
            data["snapshot"] = {"hit": True, "generatedAt": snap.get("generatedAt")}
            return data

        engine = get_engine()
        result = engine.detect_suspicious_activity(threshold)
        with _suspicious_lock:
            _suspicious_snapshots[threshold] = {
                "data": result,
                "generatedAt": datetime.now(timezone.utc).isoformat(),
            }
        payload = dict(result)
        payload["snapshot"] = {"hit": False}
        return payload
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Suspicious activity detection failed: %s", e)
        raise HTTPException(status_code=500, detail="Suspicious activity analysis failed")


@app.get("/analytics/suspicious-activity/calibration")
def calibrate_suspicious_threshold(
    target_rate: float = 0.05,
    thresholds: str = "",
    x_service_key: Optional[str] = Header(None),
):
    """Calibrate anomaly thresholds against historical patterns."""
    verify_key(x_service_key)
    try:
        if target_rate < 0.01 or target_rate > 0.5:
            raise HTTPException(
                status_code=400, detail="target_rate must be between 0.01 and 0.5"
            )

        if thresholds.strip():
            parsed = []
            for token in thresholds.split(","):
                token = token.strip()
                if not token:
                    continue
                parsed.append(float(token))
            candidate_thresholds = parsed
        else:
            candidate_thresholds = SUSPICIOUS_THRESHOLDS or [0.03, 0.05, 0.08]

        engine = get_engine()
        return engine.calibrate_anomaly_thresholds(candidate_thresholds, target_rate)
    except HTTPException:
        raise
    except ValueError:
        raise HTTPException(status_code=400, detail="thresholds must be comma-separated numbers")
    except Exception as e:
        logger.error("Suspicious threshold calibration failed: %s", e)
        raise HTTPException(status_code=500, detail="Suspicious threshold calibration failed")


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
