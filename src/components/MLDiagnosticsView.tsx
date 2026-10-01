import React from 'react';
import { Cpu, CheckCircle2, TrendingUp, AlertCircle, Database, GitBranch } from 'lucide-react';

export const MLDiagnosticsView: React.FC = () => {
  const metrics = [
    { label: 'Validation Recall', value: '88.4%', target: '≥ 85.0% Req', status: 'PASS' },
    { label: 'Validation Precision', value: '82.6%', target: '≥ 80.0%', status: 'PASS' },
    { label: 'Mean Warning Lead Time', value: '24.5 min', target: '≥ 15.0 min Req', status: 'PASS' },
    { label: 'ROC-AUC Separability', value: '0.942', target: '≥ 0.900', status: 'PASS' },
    { label: 'PR-AUC (Imbalance Score)', value: '0.898', target: '≥ 0.850', status: 'PASS' },
    { label: 'RUL TTF Error (MAE)', value: '±3.8 min', target: '≤ 6.0 min', status: 'PASS' }
  ];

  const confusionMatrix = {
    tp: 172,
    fn: 22,
    fp: 36,
    tn: 1250
  };

  const shapFeatures = [
    { feature: 'temp_slope_15m', importance: 0.32, desc: '15-minute thermal acceleration' },
    { feature: 'vib_mean_1m', importance: 0.28, desc: 'High-frequency spindle vibration' },
    { feature: 'vib_to_rpm_ratio', importance: 0.16, desc: 'Harmonic vibration per unit RPM' },
    { feature: 'temp_max_5m', importance: 0.11, desc: 'Short-term peak temperature' },
    { feature: 'current_mean_1m', importance: 0.08, desc: 'Motor current drag' },
    { feature: 'cycle_time_drift_15m', importance: 0.05, desc: 'Kinematic cycle degradation' }
  ];

  const driftMonitor = [
    { feature: 'vibration', psi: 0.042, status: 'STABLE', pval: 0.42 },
    { feature: 'temperature', psi: 0.068, status: 'STABLE', pval: 0.28 },
    { feature: 'motor_current', psi: 0.125, status: 'MODERATE_DRIFT', pval: 0.04 },
    { feature: 'pressure', psi: 0.031, status: 'STABLE', pval: 0.61 }
  ];

  return (
    <div className="space-y-4">
      {/* Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        {metrics.map(m => (
          <div key={m.label} className="tech-box rounded p-3 font-mono">
            <div className="text-[10px] text-slate-500 font-tech uppercase truncate font-semibold">{m.label}</div>
            <div className="text-xl font-bold text-cyan-800 mt-1">{m.value}</div>
            <div className="text-[9px] text-emerald-700 font-semibold mt-0.5 flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5" />
              <span>{m.target}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Grid: Confusion Matrix + SHAP Waterfall */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Confusion Matrix (5 Cols) */}
        <div className="lg:col-span-5 tech-box rounded p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-600" />
              <span className="font-tech text-xs font-bold text-slate-900 uppercase">
                Confusion Matrix (Held-out Test Set)
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-500">N=1,480</span>
          </div>

          <div className="my-2 space-y-2">
            <div className="grid grid-cols-2 gap-2 text-center font-mono">
              <div className="p-3 rounded bg-emerald-50 border border-emerald-300">
                <div className="text-xs text-emerald-800 font-bold">True Positives (TP)</div>
                <div className="text-2xl font-bold text-emerald-700">{confusionMatrix.tp}</div>
                <div className="text-[10px] text-slate-600">Downtime accurately predicted</div>
              </div>

              <div className="p-3 rounded bg-rose-50 border border-rose-300">
                <div className="text-xs text-rose-800 font-bold">False Negatives (FN)</div>
                <div className="text-2xl font-bold text-rose-700">{confusionMatrix.fn}</div>
                <div className="text-[10px] text-slate-600">Missed sudden failure</div>
              </div>

              <div className="p-3 rounded bg-amber-50 border border-amber-300">
                <div className="text-xs text-amber-800 font-bold">False Positives (FP)</div>
                <div className="text-2xl font-bold text-amber-700">{confusionMatrix.fp}</div>
                <div className="text-[10px] text-slate-600">False alarm tolerance</div>
              </div>

              <div className="p-3 rounded bg-slate-50 border border-slate-200">
                <div className="text-xs text-slate-700 font-bold">True Negatives (TN)</div>
                <div className="text-2xl font-bold text-slate-900">{confusionMatrix.tn}</div>
                <div className="text-[10px] text-slate-600">Healthy running preserved</div>
              </div>
            </div>
          </div>

          <div className="text-[11px] font-mono text-slate-600 p-2 rounded bg-slate-50 border border-slate-200">
            Temporal test split strictly holds out the final 15% of historical timeline to prevent future data leakage.
          </div>
        </div>

        {/* SHAP Feature Waterfall (7 Cols) */}
        <div className="lg:col-span-7 tech-box rounded p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-600" />
              <span className="font-tech text-xs font-bold text-slate-900 uppercase">
                SHAP Feature Attribution Waterfall (GBDT Explainer)
              </span>
            </div>
            <span className="text-[10px] font-mono text-cyan-700 font-bold">GLOBAL |MEAN SHAP|</span>
          </div>

          <div className="space-y-2.5 my-2">
            {shapFeatures.map((f) => (
              <div key={f.feature} className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-800 font-bold">{f.feature}</span>
                  <span className="text-cyan-800 font-bold">{(f.importance * 100).toFixed(0)}% contribution</span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-600 to-blue-600 rounded-full"
                    style={{ width: `${f.importance * 100 * 2.8}%` }}
                  />
                </div>
                <div className="text-[10px] text-slate-500">{f.desc}</div>
              </div>
            ))}
          </div>

          <div className="text-[10px] font-mono text-slate-600 pt-2 border-t border-slate-200">
            Slope and cross-sensor ratios provide 80%+ of early degradation signal before absolute values exceed static limits.
          </div>
        </div>
      </div>

      {/* Model Registry & Drift Monitor */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Model Registry */}
        <div className="tech-box rounded p-3 font-mono">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2 mb-2">
            <Database className="w-4 h-4 text-cyan-600" />
            <span className="font-tech text-xs font-bold text-slate-900 uppercase">
              Model Registry (SQLite: model_registry)
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-2 rounded bg-cyan-50 border border-cyan-300 flex items-center justify-between">
              <div>
                <span className="text-emerald-700 font-bold">● ACTIVE:</span>{' '}
                <span className="text-slate-900 font-bold">XGBoost-v20260930_1800</span>
              </div>
              <span className="text-[10px] text-slate-500">Trained: 2026-09-30</span>
            </div>

            <div className="p-2 rounded bg-slate-50 border border-slate-200 flex items-center justify-between text-slate-600">
              <div>
                <span>ARCHIVED:</span> LightGBM-v20260920_1200
              </div>
              <span className="text-[10px] text-slate-500">Trained: 2026-09-20</span>
            </div>
          </div>
        </div>

        {/* Data Drift Monitor */}
        <div className="tech-box rounded p-3 font-mono">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2 mb-2">
            <GitBranch className="w-4 h-4 text-amber-600" />
            <span className="font-tech text-xs font-bold text-slate-900 uppercase">
              Population Stability Index (PSI) Drift Monitor
            </span>
          </div>

          <div className="space-y-1.5 text-xs">
            {driftMonitor.map(d => (
              <div key={d.feature} className="flex items-center justify-between p-1.5 rounded bg-slate-50 border border-slate-200">
                <span className="text-slate-800 font-medium">{d.feature}</span>
                <span className="text-slate-500">PSI: {d.psi}</span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${d.status === 'STABLE' ? 'bg-emerald-50 text-emerald-800 border border-emerald-300' : 'bg-amber-50 text-amber-800 border border-amber-300'}`}>
                  {d.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
