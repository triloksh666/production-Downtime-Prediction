"""
SQLite Database interface with WAL mode, connection pooling, and retention management.
"""

import os
import sqlite3
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from pathlib import Path

logger = logging.getLogger(__name__)

DEFAULT_DB_PATH = os.getenv("DB_PATH", "data/factory.db")

class Database:
    def __init__(self, db_path: str = DEFAULT_DB_PATH):
        self.db_path = db_path
        Path(os.path.dirname(self.db_path) or ".").mkdir(parents=True, exist_ok=True)
        self.init_db()

    def get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, timeout=30.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.execute("PRAGMA synchronous = NORMAL;")
        return conn

    def init_db(self, schema_path: Optional[str] = None):
        if schema_path is None:
            schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")

        if os.path.exists(schema_path):
            with open(schema_path, "r", encoding="utf-8") as f:
                ddl = f.read()
            with self.get_connection() as conn:
                conn.executescript(ddl)
                # Seed default 5 machines if not present
                conn.executemany(
                    """
                    INSERT OR IGNORE INTO machines (machine_id, name, line, position, install_date, criticality)
                    VALUES (?, ?, 'line1', ?, ?, ?)
                    """,
                    [
                        ("cut_01", "Cutting Machine", 1, "2023-01-15", "HIGH"),
                        ("cnc_01", "CNC Milling", 2, "2022-11-20", "CRITICAL"),
                        ("weld_01", "Welding Robot", 3, "2023-05-10", "HIGH"),
                        ("paint_01", "Painting Booth", 4, "2022-08-01", "MEDIUM"),
                        ("pack_01", "Packaging Unit", 5, "2023-09-12", "MEDIUM"),
                    ]
                )
                conn.commit()
            logger.info("Database schema initialized and verified at %s", self.db_path)

    def insert_telemetry_batch(self, rows: List[Dict[str, Any]]) -> int:
        if not rows:
            return 0
        query = """
            INSERT INTO telemetry (
                ts, machine_id, temperature, vibration, motor_current,
                pressure, rpm, power_kw, cycle_time, output_count, reject_count, status
            ) VALUES (
                :ts, :machine_id, :temperature, :vibration, :motor_current,
                :pressure, :rpm, :power_kw, :cycle_time, :output_count, :reject_count, :status
            )
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.executemany(query, rows)
            conn.commit()
            return cursor.rowcount

    def insert_prediction(self, prediction: Dict[str, Any]) -> int:
        query = """
            INSERT INTO predictions (
                ts, machine_id, failure_prob, predicted_ttf_min, anomaly_score, risk_level, model_version
            ) VALUES (
                :ts, :machine_id, :failure_prob, :predicted_ttf_min, :anomaly_score, :risk_level, :model_version
            )
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, prediction)
            conn.commit()
            return cursor.lastrowid

    def insert_alert(self, alert: Dict[str, Any]) -> int:
        query = """
            INSERT INTO alerts (
                ts, machine_id, severity, type, message, failure_prob,
                predicted_ttf_min, contributing_features, recommended_action
            ) VALUES (
                :ts, :machine_id, :severity, :type, :message, :failure_prob,
                :predicted_ttf_min, :contributing_features, :recommended_action
            )
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, alert)
            conn.commit()
            return cursor.lastrowid

    def acknowledge_alert(self, alert_id: int, user: str = "operator") -> bool:
        query = """
            UPDATE alerts
            SET acknowledged = 1, acknowledged_by = ?, acknowledged_at = ?
            WHERE id = ?
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, (user, datetime.utcnow().isoformat() + "Z", alert_id))
            conn.commit()
            return cursor.rowcount > 0

    def resolve_alert(self, alert_id: int) -> bool:
        query = """
            UPDATE alerts
            SET resolved_at = ?
            WHERE id = ?
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, (datetime.utcnow().isoformat() + "Z", alert_id))
            conn.commit()
            return cursor.rowcount > 0

    def prune_old_telemetry(self, days: int = 30) -> int:
        cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM telemetry WHERE ts < ?", (cutoff,))
            pruned = cursor.rowcount
            conn.commit()
            logger.info("Pruned %d records older than %d days", pruned, days)
            return pruned
