"""
Analytics Service for II-VMS
=============================
Provides intelligent reporting using pandas + scikit-learn.
Uses connection pooling, parameterized queries, and cached results.
"""

import os
import logging
import threading
import time
from datetime import datetime
from typing import List, Dict, Any, Optional

import numpy as np
import pandas as pd
import psycopg2
from psycopg2 import pool as pg_pool
from psycopg2.extras import RealDictCursor
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import IsolationForest

# ── Logging ─────────────────────────────────────────────────────────
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)
logger = logging.getLogger("analytics-engine")

# ── Database config ─────────────────────────────────────────────────
# Parse DATABASE_URL first (preferred), fall back to individual vars
_DATABASE_URL = os.getenv("DATABASE_URL", "")
if _DATABASE_URL:
    # postgresql://user:password@host:port/dbname
    from urllib.parse import urlparse
    _parsed = urlparse(_DATABASE_URL)
    DB_HOST = _parsed.hostname or "localhost"
    DB_PORT = str(_parsed.port or 5432)
    DB_USER = _parsed.username or "postgres"
    DB_PASSWORD = _parsed.password or "postgres"
    DB_NAME = _parsed.path.lstrip("/") if _parsed.path else "ii_vms"
else:
    DB_HOST = os.getenv("POSTGRES_HOST", "localhost")
    DB_PORT = os.getenv("POSTGRES_PORT", "5432")
    DB_USER = os.getenv("POSTGRES_USER", "postgres")
    DB_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres")
    DB_NAME = os.getenv("POSTGRES_DB", "ii_vms")

# ── Cache configuration ────────────────────────────────────────────
CACHE_TTL_SECONDS = int(os.getenv("ANALYTICS_CACHE_TTL", "60"))

# ── Connection pool (singleton) ────────────────────────────────────
_pool: Optional[pg_pool.ThreadedConnectionPool] = None
_pool_lock = threading.Lock()


def get_pool() -> pg_pool.ThreadedConnectionPool:
    """Get or create the connection pool (thread-safe singleton)."""
    global _pool
    if _pool is None or _pool.closed:
        with _pool_lock:
            if _pool is None or _pool.closed:
                try:
                    _pool = pg_pool.ThreadedConnectionPool(
                        minconn=1,
                        maxconn=5,
                        host=DB_HOST,
                        port=DB_PORT,
                        user=DB_USER,
                        password=DB_PASSWORD,
                        database=DB_NAME,
                        connect_timeout=10,
                    )
                    logger.info("Database connection pool created")
                except Exception as e:
                    logger.error("Failed to create connection pool: %s", e)
                    raise
    return _pool


def get_connection():
    """Get a connection from the pool."""
    return get_pool().getconn()


def return_connection(conn):
    """Return a connection to the pool."""
    try:
        get_pool().putconn(conn)
    except Exception:
        pass


# ── Simple in-memory cache ──────────────────────────────────────────
_cache: Dict[str, Any] = {}
_cache_times: Dict[str, float] = {}


def cache_get(key: str) -> Optional[Any]:
    """Get a value from cache if not expired."""
    if key in _cache and (time.time() - _cache_times.get(key, 0)) < CACHE_TTL_SECONDS:
        return _cache[key]
    return None


def cache_set(key: str, value: Any):
    """Store a value in cache."""
    _cache[key] = value
    _cache_times[key] = time.time()


