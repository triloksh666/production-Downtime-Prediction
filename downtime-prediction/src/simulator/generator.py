"""
Factory Line Synthetic Data Generator with shift patterns, realistic Gaussian noise,
continuous degradation tracking, and ML ground-truth labels.
"""

import math
import random
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import numpy as np

from src.simulator.failure_modes import FailureType, DegradationModel

DEFAULT_MACHINES = {
    "cut_01": {
        "name": "Cutting Machine",
        "nominal": {"temp": 52.0, "vib": 1.8, "current": 18.5, "pressure": 8.2, "rpm": 1200, "power": 14.5, "cycle": 3.8}
    },
    "cnc_01": {
        "name": "CNC Milling",
        "nominal": {"temp": 64.0, "vib": 2.1, "current": 24.0, "pressure": 6.5, "rpm": 4800, "power": 22.0, "cycle": 8.5}
    },
    "weld_01": {
        "name": "Welding Robot",
        "nominal": {"temp": 58.0, "vib": 1.4, "current": 15.0, "pressure": 7.0, "rpm": 900, "power": 18.0, "cycle": 5.2}
    },
    "paint_01": {
        "name": "Painting Booth",
        "nominal": {"temp": 45.0, "vib": 0.9, "current": 12.0, "pressure": 5.8, "rpm": 750, "power": 9.5, "cycle": 12.0}
    },
    "pack_01": {
        "name": "Packaging Unit",
        "nominal": {"temp": 42.0, "vib": 1.2, "current": 9.5, "pressure": 6.0, "rpm": 1100, "power": 7.2, "cycle": 2.5}
    }
}

class MachineState:
    def __init__(self, machine_id: str, config: Dict[str, Any], rng: random.Random):
        self.machine_id = machine_id
        self.name = config["name"]
        self.nominal = config["nominal"]
        self.rng = rng
        self.np_rng = np.random.default_rng(self.rng.randint(0, 100000))
        
        # Operational counters
        self.output_count = self.rng.randint(100, 500)
        self.reject_count = self.rng.randint(1, 10)
        self.status = "RUNNING"

        # Failure & degradation trajectory
        self.active_failure: FailureType = FailureType.NONE
        self.degradation_duration_sec: float = 0.0
        self.degradation_elapsed_sec: float = 0.0
        self.time_to_failure_min: Optional[float] = None
        self.cooldown_after_fault_sec: float = 0.0

    def trigger_failure(self, failure_type: FailureType, lead_time_min: float = 60.0):
        self.active_failure = failure_type
        self.degradation_duration_sec = lead_time_min * 60.0
        self.degradation_elapsed_sec = 0.0
        self.time_to_failure_min = lead_time_min
        self.status = "RUNNING"

    def step(self, dt_seconds: float, current_time: datetime) -> Dict[str, Any]:
        hour = current_time.hour
        # Shift load pattern: Shift 1 (6-14: 1.0), Shift 2 (14-22: 1.05 peak), Shift 3 (22-6: 0.9 night)
        shift_load = 1.05 if (14 <= hour < 22) else (0.92 if (22 <= hour or hour < 6) else 1.0)
        
        # Ambient temperature diurnal variation
        ambient_temp_delta = 3.5 * math.sin((hour - 9) * math.pi / 12)

        # Baseline reading with Gaussian sensor noise
        nom = self.nominal
        temperature = nom["temp"] * shift_load + ambient_temp_delta + self.np_rng.normal(0, 0.45)
        vibration = max(0.2, nom["vib"] * shift_load + self.np_rng.normal(0, 0.08))
        motor_current = max(1.0, nom["current"] * shift_load + self.np_rng.normal(0, 0.35))
        pressure = max(0.5, nom["pressure"] + self.np_rng.normal(0, 0.12))
        rpm = max(100.0, nom["rpm"] * (0.99 + 0.02 * self.np_rng.random()))
        power_kw = max(0.5, nom["power"] * shift_load + self.np_rng.normal(0, 0.25))
        cycle_time = max(1.0, nom["cycle"] + self.np_rng.normal(0, 0.1))

        # Output incremental count
        if self.status != "FAULT" and self.status != "MAINTENANCE":
            if self.rng.random() < (dt_seconds / nom["cycle"]):
                self.output_count += 1
                if self.rng.random() < 0.02: # 2% baseline reject rate
                    self.reject_count += 1

        base_telemetry = {
            "ts": current_time.isoformat() + "Z",
            "machine_id": self.machine_id,
            "temperature": round(temperature, 2),
            "vibration": round(vibration, 3),
            "motor_current": round(motor_current, 2),
            "pressure": round(pressure, 2),
            "rpm": round(rpm, 1),
            "power_kw": round(power_kw, 2),
            "cycle_time": round(cycle_time, 2),
            "output_count": self.output_count,
            "reject_count": self.reject_count,
            "status": self.status
        }

        # Handle post-fault recovery maintenance
        if self.status == "FAULT":
            self.cooldown_after_fault_sec += dt_seconds
            # Auto-repair after 180 seconds of downtime
            if self.cooldown_after_fault_sec > 180.0:
                self.status = "RUNNING"
                self.active_failure = FailureType.NONE
                self.cooldown_after_fault_sec = 0.0
                self.degradation_elapsed_sec = 0.0
                self.time_to_failure_min = None
            else:
                base_telemetry["status"] = "FAULT"
                base_telemetry["rpm"] = 0.0
                base_telemetry["power_kw"] = 0.8 # Standby quiescent draw
                return base_telemetry

        # Apply degradation if active
        progress = 0.0
        failure_in_next_30min = 0
        ttf_min = 999.0

        if self.active_failure != FailureType.NONE:
            self.degradation_elapsed_sec += dt_seconds
            progress = min(1.0, self.degradation_elapsed_sec / max(1.0, self.degradation_duration_sec))
            remaining_sec = max(0.0, self.degradation_duration_sec - self.degradation_elapsed_sec)
            ttf_min = round(remaining_sec / 60.0, 1)
            self.time_to_failure_min = ttf_min

            if ttf_min <= 30.0:
                failure_in_next_30min = 1

            # Degrade sensors
            base_telemetry = DegradationModel.apply_degradation(
                base_telemetry, self.active_failure, progress
            )
            self.status = base_telemetry["status"]

            if progress >= 1.0:
                self.status = "FAULT"
                base_telemetry["status"] = "FAULT"

        # Occasional random sensor spike/dropout (0.1% chance)
        if self.rng.random() < 0.001:
            base_telemetry["temperature"] += self.rng.choice([12.0, -8.0])
        if self.rng.random() < 0.001:
            base_telemetry["vibration"] += 2.2

        # Round all values
        for key in ["temperature", "vibration", "motor_current", "pressure", "rpm", "power_kw", "cycle_time"]:
            base_telemetry[key] = round(base_telemetry[key], 2)

        # Ground truth labels for ML
        base_telemetry["failure_in_next_30min"] = failure_in_next_30min
        base_telemetry["time_to_failure_min"] = ttf_min
        base_telemetry["failure_type"] = self.active_failure.value
        base_telemetry["degradation_progress"] = round(progress, 3)

        return base_telemetry


