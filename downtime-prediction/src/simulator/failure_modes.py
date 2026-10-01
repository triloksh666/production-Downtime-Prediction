"""
Physics-informed machine degradation curves and failure mode models.
Models gradual degradation 30-240 minutes before terminal fault,
plus sudden random failures (10%).
"""

import math
from enum import Enum
from typing import Dict, Any, Optional

class FailureType(str, Enum):
    BEARING_WEAR = "bearing_wear"
    OVERHEATING = "overheating"
    MOTOR_OVERLOAD = "motor_overload"
    HYDRAULIC_LEAK = "hydraulic_leak"
    TOOL_WEAR = "tool_wear"
    SUDDEN_ELECTRICAL = "sudden_electrical"
    NONE = "none"

class DegradationModel:
    """
    Simulates physical parameter deviations as degradation progresses from 0.0 (healthy) to 1.0 (terminal failure).
    """

    @staticmethod
    def apply_degradation(
        base_telemetry: Dict[str, Any],
        failure_type: FailureType,
        progress: float  # 0.0 to 1.0
    ) -> Dict[str, Any]:
        """
        Alters base telemetry values according to the active failure mode degradation trajectory.
        Uses exponential and power law growth typical in accelerated life testing (Arrhenius/Weibull).
        """
        telemetry = dict(base_telemetry)
        p = max(0.0, min(progress, 1.0))
        exp_factor = math.pow(p, 1.8) # Non-linear degradation curve

        if failure_type == FailureType.BEARING_WEAR:
            # Bearing wear: rising vibration (exponential) + friction temperature
            telemetry["vibration"] += 4.5 * exp_factor
            telemetry["temperature"] += 18.0 * exp_factor
            telemetry["power_kw"] += 2.5 * p

        elif failure_type == FailureType.OVERHEATING:
            # Cooling radiator or thermal dissipation failure: temperature climbs, power increases
            telemetry["temperature"] += 35.0 * exp_factor
            telemetry["power_kw"] += 5.0 * p
            telemetry["motor_current"] += 4.0 * p

        elif failure_type == FailureType.MOTOR_OVERLOAD:
            # Heavy binding, stator resistance increase: current spikes, RPM droops
            telemetry["motor_current"] += 18.0 * exp_factor
            telemetry["rpm"] = max(200.0, telemetry["rpm"] - 450.0 * exp_factor)
            telemetry["power_kw"] += 8.0 * exp_factor
            telemetry["temperature"] += 12.0 * p

        elif failure_type == FailureType.HYDRAULIC_LEAK:
            # Pneumatic / hydraulic seal decay: pressure drops, cycle time elongates
            telemetry["pressure"] = max(1.2, telemetry["pressure"] - 3.8 * exp_factor)
            telemetry["cycle_time"] += 3.5 * exp_factor

        elif failure_type == FailureType.TOOL_WEAR:
            # Cutting / mill edge blunting: micro-chatter, reject count climbs, cycle time drifts
            telemetry["cycle_time"] += 1.8 * exp_factor
            telemetry["vibration"] += 1.2 * exp_factor
            # Defect probability rises sharply
            if p > 0.4:
                telemetry["reject_count"] += int(1 + 3 * p)

        elif failure_type == FailureType.SUDDEN_ELECTRICAL:
            # Sudden failure with zero warning curve (10% case)
            if p >= 0.95:
                telemetry["motor_current"] = 0.0
                telemetry["rpm"] = 0.0
                telemetry["power_kw"] = 0.0
                telemetry["vibration"] = 0.1

        # Status transition
        if p >= 1.0:
            telemetry["status"] = "FAULT"
        elif p >= 0.65:
            telemetry["status"] = "WARNING"
        elif p > 0.1:
            telemetry["status"] = "RUNNING"

        return telemetry
