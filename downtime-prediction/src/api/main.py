"""
FastAPI REST API for Smart Production-Line Downtime Prediction.
Provides endpoints for telemetry, predictions, alerts, and line control.
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import json
from src.db.database import Database

app = FastAPI(
    title="Smart Production-Line Predictive Downtime API",
    version="1.0.0",
    description="IoT telemetry, machine learning predictions, and alert management endpoints."
)

app.add_middleware(
    CORSMSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

db = Database(os.getenv("DB_PATH", "data/factory.db"))

class AckRequest(BaseModel):
    user: str = "operator"

class ControlRequest(BaseModel):
    action: str # inject_failure, pause, resume, set_speedup
    machine_id: Optional[str] = "cnc_01"
    failure_type: Optional[str] = "bearing_wear"
    lead_time_min: Optional[float] = 30.0
    speedup: Optional[float] = 1.0

@app.get("/api/health")
def get_health():
    return {"status": "ONLINE", "database": "CONNECTED", "line": "line1"}

@app.get("/api/machines")
def get_machines():
    with db.get_connection() as conn:
        rows = conn.execute("SELECT * FROM machines ORDER BY position ASC").fetchall()
        return [dict(r) for r in rows]

@app.get("/api/telemetry/latest")
def get_latest_telemetry():
    with db.get_connection() as conn:
        query = """
            SELECT t.* FROM telemetry t
            INNER JOIN (
                SELECT machine_id, MAX(id) as max_id FROM telemetry GROUP BY machine_id
            ) latest ON t.id = latest.max_id
            ORDER BY t.machine_id
        """
        rows = conn.execute(query).fetchall()
        return [dict(r) for r in rows]

@app.get("/api/telemetry/history")
def get_telemetry_history(machine_id: str = "cnc_01", limit: int = Query(60, le=500)):
    with db.get_connection() as conn:
        query = """
            SELECT * FROM telemetry
            WHERE machine_id = ?
            ORDER BY id DESC
            LIMIT ?
        """
        rows = conn.execute(query, (machine_id, limit)).fetchall()
        return [dict(r) for r in reversed(rows)]

@app.get("/api/predictions/latest")
def get_latest_predictions():
    with db.get_connection() as conn:
        query = """
            SELECT p.* FROM predictions p
            INNER JOIN (
                SELECT machine_id, MAX(id) as max_id FROM predictions GROUP BY machine_id
            ) latest ON p.id = latest.max_id
        """
        rows = conn.execute(query).fetchall()
        return [dict(r) for r in rows]

@app.get("/api/alerts")
def get_alerts(acknowledged: Optional[int] = None, limit: int = 50):
    with db.get_connection() as conn:
        if acknowledged is not None:
            query = "SELECT * FROM alerts WHERE acknowledged = ? ORDER BY id DESC LIMIT ?"
            rows = conn.execute(query, (acknowledged, limit)).fetchall()
        else:
            query = "SELECT * FROM alerts ORDER BY id DESC LIMIT ?"
            rows = conn.execute(query, (limit,)).fetchall()
        return [dict(r) for r in rows]

@app.post("/api/alerts/{alert_id}/ack")
def acknowledge_alert(alert_id: int, req: AckRequest):
    success = db.acknowledge_alert(alert_id, req.user)
    if not success:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"success": True, "alert_id": alert_id, "acknowledged_by": req.user}

@app.post("/api/alerts/{alert_id}/resolve")
def resolve_alert(alert_id: int):
    success = db.resolve_alert(alert_id)
    if not success:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"success": True, "alert_id": alert_id}

@app.get("/api/analytics/downtime")
def get_downtime_analytics():
    with db.get_connection() as conn:
        # Pareto of causes
        causes = conn.execute("""
            SELECT cause, COUNT(*) as count, SUM(duration_min) as total_min
            FROM downtime_events
            GROUP BY cause
            ORDER BY total_min DESC
        """).fetchall()

        # MTBF & MTTR summary
        mtbf_stats = conn.execute("""
            SELECT machine_id,
                   COUNT(*) as incidents,
                   AVG(duration_min) as mttr_min
            FROM downtime_events
            GROUP BY machine_id
        """).fetchall()

        return {
            "causes_pareto": [dict(c) for c in causes],
            "machine_mttr": [dict(m) for m in mtbf_stats]
        }
