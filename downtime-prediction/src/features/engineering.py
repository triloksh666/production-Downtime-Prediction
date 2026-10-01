"""
Feature engineering pipeline for industrial predictive maintenance.
Computes rolling statistics, slopes, EWMA, and domain physics ratios.
Guarantees NO data leakage through strict causal temporal ordering.
"""

import numpy as np
import pandas as pd
from typing import List, Tuple, Dict, Any

FEATURE_NAMES = [
    # 1-minute rolling stats
    "temp_mean_1m", "temp_std_1m",
    "vib_mean_1m", "vib_std_1m",
    "current_mean_1m", "current_std_1m",
    "pressure_mean_1m",
    # 5-minute rolling extremes & EWMA
    "temp_max_5m", "temp_ewma_5m",
    "vib_max_5m", "vib_ewma_5m",
    "current_max_5m", "pressure_min_5m",
    # 15-minute slopes (trends)
    "temp_slope_15m", "vib_slope_15m", "pressure_slope_15m",
    # Domain physics ratios
    "vib_to_rpm_ratio", "current_to_power_ratio",
    # Operational quality & cycle dynamics
    "reject_rate_15m", "cycle_time_drift_15m",
    # Shift indicators
    "shift_evening", "shift_night"
]

def calculate_linear_slope(series: pd.Series) -> float:
    """Computes rate-of-change slope over a sliding window via linear least squares."""
    y = series.dropna().values
    n = len(y)
    if n < 3:
        return 0.0
    x = np.arange(n)
    # Slope = Cov(x, y) / Var(x)
    x_mean = (n - 1) / 2.0
    y_mean = y.mean()
    numerator = np.sum((x - x_mean) * (y - y_mean))
    denominator = np.sum((x - x_mean) ** 2)
    return float(numerator / denominator) if denominator != 0 else 0.0

