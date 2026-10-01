import pytest
from src.alerts.rules import AlertRulesEngine

def test_alert_rules_trigger_on_high_vibration():
    telemetry = {
        "machine_id": "cnc_01",
        "temperature": 70.0,
        "vibration": 7.5, # Exceeds 6.0 limit
        "motor_current": 25.0,
        "pressure": 6.0,
        "status": "RUNNING"
    }
    evals = AlertRulesEngine.evaluate(telemetry, prediction=None)
    assert len(evals) > 0
    assert any(e.type == "EXCESSIVE_VIBRATION" and e.severity == "CRITICAL" for e in evals)

def test_alert_rules_trigger_on_ml_predictive_risk():
    telemetry = {
        "machine_id": "cut_01",
        "temperature": 60.0,
        "vibration": 2.2,
        "motor_current": 19.0,
        "pressure": 8.0,
        "status": "RUNNING"
    }
    prediction = {
        "failure_prob": 0.88,
        "predicted_ttf_min": 14.0,
        "anomaly_score": 0.72,
        "risk_level": "CRITICAL"
    }
    evals = AlertRulesEngine.evaluate(telemetry, prediction)
    assert any(e.type == "PREDICTED_IMMINENT_DOWNTIME" for e in evals)

def test_alert_rules_trigger_on_status_fault():
    telemetry = {
        "machine_id": "weld_01",
        "temperature": 55.0,
        "vibration": 1.5,
        "motor_current": 0.0,
        "pressure": 6.8,
        "status": "FAULT"
    }
    evals = AlertRulesEngine.evaluate(telemetry)
    assert any(e.type == "UNSCHEDULED_DOWNTIME_FAULT" and e.severity == "CRITICAL" for e in evals)
