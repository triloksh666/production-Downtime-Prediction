"""
FastAPI Entrypoint for Smart Production-Line Downtime Prediction.
Default entrypoint location recognized by AI Studio and Cloud Run.
"""

import os
import sys
from pathlib import Path
from typing import List, Optional
import sqlite3

# Ensure downtime-prediction is in sys.path
BASE_DIR = Path(__file__).resolve().parent
DOWNTIME_DIR = BASE_DIR / "downtime-prediction"
if DOWNTIME_DIR.exists():
    sys.path.insert(0, str(DOWNTIME_DIR))
sys.path.insert(0, str(BASE_DIR))

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

app = FastAPI(
    title="Smart Production-Line Predictive Downtime API",
    version="1.0.0",
    description="IoT telemetry, machine learning predictions, and alert management endpoints."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = os.getenv("DB_PATH", str(BASE_DIR / "data" / "factory.db"))
Path(os.path.dirname(DB_PATH) or ".").mkdir(parents=True, exist_ok=True)

def get_db():
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    return conn

# Initialize tables if not already present
with get_db() as conn:
    conn.execute("""
        CREATE TABLE IF NOT EXISTS machines (
            machine_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            line TEXT NOT NULL DEFAULT 'line1',
            position INTEGER NOT NULL,
            install_date TEXT NOT NULL,
            criticality TEXT DEFAULT 'MEDIUM'
        );
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS telemetry (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT NOT NULL,
            machine_id TEXT NOT NULL,
            temperature REAL NOT NULL,
            vibration REAL NOT NULL,
            motor_current REAL NOT NULL,
            pressure REAL NOT NULL,
            rpm REAL NOT NULL,
            power_kw REAL NOT NULL,
            cycle_time REAL NOT NULL,
            output_count INTEGER NOT NULL,
            reject_count INTEGER NOT NULL,
            status TEXT NOT NULL
        );
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS predictions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT NOT NULL,
            machine_id TEXT NOT NULL,
            failure_prob REAL NOT NULL,
            predicted_ttf_min REAL NOT NULL,
            anomaly_score REAL NOT NULL,
            risk_level TEXT NOT NULL,
            model_version TEXT NOT NULL
        );
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT NOT NULL,
            machine_id TEXT NOT NULL,
            severity TEXT NOT NULL,
            type TEXT NOT NULL,
            message TEXT NOT NULL,
            failure_prob REAL,
            predicted_ttf_min REAL,
            contributing_features TEXT,
            recommended_action TEXT,
            acknowledged INTEGER DEFAULT 0,
            acknowledged_by TEXT,
            acknowledged_at TEXT,
            resolved_at TEXT
        );
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS downtime_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            machine_id TEXT NOT NULL,
            start_ts TEXT NOT NULL,
            end_ts TEXT,
            cause TEXT NOT NULL,
            duration_min REAL,
            was_predicted INTEGER DEFAULT 0,
            lead_time_min REAL
        );
    """)
    # Seed default 5 machines if empty
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

class AckRequest(BaseModel):
    user: str = "operator"

class ControlRequest(BaseModel):
    action: str
    machine_id: Optional[str] = "cnc_01"
    failure_type: Optional[str] = "bearing_wear"
    lead_time_min: Optional[float] = 30.0
    speedup: Optional[float] = 1.0

@app.get("/api/health")
def get_health():
    return {"status": "ONLINE", "database": "CONNECTED", "line": "line1"}

@app.get("/api/machines")
def get_machines():
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM machines ORDER BY position ASC").fetchall()
        return [dict(r) for r in rows]

@app.get("/api/telemetry/latest")
def get_latest_telemetry():
    with get_db() as conn:
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
    with get_db() as conn:
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
    with get_db() as conn:
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
    with get_db() as conn:
        if acknowledged is not None:
            query = "SELECT * FROM alerts WHERE acknowledged = ? ORDER BY id DESC LIMIT ?"
            rows = conn.execute(query, (acknowledged, limit)).fetchall()
        else:
            query = "SELECT * FROM alerts ORDER BY id DESC LIMIT ?"
            rows = conn.execute(query, (limit,)).fetchall()
        return [dict(r) for r in rows]

@app.post("/api/alerts/{alert_id}/ack")
def acknowledge_alert(alert_id: int, req: AckRequest):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE alerts SET acknowledged = 1, acknowledged_by = ? WHERE id = ?", (req.user, alert_id))
        conn.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Alert not found")
        return {"success": True, "alert_id": alert_id, "acknowledged_by": req.user}

@app.post("/api/alerts/{alert_id}/resolve")
def resolve_alert(alert_id: int):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE alerts SET resolved_at = datetime('now') WHERE id = ?", (alert_id,))
        conn.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Alert not found")
        return {"success": True, "alert_id": alert_id}

@app.get("/api/analytics/downtime")
def get_downtime_analytics():
    with get_db() as conn:
        causes = conn.execute("""
            SELECT cause, COUNT(*) as count, SUM(duration_min) as total_min
            FROM downtime_events
            GROUP BY cause
            ORDER BY total_min DESC
        """).fetchall()

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

# Serve frontend static assets if built
DIST_DIR = BASE_DIR / "dist"
if DIST_DIR.exists() and (DIST_DIR / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=str(DIST_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = DIST_DIR / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(DIST_DIR / "index.html")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 3000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