class FeatureEngineer:
    @staticmethod
    def extract_features_from_df(df: pd.DataFrame) -> pd.DataFrame:
        """
        Takes raw telemetry DataFrame (sorted by ts ASC per machine)
        and computes all temporal and cross-sensor engineered features.
        """
        df = df.copy()
        df["ts_dt"] = pd.to_datetime(df["ts"].str.replace("Z", ""))
        df = df.sort_values(by=["machine_id", "ts_dt"]).reset_index(drop=True)

        feature_rows = []

        for machine_id, m_df in df.groupby("machine_id"):
            m_df = m_df.set_index("ts_dt")

            # 1. Physics cross-sensor ratios (instantaneous)
            vib_to_rpm = (m_df["vibration"] / (m_df["rpm"] + 1.0)) * 1000.0
            current_to_power = m_df["motor_current"] / (m_df["power_kw"] + 0.1)

            # 2. Rolling aggregations (time-indexed)
            # 1 min window (~6 rows @ 10s step)
            temp_mean_1m = m_df["temperature"].rolling("1min", min_periods=1).mean()
            temp_std_1m = m_df["temperature"].rolling("1min", min_periods=1).std().fillna(0.0)
            vib_mean_1m = m_df["vibration"].rolling("1min", min_periods=1).mean()
            vib_std_1m = m_df["vibration"].rolling("1min", min_periods=1).std().fillna(0.0)
            current_mean_1m = m_df["motor_current"].rolling("1min", min_periods=1).mean()
            current_std_1m = m_df["motor_current"].rolling("1min", min_periods=1).std().fillna(0.0)
            pressure_mean_1m = m_df["pressure"].rolling("1min", min_periods=1).mean()

            # 5 min window
            temp_max_5m = m_df["temperature"].rolling("5min", min_periods=1).max()
            temp_ewma_5m = m_df["temperature"].ewm(span=30).mean()
            vib_max_5m = m_df["vibration"].rolling("5min", min_periods=1).max()
            vib_ewma_5m = m_df["vibration"].ewm(span=30).mean()
            current_max_5m = m_df["motor_current"].rolling("5min", min_periods=1).max()
            pressure_min_5m = m_df["pressure"].rolling("5min", min_periods=1).min()

            # 15 min window slopes
            temp_slope_15m = m_df["temperature"].rolling("15min", min_periods=3).apply(calculate_linear_slope, raw=False).fillna(0.0)
            vib_slope_15m = m_df["vibration"].rolling("15min", min_periods=3).apply(calculate_linear_slope, raw=False).fillna(0.0)
            pressure_slope_15m = m_df["pressure"].rolling("15min", min_periods=3).apply(calculate_linear_slope, raw=False).fillna(0.0)
            cycle_time_drift = (m_df["cycle_time"] - m_df["cycle_time"].rolling("15min", min_periods=1).mean()).fillna(0.0)

            # Quality metrics
            output_15m = m_df["output_count"].diff().clip(lower=0).rolling("15min", min_periods=1).sum().replace(0, 1)
            reject_15m = m_df["reject_count"].diff().clip(lower=0).rolling("15min", min_periods=1).sum()
            reject_rate_15m = (reject_15m / output_15m).fillna(0.0)

            # Shift encodings
            hours = m_df.index.hour
            shift_evening = ((hours >= 14) & (hours < 22)).astype(float)
            shift_night = ((hours >= 22) | (hours < 6)).astype(float)

            res = pd.DataFrame({
                "ts": m_df["ts"].values,
                "machine_id": machine_id,
                "temp_mean_1m": temp_mean_1m.values,
                "temp_std_1m": temp_std_1m.values,
                "vib_mean_1m": vib_mean_1m.values,
                "vib_std_1m": vib_std_1m.values,
                "current_mean_1m": current_mean_1m.values,
                "current_std_1m": current_std_1m.values,
                "pressure_mean_1m": pressure_mean_1m.values,
                "temp_max_5m": temp_max_5m.values,
                "temp_ewma_5m": temp_ewma_5m.values,
                "vib_max_5m": vib_max_5m.values,
                "vib_ewma_5m": vib_ewma_5m.values,
                "current_max_5m": current_max_5m.values,
                "pressure_min_5m": pressure_min_5m.values,
                "temp_slope_15m": temp_slope_15m.values,
                "vib_slope_15m": vib_slope_15m.values,
                "pressure_slope_15m": pressure_slope_15m.values,
                "vib_to_rpm_ratio": vib_to_rpm.values,
                "current_to_power_ratio": current_to_power.values,
                "reject_rate_15m": reject_rate_15m.values,
                "cycle_time_drift_15m": cycle_time_drift.values,
                "shift_evening": shift_evening.values,
                "shift_night": shift_night.values,
            }, index=m_df.index)

            # Preserve labels if present in df
            if "failure_in_next_30min" in m_df.columns:
                res["failure_in_next_30min"] = m_df["failure_in_next_30min"].values
            if "time_to_failure_min" in m_df.columns:
                res["time_to_failure_min"] = m_df["time_to_failure_min"].values

            feature_rows.append(res)

        all_features = pd.concat(feature_rows).sort_index().reset_index(drop=True)
        return all_features

    @staticmethod
    def extract_single_observation(recent_telemetries: List[Dict[str, Any]]) -> Dict[str, float]:
        """
        Fast real-time feature extraction for a single machine from its recent in-memory sliding buffer.
        """
        if not recent_telemetries:
            return {f: 0.0 for f in FEATURE_NAMES}

        df = pd.DataFrame(recent_telemetries)
        last = recent_telemetries[-1]

        temps = [r["temperature"] for r in recent_telemetries]
        vibs = [r["vibration"] for r in recent_telemetries]
        currents = [r["motor_current"] for r in recent_telemetries]
        pressures = [r["pressure"] for r in recent_telemetries]

        # 1-min stats (up to last 6 samples)
        t_1m = temps[-6:]
        v_1m = vibs[-6:]
        c_1m = currents[-6:]

        # 5-min stats (up to last 30 samples)
        t_5m = temps[-30:]
        v_5m = vibs[-30:]

        # Slope calculation helper
        def quick_slope(arr):
            if len(arr) < 3:
                return 0.0
            x = np.arange(len(arr))
            xm = x.mean()
            ym = np.mean(arr)
            denom = np.sum((x - xm) ** 2)
            return float(np.sum((x - xm) * (arr - ym)) / denom) if denom > 0 else 0.0

        return {
            "temp_mean_1m": float(np.mean(t_1m)),
            "temp_std_1m": float(np.std(t_1m)),
            "vib_mean_1m": float(np.mean(v_1m)),
            "vib_std_1m": float(np.std(v_1m)),
            "current_mean_1m": float(np.mean(c_1m)),
            "current_std_1m": float(np.std(c_1m)),
            "pressure_mean_1m": float(np.mean(pressures[-6:])),
            "temp_max_5m": float(np.max(t_5m)),
            "temp_ewma_5m": float(pd.Series(t_5m).ewm(span=15).mean().iloc[-1]),
            "vib_max_5m": float(np.max(v_5m)),
            "vib_ewma_5m": float(pd.Series(v_5m).ewm(span=15).mean().iloc[-1]),
            "current_max_5m": float(np.max(currents[-30:])),
            "pressure_min_5m": float(np.min(pressures[-30:])),
            "temp_slope_15m": quick_slope(temps[-90:]),
            "vib_slope_15m": quick_slope(vibs[-90:]),
            "pressure_slope_15m": quick_slope(pressures[-90:]),
            "vib_to_rpm_ratio": float((last["vibration"] / (last["rpm"] + 1.0)) * 1000.0),
            "current_to_power_ratio": float(last["motor_current"] / (last["power_kw"] + 0.1)),
            "reject_rate_15m": 0.02,
            "cycle_time_drift_15m": 0.0,
            "shift_evening": 1.0 if (14 <= datetime.utcnow().hour < 22) else 0.0,
            "shift_night": 1.0 if (22 <= datetime.utcnow().hour or datetime.utcnow().hour < 6) else 0.0,
        }
