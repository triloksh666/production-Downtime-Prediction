"""
Pydantic data models for validating MQTT telemetry and prediction payloads.
"""

from typing import Optional, Literal
from datetime import datetime
from pydantic import BaseModel, Field, field_validator

class TelemetryPayload(BaseModel):
    ts: str = Field(..., description="ISO 8601 UTC timestamp")
    machine_id: str = Field(..., min_length=2, max_length=32)
    temperature: float = Field(..., ge=-20.0, le=200.0)
    vibration: float = Field(..., ge=0.0, le=50.0)
    motor_current: float = Field(..., ge=0.0, le=300.0)
    pressure: float = Field(..., ge=0.0, le=50.0)
    rpm: float = Field(..., ge=0.0, le=20000.0)
    power_kw: float = Field(..., ge=0.0, le=500.0)
    cycle_time: float = Field(..., ge=0.1, le=120.0)
    output_count: int = Field(..., ge=0)
    reject_count: int = Field(..., ge=0)
    status: Literal["RUNNING", "IDLE", "WARNING", "FAULT", "MAINTENANCE"]

    @field_validator("ts")
    def validate_timestamp(cls, v: str) -> str:
        try:
            datetime.fromisoformat(v.replace("Z", "+00:00"))
            return v
        except Exception:
            raise ValueError(f"Invalid timestamp format: {v}")

class PredictionPayload(BaseModel):
    ts: str
    machine_id: str
    failure_prob: float = Field(..., ge=0.0, le=1.0)
    predicted_ttf_min: float = Field(..., ge=0.0)
    anomaly_score: float
    risk_level: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    model_version: str

class AlertPayload(BaseModel):
    ts: str
    machine_id: str
    severity: Literal["INFO", "WARNING", "CRITICAL"]
    type: str
    message: str
    failure_prob: Optional[float] = None
    predicted_ttf_min: Optional[float] = None
    contributing_features: Optional[str] = None
    recommended_action: Optional[str] = None
