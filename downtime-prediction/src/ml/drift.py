"""
Data Drift and Concept Drift detection using Population Stability Index (PSI)
and Kolmogorov-Smirnov (KS) tests between baseline reference and current window.
"""

import numpy as np
import pandas as pd
from scipy.stats import ks_2samp
from typing import Dict, Any

def calculate_psi(baseline: np.ndarray, target: np.ndarray, num_bins: int = 10) -> float:
    """
    Computes Population Stability Index (PSI).
    PSI < 0.10: No significant change
    0.10 <= PSI < 0.25: Moderate change / monitor
    PSI >= 0.25: Significant drift / Retraining required
    """
    baseline = baseline[~np.isnan(baseline)]
    target = target[~np.isnan(target)]
    if len(baseline) < 20 or len(target) < 20:
        return 0.0

    # Quantile bins based on baseline
    quantiles = np.linspace(0, 100, num_bins + 1)
    bin_edges = np.percentile(baseline, quantiles)
    bin_edges[0] -= 1e-5
    bin_edges[-1] += 1e-5

    # Frequencies
    base_counts, _ = np.histogram(baseline, bins=bin_edges)
    target_counts, _ = np.histogram(target, bins=bin_edges)

    base_pct = (base_counts + 1e-5) / len(baseline)
    target_pct = (target_counts + 1e-5) / len(target)

    # PSI = sum((Actual% - Expected%) * ln(Actual% / Expected%))
    psi_val = np.sum((target_pct - base_pct) * np.log(target_pct / base_pct))
    return float(psi_val)

class DriftDetector:
    @staticmethod
    def evaluate_drift(baseline_df: pd.DataFrame, current_df: pd.DataFrame, feature_columns: list) -> Dict[str, Any]:
        results = {}
        total_drifted = 0

        for col in feature_columns:
            if col not in baseline_df.columns or col not in current_df.columns:
                continue

            base_vals = baseline_df[col].dropna().values
            curr_vals = current_df[col].dropna().values

            psi = calculate_psi(base_vals, curr_vals)
            ks_stat, p_value = ks_2samp(base_vals, curr_vals)

            drift_flag = (psi >= 0.20) or (p_value < 0.01)
            if drift_flag:
                total_drifted += 1

            results[col] = {
                "psi": round(psi, 4),
                "ks_statistic": round(float(ks_stat), 4),
                "p_value": round(float(p_value), 5),
                "drift_detected": drift_flag,
                "status": "DRIFT_CRITICAL" if psi >= 0.25 else ("DRIFT_MODERATE" if psi >= 0.10 else "STABLE")
            }

        retrain_recommended = (total_drifted / max(1, len(feature_columns))) > 0.25
        return {
            "features": results,
            "total_drifted_features": total_drifted,
            "retrain_recommended": retrain_recommended
        }
