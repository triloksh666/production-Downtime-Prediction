import React from 'react';
import { MachineId, FactoryAlert, PredictionResult } from '../types/factory';
import { MACHINES_CONFIG } from '../services/factoryData';
import { lineEngine } from '../services/simulationEngine';
import { ShieldAlert, CheckCircle, Clock, AlertTriangle, UserCheck, ShieldCheck } from 'lucide-react';

interface EarlyWarningHUDProps {
  selectedMachineId: MachineId;
  prediction: PredictionResult;
  onAcknowledgeAlert?: (id: string) => void;
  onResolveAlert?: (id: string) => void;
}

export const EarlyWarningHUD: React.FC<EarlyWarningHUDProps> = ({
  selectedMachineId,
  prediction,
  onAcknowledgeAlert,
  onResolveAlert
}) => {
  const cfg = MACHINES_CONFIG[selectedMachineId];
  const allAlerts = lineEngine.getAllAlerts();
  const machineAlerts = allAlerts.filter(a => a.machine_id === selectedMachineId && !a.resolved_at);
  const activeAlert = machineAlerts[0];

  const isCritical = prediction.risk_level === 'CRITICAL' || activeAlert?.severity === 'CRITICAL';
  const isHigh = prediction.risk_level === 'HIGH' || activeAlert?.severity === 'WARNING';

  return (
    <div className={`w-full tech-box ${isCritical ? 'tech-box-red' : isHigh ? 'tech-box-amber' : ''} rounded p-3 select-none flex flex-col justify-between`}>
      {/* Top Header mimicking DataV reference photo/badge */}
      <div className="flex items-start justify-between border-b border-slate-200 pb-2.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-600 animate-pulse" />
            <span className="font-tech text-xs font-bold uppercase tracking-wider text-slate-900">
              Predictive Incident Dispatch
            </span>
          </div>
          <div className="text-[10px] font-mono text-cyan-700 font-bold">
            INCIDENT PROTOCOL: //DISPATCH_007//
          </div>
        </div>

        {/* Operator Badge matching photo block in reference */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-slate-100 border border-slate-200">
          <div className="w-7 h-7 rounded bg-white border border-cyan-500/40 flex items-center justify-center font-tech font-bold text-xs text-cyan-700 shadow-xs">
            LP
          </div>
          <div className="text-left font-mono">
            <div className="text-[10px] font-bold text-slate-900 leading-tight">ENG. LOKI</div>
            <div className="text-[9px] text-slate-500 leading-tight">ID: #0065 · LEAD</div>
          </div>
        </div>
      </div>

      {/* Middle: Gauge + TTF Countdown + Anomaly Index */}
      <div className="grid grid-cols-2 gap-2 my-2.5">
        {/* Failure Probability Block */}
        <div className="p-2.5 rounded bg-slate-50 border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-tech text-slate-600 font-semibold">
            <span>P(Downtime &lt; 30m)</span>
            <span className={`font-mono font-bold ${isCritical ? 'text-rose-600' : isHigh ? 'text-amber-600' : 'text-emerald-600'}`}>
              {prediction.risk_level}
            </span>
          </div>

          <div className="flex items-baseline gap-2 my-1">
            <span className={`font-tech text-3xl font-bold font-code ${isCritical ? 'text-rose-600 glow-red' : isHigh ? 'text-amber-600 glow-amber' : 'text-cyan-700'}`}>
              {(prediction.failure_prob * 100).toFixed(0)}%
            </span>
            <span className="text-[10px] font-mono text-slate-500">XGBoost CLF</span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1">
            <div
              className={`h-full transition-all duration-500 ${isCritical ? 'bg-rose-500' : isHigh ? 'bg-amber-500' : 'bg-cyan-600'}`}
              style={{ width: `${Math.min(100, Math.max(5, prediction.failure_prob * 100))}%` }}
            />
          </div>
        </div>

        {/* Remaining Useful Life / TTF Countdown Block */}
        <div className="p-2.5 rounded bg-slate-50 border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-tech text-slate-600 font-semibold">
            <span>Est. Lead Time (TTF)</span>
            <Clock className="w-3.5 h-3.5 text-slate-400" />
          </div>

          <div className="flex items-baseline gap-1.5 my-1">
            <span className={`font-tech text-3xl font-bold font-code ${prediction.predicted_ttf_min <= 20 ? 'text-rose-600 animate-pulse' : prediction.predicted_ttf_min <= 45 ? 'text-amber-600' : 'text-slate-800'}`}>
              {prediction.predicted_ttf_min < 900 ? prediction.predicted_ttf_min : '> 120'}
            </span>
            <span className="text-xs font-mono text-slate-500 font-semibold">min</span>
          </div>

          <div className="text-[10px] font-mono text-slate-600 truncate">
            Anomaly: <span className="text-cyan-700 font-bold">{(prediction.anomaly_score * 100).toFixed(0)}%</span> (IsoForest)
          </div>
        </div>
      </div>

      {/* Active Alert Banner & Action Handlers */}
      {activeAlert ? (
        <div className="p-2.5 rounded bg-rose-50 border border-rose-300 flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-tech font-bold text-rose-800">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 animate-bounce" />
              <span>{activeAlert.type}</span>
            </div>
            <span className="text-[10px] font-mono text-slate-500">
              {activeAlert.ts.substring(11, 19)} UTC
            </span>
          </div>

          <div className="text-[11px] text-slate-800 font-sans leading-tight">
            {activeAlert.message}
          </div>

          <div className="text-[10px] font-mono text-amber-900 bg-amber-50 p-1.5 rounded border border-amber-300">
            <span className="text-amber-800 font-bold">ACTION:</span> {activeAlert.recommended_action}
          </div>

          {/* Action Buttons: Acknowledge & Resolve */}
          <div className="flex items-center gap-2 pt-1">
            {!activeAlert.acknowledged ? (
              <button
                onClick={() => lineEngine.acknowledgeAlert(activeAlert.id)}
                className="flex-1 py-1 rounded bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-900 font-tech text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Acknowledge Alert</span>
              </button>
            ) : (
              <div className="flex-1 py-1 text-center font-mono text-[10px] text-emerald-800 bg-emerald-50 rounded border border-emerald-300 flex items-center justify-center gap-1 font-semibold">
                <CheckCircle className="w-3 h-3 text-emerald-600" />
                <span>Ack by {activeAlert.acknowledged_by || 'Operator'}</span>
              </div>
            )}

            <button
              onClick={() => {
                lineEngine.resolveAlert(activeAlert.id);
                lineEngine.resetMachine(selectedMachineId);
              }}
              className="py-1 px-3 rounded bg-cyan-100 hover:bg-cyan-200 border border-cyan-300 text-cyan-900 font-tech text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Resolve &amp; Reset</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="p-3 rounded bg-slate-50 border border-slate-200 flex items-center justify-between text-xs font-mono text-emerald-700">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold">Station operating within nominal envelope</span>
          </div>
          <span className="text-[10px] text-slate-500">Zero Active Alarms</span>
        </div>
      )}
    </div>
  );
};
