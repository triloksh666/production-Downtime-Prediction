import pytest
from datetime import datetime
from src.simulator.generator import FactorySimulator
from src.simulator.failure_modes import FailureType, DegradationModel

def test_simulator_step_outputs_five_machines():
    sim = FactorySimulator(seed=123)
    readings = sim.step(dt_seconds=1.0, current_time=datetime.utcnow())
    assert len(readings) == 5
    machine_ids = {r["machine_id"] for r in readings}
    assert machine_ids == {"cut_01", "cnc_01", "weld_01", "paint_01", "pack_01"}

def test_bearing_wear_degradation_increases_vibration_and_temperature():
    base = {
        "temperature": 60.0,
        "vibration": 2.0,
        "motor_current": 20.0,
        "pressure": 6.0,
        "rpm": 4000.0,
        "power_kw": 15.0,
        "cycle_time": 8.0,
        "status": "RUNNING"
    }
    healthy = DegradationModel.apply_degradation(base, FailureType.BEARING_WEAR, progress=0.0)
    degraded = DegradationModel.apply_degradation(base, FailureType.BEARING_WEAR, progress=0.8)
    terminal = DegradationModel.apply_degradation(base, FailureType.BEARING_WEAR, progress=1.0)

    assert degraded["vibration"] > healthy["vibration"]
    assert degraded["temperature"] > healthy["temperature"]
    assert degraded["status"] == "WARNING"
    assert terminal["status"] == "FAULT"

def test_hydraulic_leak_drops_pressure():
    base = {
        "temperature": 50.0,
        "vibration": 1.0,
        "motor_current": 15.0,
        "pressure": 7.0,
        "rpm": 1000.0,
        "power_kw": 10.0,
        "cycle_time": 4.0,
        "status": "RUNNING"
    }
    degraded = DegradationModel.apply_degradation(base, FailureType.HYDRAULIC_LEAK, progress=0.7)
    assert degraded["pressure"] < base["pressure"]
    assert degraded["cycle_time"] > base["cycle_time"]
