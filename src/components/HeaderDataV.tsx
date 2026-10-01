import React, { useState, useEffect } from 'react';
import { Activity, ShieldAlert, Cpu, Wifi, Play, Pause, FastForward, RotateCcw, AlertTriangle } from 'lucide-react';
import { lineEngine } from '../services/simulationEngine';
import { MachineId } from '../types/factory';

interface HeaderDataVProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenSimulator: () => void;
}

export const HeaderDataV: React.FC<HeaderDataVProps> = ({
  currentTab,
  onSelectTab,
  onOpenSimulator
}) => {
  const [timeStr, setTimeStr] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>('');
  const [speedup, setSpeedup] = useState<number>(lineEngine.getSpeedup());
  const [isPaused, setIsPaused] = useState<boolean>(lineEngine.getIsPaused());

  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setTimeStr(d.toTimeString().split(' ')[0]);
      setDateStr(d.toISOString().split('T')[0]);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    return lineEngine.subscribe(() => {
      setSpeedup(lineEngine.getSpeedup());
      setIsPaused(lineEngine.getIsPaused());
    });
  }, []);

  const alerts = lineEngine.getAllAlerts();
  const criticalCount = alerts.filter(a => a.severity === 'CRITICAL' && !a.resolved_at).length;
  const warningCount = alerts.filter(a => a.severity === 'WARNING' && !a.resolved_at).length;

  return (
    <header className="relative w-full border-b border-slate-200 bg-white/95 backdrop-blur-md z-40 select-none shadow-sm">
      {/* Top ambient scanline effect */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-80" />

      <div className="max-w-[1780px] mx-auto px-4 py-2.5 flex flex-col lg:flex-row items-center justify-between gap-3">
        {/* Left: DataV Brand & Subtitle Coordinates */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded bg-cyan-50 border border-cyan-500/40 flex items-center justify-center glow-cyan shadow-sm">
              <Cpu className="w-5 h-5 text-cyan-600 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-tech text-xl font-bold tracking-wider text-slate-900">
                  DATAV
                </span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 text-slate-700 font-mono font-semibold">
                  LINE_1
                </span>
              </div>
              <div className="text-[10px] text-slate-500 tracking-wider font-tech flex items-center gap-2">
                <span>SMART PRODUCTION LINE VISUALIZATION</span>
                <span className="text-cyan-700 font-mono font-semibold">&lt;UX2513, GS2513&gt;</span>
              </div>
            </div>
          </div>

          {/* Early Warning Badges matching reference screenshot */}
          <div className="hidden sm:flex items-center gap-3 pl-4 border-l border-slate-200">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${criticalCount > 0 ? 'bg-rose-500 animate-ping' : 'bg-slate-300'}`} />
              <div className="text-[11px] font-tech text-slate-700">
                Level 1 Early Warning: <span className="font-mono font-bold text-rose-600">{criticalCount}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${warningCount > 0 ? 'bg-amber-500' : 'bg-slate-300'}`} />
              <div className="text-[11px] font-tech text-slate-700">
                Level 2 Warning: <span className="font-mono font-bold text-amber-600">{warningCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Navigation Tabs */}
        <nav className="flex items-center gap-1 p-1 bg-slate-100 rounded border border-slate-200 overflow-x-auto max-w-full">
          {[
            { id: 'overview', label: '1. Line Overview' },
            { id: 'detail', label: '2. Machine Detail' },
            { id: 'alerts', label: '3. Alerts Feed' },
            { id: 'analytics', label: '4. Downtime Analytics' },
            { id: 'ml', label: '5. ML Performance' },
            { id: 'mqtt', label: '6. MQTT Console' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`px-3 py-1.5 text-xs font-tech font-semibold transition-all whitespace-nowrap rounded ${
                currentTab === tab.id
                  ? 'bg-white text-cyan-800 border border-cyan-400 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Right: Controls, Broker State & Real-time Clock */}
        <div className="flex items-center gap-3">
          {/* Quick Simulation Speed & Play/Pause */}
          <div className="flex items-center gap-1 px-2 py-1 rounded bg-slate-100 border border-slate-200">
            <button
              onClick={() => lineEngine.togglePause()}
              title={isPaused ? 'Resume Simulation' : 'Pause Simulation'}
              className="p-1 rounded text-slate-600 hover:text-cyan-600 transition-colors"
            >
              {isPaused ? <Play className="w-3.5 h-3.5 text-amber-600" /> : <Pause className="w-3.5 h-3.5" />}
            </button>
            <span className="text-[11px] font-mono text-cyan-700 font-bold px-1">
              {speedup}x
            </span>
            <button
              onClick={() => {
                const nextSpeed = speedup === 1 ? 5 : speedup === 5 ? 15 : speedup === 15 ? 60 : 1;
                lineEngine.setSpeedup(nextSpeed);
              }}
              title="Cycle Speedup (1x, 5x, 15x, 60x)"
              className="p-1 rounded text-slate-600 hover:text-cyan-600 transition-colors"
            >
              <FastForward className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Fault Injector Action Button */}
          <button
            onClick={onOpenSimulator}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-tech text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Inject Failure</span>
          </button>

          {/* MQTT Broker Status Pill */}
          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-50 border border-emerald-300 text-[11px] text-emerald-800 font-tech font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>HIVEMQ LOCAL</span>
          </div>

          {/* Real-time Clock */}
          <div className="text-right pl-2 border-l border-slate-200">
            <div className="font-mono text-xs font-bold text-slate-800 tabular-nums">
              {timeStr || '12:00:00'}
            </div>
            <div className="text-[10px] font-mono text-slate-500">
              {dateStr || '2026-09-30'} UTC
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
