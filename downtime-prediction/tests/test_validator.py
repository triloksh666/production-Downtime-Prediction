import pytest
from pydantic import ValidationError
from src.ingestion.validator import TelemetryPayload

def test_telemetry_payload_valid():
    valid_data = {
        "ts": "2026-01-01T10:00:00Z",
        "machine_id": "cnc_01",
        "temperature": 72.4,
        "vibration": 3.1,
        "motor_current": 14.2,
        "pressure": 6.1,
        "rpm": 1480.0,
        "power_kw": 11.3,
        "cycle_time": 4.2,
        "output_count": 120,
        "reject_count": 2,
        "status": "RUNNING"
    }
    payload = TelemetryPayload.model_validate(valid_data)
    assert payload.machine_id == "cnc_01"
    assert payload.temperature == 72.4

def test_telemetry_payload_rejects_out_of_bounds_sensor():
    invalid_data = {
        "ts": "2026-01-01T10:00:00Z",
        "machine_id": "cnc_01",
        "temperature": 999.0, # Exceeds 200.0 limit
        "vibration": 3.1,
        "motor_current": 14.2,
        "pressure": 6.1,
        "rpm": 1480.0,
        "power_kw": 11.3,
        "cycle_time": 4.2,
        "output_count": 120,
        "reject_count": 2,
        "status": "RUNNING"
    }
    with pytest.raises(ValidationError):
        TelemetryPayload.model_validate(invalid_data)
