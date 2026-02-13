"""
Analytics Service for II-VMS
Provides intelligent reporting using pandas + scikit-learn
"""

import os
import json
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple

import numpy as np
import pandas as pd
import psycopg2
from psycopg2.extras import RealDictCursor
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import IsolationForest
from sklearn.linear_model import LinearRegression

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database connection
DB_HOST = os.getenv("POSTGRES_HOST", "localhost")
DB_PORT = os.getenv("POSTGRES_PORT", "5432")
DB_USER = os.getenv("POSTGRES_USER", "postgres")
DB_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres")
DB_NAME = os.getenv("POSTGRES_DB", "ii_vms")


def get_db_connection():
    """Create database connection"""
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
        )
        return conn
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        return None


class AnalyticsEngine:
    """Core analytics engine for visitor data"""

    def __init__(self):
        self.conn = get_db_connection()

    def get_visitor_check_ins(self, days: int = 30) -> pd.DataFrame:
        """
        Fetch visitor registration data for past N days
        Uses created_at (registration time) since that's when visitors enter the system
        Returns DataFrame with timestamps
        """
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
            WHERE visitors.created_at >= NOW() - INTERVAL '%d days'
            ORDER BY visitors.created_at DESC
            """ % days

            df = pd.read_sql(query, self.conn)
            logger.info(f"Fetched {len(df)} visitor records")
            return df
        except Exception as e:
            logger.error(f"Failed to fetch check-ins: {e}")
            return pd.DataFrame()

    def get_hourly_distribution(self, days: int = 30) -> Dict[int, int]:
        """
        Get visitor count by hour of day
        Returns dict: {hour: count}
        """
        try:
            df = self.get_visitor_check_ins(days)
            if df.empty:
                return {}

            hourly = df.groupby("hour").size().to_dict()
            # Fill missing hours with 0
            result = {h: hourly.get(h, 0) for h in range(24)}
            return result
        except Exception as e:
            logger.error(f"Failed to compute hourly distribution: {e}")
            return {}

    def predict_peak_hours(self, days: int = 30) -> Dict[str, Any]:
        """
        Predict peak hours using time-series forecasting
        Returns forecast for next 24 hours
        """
        try:
            hourly_data = self.get_hourly_distribution(days)
            if not hourly_data or len(hourly_data) < 5:
                return {"error": "Insufficient data"}

            # Prepare data
            X = np.array(list(range(len(hourly_data)))).reshape(-1, 1)
            y = np.array(list(hourly_data.values()))

            # Train model
            model = LinearRegression()
            model.fit(X, y)

            # Predict next 24 hours
            future_X = np.array(range(24, 48)).reshape(-1, 1)
            predictions = model.predict(future_X)

            # Ensure non-negative predictions
            predictions = np.maximum(predictions, 0)

            # Find peak hours
            peak_indices = np.argsort(predictions)[-3:][::-1]  # Top 3 hours
            peak_hours = [int(i % 24) for i in peak_indices]

            return {
                "forecast": {str(h): float(predictions[h - 24]) for h in range(24)},
                "peak_hours": peak_hours,
                "average_per_hour": float(np.mean(y)),
                "model_accuracy": float(model.score(X, y)),
            }
        except Exception as e:
            logger.error(f"Peak hour prediction failed: {e}")
            return {"error": str(e)}

    def get_frequent_visitors(self, limit: int = 10, min_visits: int = 2) -> List[Dict]:
        """
        Identify frequent visitors based on check-in events
        Uses analytics_events (visitor_check_in) to support repeat visits
        """
        try:
            query = """
            SELECT
                v.id as visitor_id,
                v.name,
                v.email,
                COUNT(ae.*) as visit_count,
                MAX(ae.created_at) as last_visit,
                MIN(ae.created_at) as first_visit,
                ROUND((EXTRACT(EPOCH FROM MAX(ae.created_at) - MIN(ae.created_at)) / 86400)::numeric, 1) as days_as_visitor
            FROM visitors v
            JOIN analytics_events ae
              ON (ae.payload->>'visitor_id')::int = v.id
             AND ae.name = 'visitor_check_in'
            GROUP BY v.id, v.name, v.email
            HAVING COUNT(ae.*) >= %s
            ORDER BY visit_count DESC
            LIMIT %s
            """

            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute(query, (min_visits, limit))
            results = cursor.fetchall()
            cursor.close()

            return [
                {
                    "visitorId": r["visitor_id"],
                    "name": r["name"],
                    "email": r["email"],
                    "visitCount": r["visit_count"],
                    "lastVisit": r["last_visit"].isoformat() if r["last_visit"] else None,
                    "firstVisit": r["first_visit"].isoformat() if r["first_visit"] else None,
                    "daysAsVisitor": float(r["days_as_visitor"]) if r["days_as_visitor"] else 0,
                }
                for r in results
            ]
        except Exception as e:
            logger.error(f"Failed to get frequent visitors: {e}")
            return []

    def detect_suspicious_activity(self, anomaly_threshold: float = 0.05) -> Dict[str, Any]:
        """
        Detect suspicious patterns using Isolation Forest
        Checks for:
        - Unusual visit frequency
        - Unmatched faces during biometric verification
        - Unknown repeat visits
        """
        try:
            # Get visitor metrics
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

            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute(query)
            data = cursor.fetchall()
            cursor.close()

            if not data or len(data) < 5:
                return {"error": "Insufficient data for anomaly detection"}

            # Prepare features
            features = []
            visitor_ids = []
            for row in data:
                days_span = row["days_span"] or 1
                visit_frequency = row["visit_count"] / max(days_span, 1)
                failed_ratio = (
                    row["failed_verifications"] / row["visit_count"]
                    if row["visit_count"] > 0
                    else 0
                )

                features.append(
                    [
                        row["visit_count"],
                        visit_frequency,
                        failed_ratio,
                        row["failed_verifications"],
                    ]
                )
                visitor_ids.append(
                    {
                        "id": row["id"],
                        "name": row["name"],
                        "email": row["email"],
                    }
                )

            # Train Isolation Forest
            X = np.array(features)
            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(X)

            model = IsolationForest(contamination=anomaly_threshold, random_state=42)
            predictions = model.fit_predict(X_scaled)
            scores = model.score_samples(X_scaled)

            # Identify anomalies
            suspicious = []
            for i, pred in enumerate(predictions):
                if pred == -1:  # Anomaly
                    suspicious.append(
                        {
                            **visitor_ids[i],
                            "visitCount": int(features[i][0]),
                            "visitFrequency": float(features[i][1]),
                            "failedVerifications": int(features[i][3]),
                            "suspicionScore": float(scores[i]),
                            "reason": (
                                "High failed verification rate"
                                if features[i][2] > 0.3
                                else "Unusual visit pattern"
                            ),
                        }
                    )

            return {
                "suspicious_count": len(suspicious),
                "anomaly_threshold": anomaly_threshold,
                "suspicious_visitors": sorted(
                    suspicious, key=lambda x: x["suspicionScore"]
                ),
            }
        except Exception as e:
            logger.error(f"Suspicious activity detection failed: {e}")
            return {"error": str(e)}

    def get_visitor_trends(self, days: int = 30) -> List[Dict]:
        """
        Get daily visitor count trend based on registrations
        """
        try:
            df = self.get_visitor_check_ins(days)
            if df.empty:
                return []

            # Group by date
            df["date"] = pd.to_datetime(df["timestamp"]).dt.date
            daily = df.groupby("date").size().reset_index(name="count")

            return [
                {"date": str(row["date"]), "count": int(row["count"])}
                for _, row in daily.iterrows()
            ]
        except Exception as e:
            logger.error(f"Failed to get visitor trends: {e}")
            return []


def get_analytics_report(days: int = 30) -> Dict[str, Any]:
    """
    Generate comprehensive analytics report
    """
    engine = AnalyticsEngine()
    
    # Calculate summary statistics
    trends = engine.get_visitor_trends(days)
    total_visitors = sum(item["count"] for item in trends) if trends else 0
    avg_daily = round(total_visitors / days, 1) if days > 0 else 0

    return {
        "generatedAt": datetime.now().isoformat(),
        "summary": {
            "total_visitors": total_visitors,
            "avg_daily_visitors": avg_daily,
            "period_days": days,
        },
        "peakHours": engine.predict_peak_hours(days),
        "frequentVisitors": engine.get_frequent_visitors(limit=10),
        "suspiciousActivity": engine.detect_suspicious_activity(),
        "visitorTrends": engine.get_visitor_trends(days),
        "hourlyDistribution": engine.get_hourly_distribution(days),
    }
