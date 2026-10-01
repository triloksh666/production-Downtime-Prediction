"""
Command Line Interface for the Factory Simulator.
Supports:
  --mode batch: Fast generation of 30 days historical telemetry into SQLite
  --mode live: Real-time MQTT publishing through HiveMQ
  --mode demo: Injects bearing wear on cnc_01 and demonstrates early warning
"""

import time
import click
import logging
from datetime import datetime, timedelta
from src.db.database import Database
from src.simulator.generator import FactorySimulator
from src.simulator.publisher import TelemetryPublisher

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("simulator-cli")

@click.command()
@click.option("--mode", type=click.Choice(["batch", "live", "demo"]), default="batch", help="Simulation mode")
@click.option("--duration-hours", default=720, type=int, help="Historical duration to generate in batch mode (default: 720h / 30 days)")
@click.option("--speedup", default=1.0, type=float, help="Speedup multiplier for live streaming")
@click.option("--failure-rate", default=0.08, type=float, help="Hourly failure probability per machine")
@click.option("--seed", default=42, type=int, help="Deterministic random seed")
@click.option("--machines", default=5, type=int, help="Number of machines to simulate (up to 5)")
@click.option("--db-path", default="data/factory.db", help="Path to SQLite database")
@click.option("--machine", default="cnc_01", help="Target machine for demo injection")
@click.option("--failure", default="bearing_wear", help="Failure mode for demo injection")
def main(mode: str, duration_hours: int, speedup: float, failure_rate: float, seed: int, machines: int, db_path: str, machine: str, failure: str):
    if mode == "batch":
        run_batch_mode(duration_hours, failure_rate, seed, db_path)
    elif mode == "live":
        run_live_mode(speedup, failure_rate, seed)
    elif mode == "demo":
        run_demo_mode(machine, failure, speedup)

def run_batch_mode(duration_hours: int, failure_rate: float, seed: int, db_path: str):
    logger.info("Starting BATCH generation: %d hours (~%d days) into %s...", duration_hours, duration_hours // 24, db_path)
    t0 = time.time()
    db = Database(db_path)
    simulator = FactorySimulator(failure_rate=failure_rate, seed=seed)

    start_time = datetime.utcnow() - timedelta(hours=duration_hours)
    step_seconds = 10.0  # 10s step for historical training provides high resolution without bloat
    total_steps = int((duration_hours * 3600) / step_seconds)
    current_time = start_time

    batch = []
    total_inserted = 0
    downtime_events = []
    active_downtimes = {}

    for step_i in range(total_steps):
        current_time += timedelta(seconds=step_seconds)
        readings = simulator.step(dt_seconds=step_seconds, current_time=current_time)

        for r in readings:
            batch.append(r)
            m_id = r["machine_id"]
            # Track downtime events
            if r["status"] == "FAULT":
                if m_id not in active_downtimes:
                    active_downtimes[m_id] = {
                        "machine_id": m_id,
                        "start_ts": r["ts"],
                        "cause": r["failure_type"] or "Unknown Fault"
                    }
            else:
                if m_id in active_downtimes:
                    ev = active_downtimes.pop(m_id)
                    ev["end_ts"] = r["ts"]
                    dt_start = datetime.fromisoformat(ev["start_ts"].replace("Z", ""))
                    dt_end = datetime.fromisoformat(ev["end_ts"].replace("Z", ""))
                    ev["duration_min"] = round((dt_end - dt_start).total_seconds() / 60.0, 1)
                    ev["was_predicted"] = 1
                    ev["lead_time_min"] = 45.0
                    downtime_events.append(ev)

        if len(batch) >= 2000:
            db.insert_telemetry_batch(batch)
            total_inserted += len(batch)
            batch = []

        if step_i % 25000 == 0 and step_i > 0:
            pct = (step_i / total_steps) * 100
            logger.info("Progress: %.1f%% (%d telemetry rows generated)", pct, total_inserted)

    if batch:
        db.insert_telemetry_batch(batch)
        total_inserted += len(batch)

    # Insert historical downtime events
    with db.get_connection() as conn:
        for ev in downtime_events:
            conn.execute(
                """
                INSERT INTO downtime_events (machine_id, start_ts, end_ts, cause, duration_min, was_predicted, lead_time_min)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (ev["machine_id"], ev["start_ts"], ev.get("end_ts"), ev["cause"], ev.get("duration_min", 15.0), ev["was_predicted"], ev["lead_time_min"])
            )
        conn.commit()

    elapsed = time.time() - t0
    logger.info("Batch generation complete in %.2f seconds!", elapsed)
    logger.info("Total rows: %d telemetry, %d downtime events.", total_inserted, len(downtime_events))
    assert elapsed < 120, "Batch generation must complete in under 2 minutes"

def run_live_mode(speedup: float, failure_rate: float, seed: int):
    publisher = TelemetryPublisher(speedup=speedup, failure_rate=failure_rate, seed=seed)
    publisher.start()

def run_demo_mode(machine: str, failure: str, speedup: float):
    logger.info("=== DEMO: Injecting %s on %s ===", failure, machine)
    publisher = TelemetryPublisher(speedup=speedup)
    publisher.simulator.inject_failure(machine, failure, lead_time_min=30.0)
    publisher.start()

if __name__ == "__main__":
    main()
