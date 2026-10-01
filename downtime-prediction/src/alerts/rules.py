"""
Alert Rule Definitions and Evaluation Logic.
Combines ML risk levels, hard physical limits, rate-of-change thresholds, and anomaly scores.
"""

from typing import Dict, Any, List, Optional
from dataclasses import dataclass

@dataclass
class AlertEvaluation:
    triggered: bool
    severity: str        # INFO, WARNING, CRITICAL
    type: str            # BEARING_DEGRADATION, OVERHEAT_RISK, PRESSURE_DECAY, HARD_LIMIT_BREACH, ANOMALY_CLUSTER
    message: str
    recommended_action: str
    contributing_feature: str

# Physical machine hard limits
MACHINE_HARD_LIMITS = {
    "cut_01": {"temp_max": 85.0, "vib_max": 5.5, "current_max": 30.0, "pressure_min": 5.0},
    "cnc_01": {"temp_max": 90.0, "vib_max": 6.0, "current_max": 40.0, "pressure_min": 4.8},
    "weld_01": {"temp_max": 88.0, "vib_max": 4.5, "current_max": 28.0, "pressure_min": 5.2},
    "paint_01": {"temp_max": 75.0, "vib_max": 3.5, "current_max": 20.0, "pressure_min": 4.0},
    "pack_01": {"temp_max": 70.0, "vib_max": 4.0, "current_max": 18.0, "pressure_min": 4.5},
}

class AlertRulesEngine:
    @staticmethod
    def evaluate(telemetry: Dict[str, Any], prediction: Optional[Dict[str, Any]] = None) -> List[AlertEvaluation]:
        evaluations: List[AlertEvaluation] = []
        m_id = telemetry.get("machine_id", "unknown")
        limits = MACHINE_HARD_LIMITS.get(m_id, {"temp_max": 85.0, "vib_max": 5.0, "current_max": 30.0, "pressure_min": 4.5})

        # 1. Machine Hardware FAULT Status Check
        if telemetry.get("status") == "FAULT":
            evaluations.append(AlertEvaluation(
                triggered=True,
                severity="CRITICAL",
                type="UNSCHEDULED_DOWNTIME_FAULT",
                message=f"Machine {m_id} entered FAULT state! Production halted.",
                recommended_action="Emergency stop inspection. Dispatch mechanical/electrical technician immediately.",
                contributing_feature="status=FAULT"
            ))

        # 2. Hard Sensor Limits (Physical safety barriers)
        temp = telemetry.get("temperature", 0.0)
        vib = telemetry.get("vibration", 0.0)
        current = telemetry.get("motor_current", 0.0)
        pressure = telemetry.get("pressure", 10.0)

        if temp > limits["temp_max"]:
            evaluations.append(AlertEvaluation(
                triggered=True,
                severity="CRITICAL",
                type="THERMAL_RUNAWAY",
                message=f"{m_id} Temperature exceeded critical ceiling ({temp:.1f}°C > {limits['temp_max']}°C)",
                recommended_action="Reduce machine spindle load and verify coolant pump circulation.",
                contributing_feature=f"temperature={temp:.1f}C"
            ))

        if vib > limits["vib_max"]:
            evaluations.append(AlertEvaluation(
                triggered=True,
                severity="CRITICAL" if vib > (limits["vib_max"] * 1.25) else "WARNING",
                type="EXCESSIVE_VIBRATION",
                message=f"{m_id} Vibration spike ({vib:.2f} mm/s > {limits['vib_max']} mm/s)",
                recommended_action="Check spindle unbalance, chuck clamping, or bearing race degradation.",
                contributing_feature=f"vibration={vib:.2f}mm/s"
            ))

        if current > limits["current_max"]:
            evaluations.append(AlertEvaluation(
                triggered=True,
                severity="WARNING",
                type="MOTOR_OVERCURRENT",
                message=f"{m_id} Motor draw spike ({current:.1f}A > {limits['current_max']}A)",
                recommended_action="Check drive gear alignment and check for mechanical binding.",
                contributing_feature=f"motor_current={current:.1f}A"
            ))

        if pressure < limits["pressure_min"]:
            evaluations.append(AlertEvaluation(
                triggered=True,
                severity="WARNING",
                type="PNEUMATIC_PRESSURE_DROP",
                message=f"{m_id} Pressure decay below floor ({pressure:.1f} bar < {limits['pressure_min']} bar)",
                recommended_action="Inspect pneumatic hose manifold and accumulator valves for leaks.",
                contributing_feature=f"pressure={pressure:.1f}bar"
            ))

        # 3. ML Predictive Early Warning Rules (Before failure happens!)
        if prediction:
            prob = prediction.get("failure_prob", 0.0)
            ttf = prediction.get("predicted_ttf_min", 999.0)
            anomaly = prediction.get("anomaly_score", 0.0)

            if prob >= 0.85 or ttf <= 15.0:
                evaluations.append(AlertEvaluation(
                    triggered=True,
                    severity="CRITICAL",
                    type="PREDICTED_IMMINENT_DOWNTIME",
                    message=f"ML Predictor: 85%+ Downtime probability in <{ttf:.0f} min on {m_id}",
                    recommended_action=f"Schedule controlled stop before line lockup. Prepare spare parts.",
                    contributing_feature=f"failure_prob={prob:.2f}, ttf={ttf:.0f}m"
                ))
            elif prob >= 0.60 or ttf <= 35.0:
                evaluations.append(AlertEvaluation(
                    triggered=True,
                    severity="WARNING",
                    type="PREDICTIVE_MAINTENANCE_WARNING",
                    message=f"ML Predictor: Rising failure probability ({prob*100:.0f}%), TTF ~ {ttf:.0f} min on {m_id}",
                    recommended_action="Flag machine for inspection at next shift change or tool change interval.",
                    contributing_feature=f"failure_prob={prob:.2f}"
                ))
            elif anomaly > 0.80:
                evaluations.append(AlertEvaluation(
                    triggered=True,
                    severity="INFO",
                    type="MULTIVARIATE_ANOMALY",
                    message=f"Isolation Forest flagged anomalous sensor correlation pattern (Score: {anomaly:.2f}) on {m_id}",
                    recommended_action="Monitor telemetry trend. Check sensor calibration.",
                    contributing_feature=f"anomaly_score={anomaly:.2f}"
                ))

        return evaluations