class FactorySimulator:
    def __init__(self, failure_rate: float = 0.08, seed: int = 42):
        self.rng = random.Random(seed)
        self.failure_rate = failure_rate
        self.machines: Dict[str, MachineState] = {
            m_id: MachineState(m_id, cfg, self.rng)
            for m_id, cfg in DEFAULT_MACHINES.items()
        }

    def inject_failure(self, machine_id: str, failure_type_str: str, lead_time_min: float = 45.0) -> bool:
        if machine_id not in self.machines:
            return False
        try:
            ftype = FailureType(failure_type_str)
        except ValueError:
            ftype = FailureType.BEARING_WEAR
        self.machines[machine_id].trigger_failure(ftype, lead_time_min)
        return True

    def step(self, dt_seconds: float, current_time: datetime) -> List[Dict[str, Any]]:
        readings = []
        for m_id, machine in self.machines.items():
            # Chance to spontaneously start a degradation cycle if healthy
            if machine.active_failure == FailureType.NONE and machine.status == "RUNNING":
                # Probability per hour normalized to dt
                p_fail_step = (self.failure_rate / 3600.0) * dt_seconds
                if self.rng.random() < p_fail_step:
                    # Choose failure mode
                    weights = [0.25, 0.22, 0.20, 0.15, 0.08, 0.10] # 10% sudden
                    ftypes = [
                        FailureType.BEARING_WEAR,
                        FailureType.OVERHEATING,
                        FailureType.MOTOR_OVERLOAD,
                        FailureType.HYDRAULIC_LEAK,
                        FailureType.TOOL_WEAR,
                        FailureType.SUDDEN_ELECTRICAL
                    ]
                    chosen = self.rng.choices(ftypes, weights=weights, k=1)[0]
                    # Lead time 30 to 240 mins (sudden is 1-3 mins)
                    lead_time = self.rng.uniform(30.0, 240.0) if chosen != FailureType.SUDDEN_ELECTRICAL else self.rng.uniform(1.0, 3.0)
                    machine.trigger_failure(chosen, lead_time)

            telemetry = machine.step(dt_seconds, current_time)
            readings.append(telemetry)
        return readings
