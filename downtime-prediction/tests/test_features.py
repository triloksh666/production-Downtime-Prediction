import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from src.features.engineering import FeatureEngineer, FEATURE_NAMES

def test_feature_engineering_no_leakage_and_correct_columns():
    # Construct synthetic time-series with increasing trend
    base_time = datetime(2026, 1, 1, 8, 0, 0)
    rows = []
    for i in range(30):
        t = base_time + timedelta(seconds=10 * i)
        rows.append({
            "ts": t.isoformat() + "Z",
            "machine_id": "cnc_01",
            "temperature": 60.0 + (i * 0.5), # rising trend
            "vibration": 2.0 + (i * 0.1),
            "motor_current": 20.0,
            "pressure": 6.0,
            "rpm": 4000.0,
            "power_kw": 18.0,
            "cycle_time": 8.0,
            "output_count": 100 + i,
            "reject_count": 2,
            "status": "RUNNING",
            "failure_in_next_30min": 1 if i > 20 else 0,
            "time_to_failure_min": max(5.0, 30.0 - i)
        })

    df = pd.DataFrame(rows)
    feat_df = FeatureEngineer.extract_features_from_df(df)

    for f in FEATURE_NAMES:
        assert f in feat_df.columns, f"Missing feature {f}"

    # Verify slopes are strictly positive due to upward trend
    assert feat_df["temp_slope_15m"].iloc[-1] > 0.0
    assert feat_df["vib_slope_15m"].iloc[-1] > 0.0
