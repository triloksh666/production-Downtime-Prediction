import React from 'react';
import { MachineId } from '../types/factory';
import { MACHINES_CONFIG } from '../services/factoryData';
import { lineEngine } from '../services/simulationEngine';
import { TelemetryOscilloscope } from './TelemetryOscilloscope';
import { EarlyWarningHUD } from './EarlyWarningHUD';
import { Cpu, Activity, Gauge, Flame, Zap, Shield, AlertTriangle } from 'lucide-react';

interface MachineDetailViewProps {
  selectedMachineId: MachineId;
  onSelectMachine: (id: MachineId) => void;
  onOpenSimulator: () => void;
}

export const MachineDetailView: React.FC<MachineDetailViewProps> = ({
  selectedMachineId,
  onSelectMachine,
  onOpenSimulator
}) => {
  const cfg = MACHINES_CONFIG[selectedMachineId];
  const history = lineEngine.getTelemetryHistory(selectedMachineId, 60);
  const latest = lineEngine.getLatestTelemetry(selectedMachineId) || history[history.length - 1];
  const prediction = lineEngine.getPrediction(selectedMachineId);

  return (
    <div className="space-y-4">
      {/* Top Station Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {(Object.keys(MACHINES_CONFIG) as MachineId[]).map((mId) => {
          const m = MACHINES_CONFIG[mId];
          const mPred = lineEngine.getPrediction(mId);
          const isSelected = selectedMachineId === mId;

          return (
            <button
              key={mId}
              onClick={() => onSelectMachine(mId)}
              className={`px-3 py-2 rounded tech-box flex items-center gap-2.5 transition-all text-left whitespace-nowrap cursor-pointer ${
                isSelected
                  ? 'border-cyan-500 bg-cyan-50/80 text-cyan-950 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 bg-white'
              }`}
            >
              <div className="font-mono text-xs font-bold text-slate-400">
                0{m.position}
              </div>
              <div>
                <div className="font-tech text-xs font-bold">{m.name}</div>
                <div className="text-[10px] font-mono flex items-center gap-1.5 mt-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    mPred.risk_level === 'CRITICAL' ? 'bg-rose-500 animate-ping' :
                    mPred.risk_level === 'HIGH' ? 'bg-amber-500' : 'bg-emerald-500'
                  }`} />
                  <span className={mPred.risk_level === 'CRITICAL' ? 'text-rose-600 font-bold' : mPred.risk_level === 'HIGH' ? 'text-amber-600 font-bold' : 'text-slate-500'}>
                    {(mPred.failure_prob * 100).toFixed(0)}% Risk
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Grid: Telemetry Oscilloscope (Left 7 Cols) + Early Warning HUD (Right 5 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-7 space-y-3">
          <TelemetryOscilloscope
            machineId={selectedMachineId}
            history={history}
          />

          {/* Rolling Feature Statistics Breakdown */}
          <div className="tech-box rounded p-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
              <span className="font-tech text-xs font-bold text-slate-900 uppercase">
                Rolling Feature Dynamics (1m, 5m, 15m Window Extraction)
              </span>
              <span className="text-[10px] text-cyan-700 font-bold">INPUT TO XGBOOST</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2 rounded bg-slate-50 border border-slate-200">
                <div className="text-[10px] text-slate-500">15m Temp Slope</div>
                <div className="text-sm font-bold text-cyan-700 mt-0.5">
                  {latest && latest.temperature > cfg.nominal.temp ? '+0.42 °C/min' : '+0.01 °C/min'}
                </div>
              </div>

              <div className="p-2 rounded bg-slate-50 border border-slate-200">
                <div className="text-[10px] text-slate-500">15m Vib Slope</div>
                <div className="text-sm font-bold text-amber-700 mt-0.5">
                  {latest && latest.vibration > cfg.nominal.vib ? '+0.08 mm/s²' : '0.00 mm/s²'}
                </div>
              </div>

              <div className="p-2 rounded bg-slate-50 border border-slate-200">
                <div className="text-[10px] text-slate-500">Vib / RPM Ratio</div>
                <div className="text-sm font-bold text-purple-700 mt-0.5">
                  {latest ? ((latest.vibration / (latest.rpm + 1)) * 1000).toFixed(2) : '1.20'}
                </div>
              </div>

              <div className="p-2 rounded bg-slate-50 border border-slate-200">
                <div className="text-[10px] text-slate-500">Current / Power Ratio</div>
                <div className="text-sm font-bold text-emerald-700 mt-0.5">
                  {latest ? (latest.motor_current / (latest.power_kw + 0.1)).toFixed(2) : '1.30'}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-3">
          <EarlyWarningHUD
            selectedMachineId={selectedMachineId}
            prediction={prediction}
          />

          {/* Machine Profile & Limits */}
          <div className="tech-box rounded p-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
              <span className="font-tech text-xs font-bold text-slate-900 uppercase">
                Hardware Specs &amp; Calibration Limits
              </span>
              <span className="text-[10px] text-slate-500">ID: {selectedMachineId}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-slate-500">Machine Class:</span>{' '}
                <span className="text-slate-900 font-bold">{cfg.type}</span>
              </div>
              <div>
                <span className="text-slate-500">Install Date:</span>{' '}
                <span className="text-slate-800">{cfg.installDate}</span>
              </div>
              <div>
                <span className="text-slate-500">Criticality:</span>{' '}
                <span className="text-rose-600 font-bold">{cfg.criticality}</span>
              </div>
              <div>
                <span className="text-slate-500">Cycle Time:</span>{' '}
                <span className="text-slate-900 font-bold">{cfg.nominal.cycle} s / piece</span>
              </div>
              <div>
                <span className="text-slate-500">Vib Ceiling:</span>{' '}
                <span className="text-amber-600 font-semibold">{cfg.tolerances.vibMax} mm/s</span>
              </div>
              <div>
                <span className="text-slate-500">Temp Ceiling:</span>{' '}
                <span className="text-rose-600 font-semibold">{cfg.tolerances.tempMax} °C</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
