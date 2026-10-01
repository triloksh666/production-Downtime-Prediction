import React, { useState } from 'react';
import { MachineId, FailureMode } from '../types/factory';
import { MACHINES_CONFIG, FAILURE_DESCRIPTIONS } from '../services/factoryData';
import { lineEngine } from '../services/simulationEngine';
import { X, Play, AlertTriangle, FastForward, RotateCcw, Sparkles } from 'lucide-react';

interface SimulatorControlsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMachine: (id: MachineId) => void;
}

export const SimulatorControlsModal: React.FC<SimulatorControlsModalProps> = ({
  isOpen,
  onClose,
  onSelectMachine
}) => {
  const [selectedMachine, setSelectedMachine] = useState<MachineId>('cnc_01');
  const [selectedFailure, setSelectedFailure] = useState<FailureMode>('bearing_wear');
  const [leadTimeMin, setLeadTimeMin] = useState<number>(30);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleInject = () => {
    lineEngine.injectFailure(selectedMachine, selectedFailure, leadTimeMin);
    onSelectMachine(selectedMachine);
    setFeedback(`Successfully injected ${selectedFailure} into ${MACHINES_CONFIG[selectedMachine].name} with ${leadTimeMin}m trajectory!`);
    setTimeout(() => {
      setFeedback(null);
      onClose();
    }, 1500);
  };

  const handleQuickDemo = () => {
    setSelectedMachine('cnc_01');
    setSelectedFailure('bearing_wear');
    setLeadTimeMin(30);
    lineEngine.setSpeedup(5.0);
    lineEngine.injectFailure('cnc_01', 'bearing_wear', 30.0);
    onSelectMachine('cnc_01');
    setFeedback('⚡ Quick Demo Triggered: Bearing wear on CNC Milling (5x speed)! Watch risk rise!');
    setTimeout(() => {
      setFeedback(null);
      onClose();
    }, 1500);
  };

  const handleResetAll = () => {
    const all: MachineId[] = ['cut_01', 'cnc_01', 'weld_01', 'paint_01', 'pack_01'];
    all.forEach(m => lineEngine.resetMachine(m));
    setFeedback('All 5 line stations reset to healthy nominal state.');
    setTimeout(() => setFeedback(null), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="tech-box rounded-lg max-w-lg w-full p-5 border border-cyan-500/40 shadow-2xl relative bg-white">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-2 mb-4 border-b border-slate-200 pb-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 animate-pulse" />
          <div>
            <h3 className="font-tech text-base font-bold text-slate-900 tracking-wide uppercase">
              Production Line Fault Injector &amp; Simulator
            </h3>
            <p className="text-[11px] font-mono text-slate-500">
              Trigger physics degradation curves to test ML predictive lead time
            </p>
          </div>
        </div>

        {/* Quick Demo Hero Card */}
        <div className="mb-4 p-3 rounded bg-cyan-50 border border-cyan-300 flex items-center justify-between gap-3 shadow-xs">
          <div>
            <div className="font-tech text-xs font-bold text-cyan-900 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-cyan-600" />
              <span>One-Click Automated End-to-End Demo</span>
            </div>
            <div className="text-[10px] text-slate-600 font-mono mt-0.5">
              Injects bearing wear on CNC Spindle at 5x simulation speed
            </div>
          </div>
          <button
            onClick={handleQuickDemo}
            className="px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-tech text-xs font-bold transition-all shadow-sm shrink-0 cursor-pointer"
          >
            Run Demo
          </button>
        </div>

        {/* Feedback message */}
        {feedback && (
          <div className="mb-4 p-2.5 rounded bg-emerald-50 border border-emerald-300 text-emerald-800 font-mono text-xs flex items-center gap-2 font-medium">
            <span>●</span>
            <span>{feedback}</span>
          </div>
        )}

        <div className="space-y-4 font-mono text-xs">
          {/* Target Machine */}
          <div>
            <label className="block text-[11px] font-tech text-slate-700 uppercase mb-1 font-semibold">
              Target Station:
            </label>
            <select
              value={selectedMachine}
              onChange={(e) => setSelectedMachine(e.target.value as MachineId)}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-900 focus:border-cyan-600 focus:outline-none"
            >
              {(Object.keys(MACHINES_CONFIG) as MachineId[]).map((mId) => (
                <option key={mId} value={mId}>
                  {MACHINES_CONFIG[mId].position}. {MACHINES_CONFIG[mId].name} ({mId})
                </option>
              ))}
            </select>
          </div>

          {/* Failure Mode */}
          <div>
            <label className="block text-[11px] font-tech text-slate-700 uppercase mb-1 font-semibold">
              Physical Degradation Mode:
            </label>
            <select
              value={selectedFailure}
              onChange={(e) => setSelectedFailure(e.target.value as FailureMode)}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-900 focus:border-cyan-600 focus:outline-none"
            >
              <option value="bearing_wear">Bearing Wear (Exponential Vibration + Heat)</option>
              <option value="overheating">Cooling / Radiator Failure (Thermal Climb)</option>
              <option value="motor_overload">Motor Overload &amp; Binding (Current Spike + RPM Droop)</option>
              <option value="hydraulic_leak">Pneumatic / Hydraulic Leak (Pressure Decay)</option>
              <option value="tool_wear">Tool Edge Blunting (Chatter + Reject Count Spike)</option>
              <option value="sudden_electrical">Sudden Electrical Disconnect (Zero Warning Trip)</option>
            </select>
            {FAILURE_DESCRIPTIONS[selectedFailure] && (
              <p className="text-[10px] text-slate-500 mt-1">
                {FAILURE_DESCRIPTIONS[selectedFailure].desc}
              </p>
            )}
          </div>

          {/* Lead Time Slider */}
          <div>
            <div className="flex justify-between text-[11px] font-tech text-slate-700 uppercase mb-1 font-semibold">
              <span>Trajectory Lead Time to Terminal Fault:</span>
              <span className="text-amber-700 font-bold">{leadTimeMin} minutes</span>
            </div>
            <input
              type="range"
              min="10"
              max="120"
              step="5"
              value={leadTimeMin}
              onChange={(e) => setLeadTimeMin(Number(e.target.value))}
              className="w-full accent-cyan-600 bg-slate-200 h-1.5 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-slate-500 mt-1 font-medium">
              <span>10m (Fast fail)</span>
              <span>30m (Standard)</span>
              <span>120m (Slow drift)</span>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between gap-3 mt-6 pt-3 border-t border-slate-200">
          <button
            onClick={handleResetAll}
            className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-tech text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset All Stations</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-100 text-slate-700 font-tech text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleInject}
              className="px-4 py-1.5 rounded bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-tech text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              Inject Degradation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