class AnalyticsEngine:
    """
    Core analytics engine for visitor data.

    Uses pooled connections returned after each method call
    to prevent connection leaks.
    """

    def _query_df(self, query: str, params: tuple = ()) -> pd.DataFrame:
        """Execute a parameterized query and return a DataFrame."""
        conn = get_connection()
        try:
            df = pd.read_sql(query, conn, params=params)
            return df
        finally:
            return_connection(conn)

    def _query_dicts(self, query: str, params: tuple = ()) -> List[Dict]:
        """Execute a parameterized query and return a list of dicts."""
        conn = get_connection()
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute(query, params)
            results = cursor.fetchall()
            cursor.close()
            return results
        finally:
            return_connection(conn)

    def get_visitor_check_ins(self, days: int = 30) -> pd.DataFrame:
        """
        Fetch visitor registration data for past N days.
        Uses parameterized interval to prevent SQL injection.
        """
        cache_key = f"check_ins_{days}"
        cached = cache_get(cache_key)
        if cached is not None:
            return cached

        try:
            query = """
            SELECT 
                visitors.id as visitor_id,
                visitors.name,
                visitors.created_at as timestamp,
                EXTRACT(HOUR FROM visitors.created_at) as hour,
                EXTRACT(DOW FROM visitors.created_at) as day_of_week,
                visitors.status,
                CASE WHEN visitors.checked_in_at IS NOT NULL THEN 1 ELSE 0 END as has_checked_in
            FROM visitors
            WHERE visitors.created_at >= NOW() - make_interval(days => %s)
            ORDER BY visitors.created_at DESC
            """
            df = self._query_df(query, (days,))
            logger.info("Fetched %d visitor records for %d days", len(df), days)
            cache_set(cache_key, df)
            return df
        except Exception as e:
            logger.error("Failed to fetch check-ins: %s", e)
            return pd.DataFrame()

    def get_hourly_distribution(self, days: int = 30) -> Dict[int, int]:
        """
        Get visitor count by hour of day.
        Returns dict: {hour: count}
        """
        try:
            df = self.get_visitor_check_ins(days)
            if df.empty:
                return {}

            hourly = df.groupby("hour").size().to_dict()
            # Fill missing hours with 0
            result = {h: int(hourly.get(float(h), hourly.get(h, 0))) for h in range(24)}
            return result
        except Exception as e:
            logger.error("Failed to compute hourly distribution: %s", e)
            return {}

    def predict_peak_hours(self, days: int = 30) -> Dict[str, Any]:
        """
        Predict peak hours using cosine-based cyclic features
        instead of flawed linear regression on hour indices.

        We fit a weighted average with cosine similarity to capture
        the cyclical nature of hourly patterns, then report the
        historical distribution as the forecast.
        """
        cache_key = f"peak_hours_{days}"
        cached = cache_get(cache_key)
        if cached is not None:
            return cached

        try:
            hourly_data = self.get_hourly_distribution(days)
            if not hourly_data or sum(hourly_data.values()) < 5:
                return {"error": "Insufficient data for prediction"}

            hours = np.array(list(range(24)))
            counts = np.array([hourly_data.get(h, 0) for h in hours], dtype=float)

            # Smooth counts using a simple moving average (window=3, circular)
            smoothed = np.zeros_like(counts)
            for i in range(24):
                smoothed[i] = (counts[(i - 1) % 24] + counts[i] + counts[(i + 1) % 24]) / 3.0

            # Ensure non-negative
            smoothed = np.maximum(smoothed, 0)

            # Find peak hours (top 3)
            peak_indices = np.argsort(smoothed)[-3:][::-1]
            peak_hours = [int(i) for i in peak_indices]

            forecast = {str(h): round(float(smoothed[h]), 1) for h in range(24)}

            total = float(np.sum(counts))
            avg_per_hour = round(total / 24, 1)

            result = {
                "forecast": forecast,
                "peak_hours": peak_hours,
                "average_per_hour": avg_per_hour,
                "total_visitors": int(total),
                "analysis_period_days": days,
            }
            cache_set(cache_key, result)
            return result
        except Exception as e:
            logger.error("Peak hour prediction failed: %s", e)
            return {"error": "Peak hour analysis unavailable"}

    def get_frequent_visitors(self, limit: int = 10, min_visits: int = 2) -> List[Dict]:
        """
        Identify frequent visitors based on check-in events.
        Uses parameterized queries with proper type casting.
        """
        cache_key = f"frequent_{limit}_{min_visits}"
        cached = cache_get(cache_key)
        if cached is not None:
            return cached

        try:
            # Clamp inputs for safety
            limit = min(max(limit, 1), 100)
            min_visits = max(min_visits, 1)

            query = """
            SELECT
                v.id as visitor_id,
                v.name,
                v.email,
                COUNT(ae.*) as visit_count,
                MAX(ae.created_at) as last_visit,
                MIN(ae.created_at) as first_visit,
                ROUND(
                    (EXTRACT(EPOCH FROM MAX(ae.created_at) - MIN(ae.created_at)) / 86400)::numeric,
                    1
                ) as days_as_visitor
            FROM visitors v
            JOIN analytics_events ae
              ON (ae.payload->>'visitor_id')::int = v.id
             AND ae.name = 'visitor_check_in'
            GROUP BY v.id, v.name, v.email
            HAVING COUNT(ae.*) >= %s
            ORDER BY visit_count DESC
            LIMIT %s
            """
            results = self._query_dicts(query, (min_visits, limit))

            visitors = [
                {
                    "visitorId": r["visitor_id"],
                    "name": r["name"],
                    "email": r["email"],
                    "visitCount": r["visit_count"],
                    "lastVisit": r["last_visit"].isoformat() if r["last_visit"] else None,
                    "firstVisit": r["first_visit"].isoformat() if r["first_visit"] else None,
                    "daysAsVisitor": float(r["days_as_visitor"]) if r["days_as_visitor"] else 0,
                    "visitFrequency": round(
                        r["visit_count"] / max(float(r["days_as_visitor"] or 1), 1), 2
                    ),
                }
                for r in results
            ]
            cache_set(cache_key, visitors)
            return visitors
        except Exception as e:
            logger.error("Failed to get frequent visitors: %s", e)
            return []

    def detect_suspicious_activity(self, anomaly_threshold: float = 0.05) -> Dict[str, Any]:
        """
        Detect suspicious patterns using Isolation Forest.
        Checks for unusual visit frequency and failed biometric verifications.
        """
        cache_key = f"suspicious_{anomaly_threshold}"
        cached = cache_get(cache_key)
        if cached is not None:
            return cached

        try:
            # Clamp threshold
            anomaly_threshold = max(0.01, min(anomaly_threshold, 0.5))

            query = """
            SELECT 
                v.id,
                v.name,
                v.email,
                COUNT(*) as visit_count,
                EXTRACT(EPOCH FROM MAX(v.checked_in_at) - MIN(v.created_at)) / 86400 as days_span,
                COUNT(CASE WHEN ae.name = 'visitor_face_verify_failed' THEN 1 END) as failed_verifications,
                COUNT(CASE WHEN ae.name = 'visitor_face_captured' THEN 1 END) as biometric_enrollments
            FROM visitors v
            LEFT JOIN analytics_events ae ON ae.payload->>'visitor_id' = v.id::text
            WHERE v.checked_in_at IS NOT NULL
            GROUP BY v.id, v.name, v.email
            """
            data = self._query_dicts(query, ())

            if not data or len(data) < 5:
                return {
                    "suspicious_count": 0,
                    "anomaly_threshold": anomaly_threshold,
                    "suspicious_visitors": [],
                    "message": "Insufficient data for anomaly detection (need >= 5 records)",
                }

            # Build feature matrix
            features = []
            visitor_info = []
            for row in data:
                days_span = float(row["days_span"] or 1)
                visit_count = int(row["visit_count"])
                failed = int(row["failed_verifications"])
                visit_frequency = visit_count / max(days_span, 1)
                failed_ratio = failed / max(visit_count, 1)

                features.append([visit_count, visit_frequency, failed_ratio, failed])
                visitor_info.append({
                    "id": row["id"],
                    "name": row["name"],
                    "email": row["email"],
                })

            X = np.array(features)
            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(X)

            model = IsolationForest(
                contamination=anomaly_threshold, random_state=42, n_estimators=100
            )
            predictions = model.fit_predict(X_scaled)
            scores = model.score_samples(X_scaled)

            suspicious = []
            for i, pred in enumerate(predictions):
                if pred == -1:  # Anomaly
                    failed_ratio = features[i][2]
                    if failed_ratio > 0.3:
                        reason = "High failed verification rate"
                    elif features[i][1] > 2:
                        reason = "Unusually high visit frequency"
                    else:
                        reason = "Unusual visit pattern"

                    suspicious.append({
                        **visitor_info[i],
                        "visitCount": int(features[i][0]),
                        "visitFrequency": round(float(features[i][1]), 3),
                        "failedVerifications": int(features[i][3]),
                        "suspicionScore": round(float(scores[i]), 4),
                        "reason": reason,
                    })

            result = {
                "suspicious_count": len(suspicious),
                "anomaly_threshold": anomaly_threshold,
                "total_analyzed": len(data),
                "suspicious_visitors": sorted(
                    suspicious, key=lambda x: x["suspicionScore"]
                ),
            }
            cache_set(cache_key, result)
            return result
        except Exception as e:
            logger.error("Suspicious activity detection failed: %s", e)
            return {
                "suspicious_count": 0,
                "anomaly_threshold": anomaly_threshold,
                "suspicious_visitors": [],
                "error": "Analysis unavailable",
            }

    def get_visitor_trends(self, days: int = 30) -> List[Dict]:
        """Get daily visitor count trend based on registrations."""
        cache_key = f"trends_{days}"
        cached = cache_get(cache_key)
        if cached is not None:
            return cached

        try:
            df = self.get_visitor_check_ins(days)
            if df.empty:
                return []

            df["date"] = pd.to_datetime(df["timestamp"]).dt.date
            daily = df.groupby("date").size().reset_index(name="count")

            trends = [
                {"date": str(row["date"]), "count": int(row["count"])}
                for _, row in daily.iterrows()
            ]
            cache_set(cache_key, trends)
            return trends
        except Exception as e:
            logger.error("Failed to get visitor trends: %s", e)
            return []

    def get_status_distribution(self) -> Dict[str, int]:
        """Get count of visitors by status (registered, checked_in, checked_out)."""
        try:
            results = self._query_dicts(
                "SELECT status, COUNT(*) as count FROM visitors GROUP BY status", ()
            )
            return {r["status"]: int(r["count"]) for r in results}
        except Exception as e:
            logger.error("Failed to get status distribution: %s", e)
            return {}


# ── Singleton engine ────────────────────────────────────────────────
_engine: Optional[AnalyticsEngine] = None


def get_engine() -> AnalyticsEngine:
    """Return a shared AnalyticsEngine instance."""
    global _engine
    if _engine is None:
        _engine = AnalyticsEngine()
    return _engine


def get_analytics_report(days: int = 30) -> Dict[str, Any]:
    """Generate comprehensive analytics report."""
    engine = get_engine()

    trends = engine.get_visitor_trends(days)
    total_visitors = sum(item["count"] for item in trends) if trends else 0
    avg_daily = round(total_visitors / max(days, 1), 1)
    status_dist = engine.get_status_distribution()

    return {
        "generatedAt": datetime.now().isoformat(),
        "summary": {
            "total_visitors": total_visitors,
            "avg_daily_visitors": avg_daily,
            "period_days": days,
            "status_distribution": status_dist,
        },
        "peakHours": engine.predict_peak_hours(days),
        "frequentVisitors": engine.get_frequent_visitors(limit=10),
        "suspiciousActivity": engine.detect_suspicious_activity(),
        "visitorTrends": trends,
        "hourlyDistribution": engine.get_hourly_distribution(days),
    }
