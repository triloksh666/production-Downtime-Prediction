import React, { useState } from 'react';
import { TelemetryReading, MachineId } from '../types/factory';
import { MACHINES_CONFIG } from '../services/factoryData';
import { Activity, Flame, Zap, Gauge } from 'lucide-react';

interface TelemetryOscilloscopeProps {
  machineId: MachineId;
  history: TelemetryReading[];
}

export const TelemetryOscilloscope: React.FC<TelemetryOscilloscopeProps> = ({
  machineId,
  history
}) => {
  const [activeChannel, setActiveChannel] = useState<'all' | 'vibration' | 'temperature' | 'current' | 'pressure'>('all');
  const cfg = MACHINES_CONFIG[machineId];

  if (!history || history.length === 0) {
    return (
      <div className="w-full h-64 tech-box rounded flex items-center justify-center text-slate-500 font-mono text-xs">
        INITIALIZING SENSOR OSCILLOSCOPE...
      </div>
    );
  }

  const latest = history[history.length - 1];

  // SVG dimensions
  const svgWidth = 600;
  const svgHeight = 220;
  const padding = { top: 20, right: 30, bottom: 25, left: 45 };
  const graphWidth = svgWidth - padding.left - padding.right;
  const graphHeight = svgHeight - padding.top - padding.bottom;

  // Helpers to map values to coordinates
  const n = history.length;
  const getX = (index: number) => padding.left + (index / Math.max(1, n - 1)) * graphWidth;

  // 1. Vibration path (0 to 10 mm/s)
  const vibMaxY = Math.max(8.0, cfg.tolerances.vibMax * 1.3);
  const getYVib = (v: number) => padding.top + graphHeight - (Math.min(v, vibMaxY) / vibMaxY) * graphHeight;
  const vibPath = history.map((h, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getYVib(h.vibration)}`).join(' ');

  // 2. Temperature path (20 to 110 °C)
  const tempMinY = 20.0;
  const tempMaxY = 110.0;
  const getYTemp = (t: number) => padding.top + graphHeight - ((Math.min(t, tempMaxY) - tempMinY) / (tempMaxY - tempMinY)) * graphHeight;
  const tempPath = history.map((h, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getYTemp(h.temperature)}`).join(' ');

  // 3. Motor Current path (0 to 50 A)
  const currentMaxY = Math.max(45.0, cfg.tolerances.currentMax * 1.2);
  const getYCurrent = (c: number) => padding.top + graphHeight - (Math.min(c, currentMaxY) / currentMaxY) * graphHeight;
  const currentPath = history.map((h, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getYCurrent(h.motor_current)}`).join(' ');

  // Threshold lines
  const vibLimitY = getYVib(cfg.tolerances.vibMax);
  const tempLimitY = getYTemp(cfg.tolerances.tempMax);

  return (
    <div className="w-full tech-box rounded p-3 select-none flex flex-col justify-between">
      {/* Header with Title and Channel Selectors */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-600 animate-pulse" />
          <span className="font-tech text-xs font-bold text-slate-900 tracking-wide uppercase">
            Live Synchronized Waveforms: {cfg.name}
          </span>
          <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">
            // 60-SEC WINDOW
          </span>
        </div>

        {/* Channel Filters */}
        <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded border border-slate-200 text-[10px] font-mono">
          <button
            onClick={() => setActiveChannel('all')}
            className={`px-2 py-0.5 rounded transition-colors ${activeChannel === 'all' ? 'bg-white text-cyan-800 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            ALL
          </button>
          <button
            onClick={() => setActiveChannel('vibration')}
            className={`px-2 py-0.5 rounded transition-colors ${activeChannel === 'vibration' ? 'bg-white text-amber-800 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            VIB
          </button>
          <button
            onClick={() => setActiveChannel('temperature')}
            className={`px-2 py-0.5 rounded transition-colors ${activeChannel === 'temperature' ? 'bg-white text-rose-800 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            TEMP
          </button>
          <button
            onClick={() => setActiveChannel('current')}
            className={`px-2 py-0.5 rounded transition-colors ${activeChannel === 'current' ? 'bg-white text-blue-800 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            CURRENT
          </button>
        </div>
      </div>

      {/* SVG Oscilloscope Display */}
      <div className="relative w-full h-[220px] overflow-hidden my-1">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-full preserve-3d"
          preserveAspectRatio="none"
        >
          {/* Subtle grid background */}
          <g stroke="rgba(0, 0, 0, 0.06)" strokeWidth="1">
            <line x1={padding.left} y1={padding.top} x2={svgWidth - padding.right} y2={padding.top} />
            <line x1={padding.left} y1={padding.top + graphHeight * 0.25} x2={svgWidth - padding.right} y2={padding.top + graphHeight * 0.25} />
            <line x1={padding.left} y1={padding.top + graphHeight * 0.5} x2={svgWidth - padding.right} y2={padding.top + graphHeight * 0.5} />
            <line x1={padding.left} y1={padding.top + graphHeight * 0.75} x2={svgWidth - padding.right} y2={padding.top + graphHeight * 0.75} />
            <line x1={padding.left} y1={padding.top + graphHeight} x2={svgWidth - padding.right} y2={padding.top + graphHeight} />
          </g>

          {/* Critical Threshold Alarm Line for Vibration */}
          {(activeChannel === 'all' || activeChannel === 'vibration') && (
            <g>
              <line
                x1={padding.left}
                y1={vibLimitY}
                x2={svgWidth - padding.right}
                y2={vibLimitY}
                stroke="#dc2626"
                strokeWidth="1.2"
                strokeDasharray="4 4"
                opacity="0.8"
              />
              <text
                x={svgWidth - padding.right - 4}
                y={vibLimitY - 4}
                textAnchor="end"
                fill="#dc2626"
                fontSize="9"
                fontWeight="bold"
                fontFamily="JetBrains Mono"
              >
                VIB MAX {cfg.tolerances.vibMax} mm/s
              </text>
            </g>
          )}

          {/* Temperature Threshold */}
          {(activeChannel === 'all' || activeChannel === 'temperature') && (
            <g>
              <line
                x1={padding.left}
                y1={tempLimitY}
                x2={svgWidth - padding.right}
                y2={tempLimitY}
                stroke="#ea580c"
                strokeWidth="1"
                strokeDasharray="2 3"
                opacity="0.7"
              />
            </g>
          )}

          {/* 1. Vibration Waveform (Amber) */}
          {(activeChannel === 'all' || activeChannel === 'vibration') && (
            <g>
              <path
                d={vibPath}
                fill="none"
                stroke="#d97706"
                strokeWidth="2.2"
                strokeLinecap="round"
                className="glow-amber"
              />
              {/* Pulse head */}
              <circle
                cx={getX(n - 1)}
                cy={getYVib(latest.vibration)}
                r="3.5"
                fill="#d97706"
              />
            </g>
          )}

          {/* 2. Temperature Waveform (Cyan) */}
          {(activeChannel === 'all' || activeChannel === 'temperature') && (
            <g>
              <path
                d={tempPath}
                fill="none"
                stroke="#0891b2"
                strokeWidth="2.2"
                strokeLinecap="round"
                className="glow-cyan"
              />
              <circle
                cx={getX(n - 1)}
                cy={getYTemp(latest.temperature)}
                r="3.5"
                fill="#0891b2"
              />
            </g>
          )}

          {/* 3. Motor Current Waveform (Violet/Blue) */}
          {(activeChannel === 'all' || activeChannel === 'current') && (
            <g>
              <path
                d={currentPath}
                fill="none"
                stroke="#7c3aed"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle
                cx={getX(n - 1)}
                cy={getYCurrent(latest.motor_current)}
                r="3.5"
                fill="#7c3aed"
              />
            </g>
          )}

          {/* Axis Labels */}
          <text x={padding.left - 6} y={padding.top + 8} textAnchor="end" fill="#64748b" fontSize="9" fontFamily="JetBrains Mono" fontWeight="bold">
            HI
          </text>
          <text x={padding.left - 6} y={padding.top + graphHeight} textAnchor="end" fill="#64748b" fontSize="9" fontFamily="JetBrains Mono" fontWeight="bold">
            LO
          </text>
          <text x={padding.left} y={svgHeight - 8} fill="#64748b" fontSize="9" fontFamily="JetBrains Mono">
            -60s
          </text>
          <text x={svgWidth - padding.right} y={svgHeight - 8} textAnchor="end" fill="#64748b" fontSize="9" fontFamily="JetBrains Mono">
            LIVE (0s)
          </text>
        </svg>
      </div>

      {/* Synchronized Legend & Current Metric Readouts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200 font-mono text-[11px]">
        <div className="flex items-center gap-1.5 p-1.5 rounded bg-slate-50 border border-slate-200">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span className="text-slate-600 font-medium">Vibration:</span>
          <span className="font-bold text-amber-700 ml-auto">{latest.vibration} mm/s</span>
        </div>

        <div className="flex items-center gap-1.5 p-1.5 rounded bg-slate-50 border border-slate-200">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-600" />
          <span className="text-slate-600 font-medium">Temp:</span>
          <span className="font-bold text-cyan-700 ml-auto">{latest.temperature}°C</span>
        </div>

        <div className="flex items-center gap-1.5 p-1.5 rounded bg-slate-50 border border-slate-200">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
          <span className="text-slate-600 font-medium">Current:</span>
          <span className="font-bold text-purple-700 ml-auto">{latest.motor_current} A</span>
        </div>

        <div className="flex items-center gap-1.5 p-1.5 rounded bg-slate-50 border border-slate-200">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
          <span className="text-slate-600 font-medium">Pressure:</span>
          <span className="font-bold text-emerald-700 ml-auto">{latest.pressure} bar</span>
        </div>
      </div>
    </div>
  );
};
