import React, { useRef, useEffect, useState } from 'react';
import { MachineId, TelemetryReading, PredictionResult } from '../types/factory';
import { MACHINES_CONFIG } from '../services/factoryData';
import { lineEngine } from '../services/simulationEngine';
import { Eye, ShieldAlert, Cpu, CheckCircle2 } from 'lucide-react';

interface DigitalTwinCanvasProps {
  selectedMachineId: MachineId;
  onSelectMachine: (id: MachineId) => void;
}

export const DigitalTwinCanvas: React.FC<DigitalTwinCanvasProps> = ({
  selectedMachineId,
  onSelectMachine
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoveredMachine, setHoveredMachine] = useState<MachineId | null>(null);

  // Machine screen coordinate positions
  const stationLayout: Array<{
    id: MachineId;
    label: string;
    num: number;
    xPct: number;
    yPct: number;
  }> = [
    { id: 'cut_01', label: 'Cutting Machine', num: 1, xPct: 0.15, yPct: 0.52 },
    { id: 'cnc_01', label: 'CNC Milling', num: 2, xPct: 0.32, yPct: 0.44 },
    { id: 'weld_01', label: 'Welding Robot', num: 3, xPct: 0.50, yPct: 0.50 },
    { id: 'paint_01', label: 'Painting Booth', num: 4, xPct: 0.68, yPct: 0.44 },
    { id: 'pack_01', label: 'Packaging Unit', num: 5, xPct: 0.85, yPct: 0.52 }
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    const render = () => {
      time += 0.03;
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // 1. Draw Cybernetic Background Wireframe Grid & Radar Circles (Light theme)
      ctx.save();
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.06)';
      ctx.lineWidth = 1;

      // Central concentric radar rings
      const centerX = width * 0.5;
      const centerY = height * 0.48;
      const maxRadius = Math.min(width, height) * 0.45;

      for (let r = 80; r <= maxRadius; r += 70) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Rotating radar crosshairs & orbital arcs
      ctx.beginPath();
      ctx.arc(centerX, centerY, maxRadius * 0.75, time * 0.2, time * 0.2 + Math.PI * 0.4);
      ctx.strokeStyle = 'rgba(8, 145, 178, 0.35)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(centerX, centerY, maxRadius * 0.55, -time * 0.3, -time * 0.3 + Math.PI * 0.6);
      ctx.strokeStyle = 'rgba(217, 119, 6, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.restore();

      // 2. Draw Conveyor Belt Pipeline between 5 Stations
      const points = stationLayout.map(s => ({
        x: s.xPct * width,
        y: s.yPct * height,
        id: s.id
      }));

      ctx.save();
      // Subtle conveyor track bed
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.strokeStyle = 'rgba(8, 145, 178, 0.15)';
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Conveyor central guide line
      ctx.strokeStyle = '#0891b2';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -time * 25;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // 3. Draw Moving Workpiece Pulses along the line
      ctx.save();
      const numPackets = 8;
      for (let p = 0; p < numPackets; p++) {
        const offset = ((p / numPackets) + (time * 0.08)) % 1;
        const totalSegments = points.length - 1;
        const scaled = offset * totalSegments;
        const segIndex = Math.min(Math.floor(scaled), totalSegments - 1);
        const segT = scaled - segIndex;

        const p1 = points[segIndex];
        const p2 = points[segIndex + 1];

        const px = p1.x + (p2.x - p1.x) * segT;
        const py = p1.y + (p2.y - p1.y) * segT;

        // Glowing workpiece pallet
        ctx.fillStyle = '#0891b2';
        ctx.shadowColor = '#0891b2';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // 4. Draw Stations (Machines)
      stationLayout.forEach((station, idx) => {
        const sx = station.xPct * width;
        const sy = station.yPct * height;
        const telem = lineEngine.getLatestTelemetry(station.id);
        const pred = lineEngine.getPrediction(station.id);
        const isSelected = selectedMachineId === station.id;
        const isHovered = hoveredMachine === station.id;

        const isFault = telem?.status === 'FAULT';
        const isHighRisk = pred.risk_level === 'CRITICAL' || pred.risk_level === 'HIGH';
        const isMediumRisk = pred.risk_level === 'MEDIUM';

        // Base color theme for station
        let stationColor = '#0891b2'; // cyan
        if (isFault) stationColor = '#dc2626'; // red
        else if (isHighRisk) stationColor = '#d97706'; // amber
        else if (isMediumRisk) stationColor = '#0284c7'; // blue

        // Stress / Radiation emission rings if high risk or fault
        if (isHighRisk || isFault) {
          const pulse = (Math.sin(time * 6) + 1) * 0.5;
          ctx.save();
          ctx.beginPath();
          ctx.arc(sx, sy, 38 + pulse * 14, 0, Math.PI * 2);
          ctx.strokeStyle = isFault ? `rgba(220, 38, 38, ${0.35 + pulse * 0.25})` : `rgba(217, 119, 6, ${0.3 + pulse * 0.25})`;
          ctx.lineWidth = 2;
          ctx.stroke();

          // High alert orbital arc
          ctx.beginPath();
          ctx.arc(sx, sy, 55, time * 2, time * 2 + Math.PI * 0.6);
          ctx.strokeStyle = isFault ? '#dc2626' : '#d97706';
          ctx.lineWidth = 2.5;
          ctx.stroke();
          ctx.restore();
        }

        // Selection highlight ring
        if (isSelected) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(sx, sy, 34, 0, Math.PI * 2);
          ctx.strokeStyle = '#0891b2';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.restore();
        }

        // Station Base Hexagon / Node (White background with crisp colored border)
        ctx.save();
        ctx.fillStyle = isSelected ? '#ffffff' : '#ffffff';
        ctx.strokeStyle = stationColor;
        ctx.lineWidth = isSelected || isHovered ? 3 : 2;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 2;

        ctx.beginPath();
        const nodeRadius = 24;
        for (let a = 0; a < 6; a++) {
          const angle = (Math.PI / 3) * a + Math.PI / 6;
          const hx = sx + nodeRadius * Math.cos(angle);
          const hy = sy + nodeRadius * Math.sin(angle);
          if (a === 0) ctx.moveTo(hx, hy);
          else ctx.lineTo(hx, hy);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Station Number inside
        ctx.save();
        ctx.font = 'bold 12px "JetBrains Mono", monospace';
        ctx.fillStyle = stationColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`0${station.num}`, sx, sy);
        ctx.restore();

        // Technical callout label above node
        ctx.save();
        ctx.textAlign = 'center';

        // Machine title
        ctx.font = 'bold 11px "Chakra Petch", sans-serif';
        ctx.fillStyle = isSelected ? '#0891b2' : '#0f172a';
        ctx.fillText(station.label.toUpperCase(), sx, sy - 36);

        // Status / Telemetry badge
        ctx.font = '600 10px "JetBrains Mono", monospace';
        if (isFault) {
          ctx.fillStyle = '#dc2626';
          ctx.fillText('● FAULT HALT', sx, sy - 48);
        } else if (isHighRisk) {
          ctx.fillStyle = '#d97706';
          ctx.fillText(`▲ RISK ${Math.round(pred.failure_prob * 100)}% (TTF: ${pred.predicted_ttf_min}m)`, sx, sy - 48);
        } else {
          ctx.fillStyle = '#059669';
          ctx.fillText(`● RUNNING · ${telem?.vibration ?? 1.8}mm/s`, sx, sy - 48);
        }

        // Position coordinates bracket
        ctx.font = '9px monospace';
        ctx.fillStyle = '#64748b';
        ctx.fillText(`ID: ${station.id}`, sx, sy + 38);

        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [selectedMachineId, hoveredMachine]);

  // Handle canvas resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas && canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight || 340;
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const width = canvas.width;
    const height = canvas.height;

    // Check hit test on stations
    for (const s of stationLayout) {
      const sx = s.xPct * width;
      const sy = s.yPct * height;
      const dist = Math.hypot(clickX - sx, clickY - sy);
      if (dist <= 30) {
        onSelectMachine(s.id);
        break;
      }
    }
  };

  const selectedTelem = lineEngine.getLatestTelemetry(selectedMachineId);
  const selectedPred = lineEngine.getPrediction(selectedMachineId);
  const selectedCfg = MACHINES_CONFIG[selectedMachineId];

  return (
    <div className="relative w-full h-[360px] md:h-[420px] tech-box rounded overflow-hidden select-none datav-grid">
      {/* Corner brackets decorative markers matching DataV reference */}
      <div className="absolute top-2 left-2 text-[10px] font-mono text-cyan-700 font-bold flex items-center gap-1.5 z-10">
        <span className="w-1.5 h-1.5 bg-cyan-600 animate-ping rounded-full" />
        <span>DIGITAL TWIN LINE TOPOLOGY // 5 WORKSTATIONS ACTIVE</span>
      </div>

      <div className="absolute top-2 right-2 text-[10px] font-mono text-slate-500 z-10 hidden sm:flex items-center gap-3 font-semibold">
        <span>LINE CADENCE: 1.0 SEC</span>
        <span className="text-cyan-700">LATENCY: 4ms</span>
        <span className="text-emerald-700">QoS: 1 CONFIRMED</span>
      </div>

      {/* Main Canvas Stage */}
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="w-full h-full cursor-crosshair block"
      />

      {/* Floating Selected Station Inspector Ribbon at Bottom */}
      <div className="absolute bottom-2 left-2 right-2 p-2.5 bg-white/95 backdrop-blur-md rounded border border-slate-200 shadow-md flex flex-wrap items-center justify-between gap-3 text-xs z-10">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-600 glow-cyan animate-pulse" />
          <div>
            <span className="font-tech text-slate-500 text-[10px] uppercase font-bold">Selected Focus Station:</span>{' '}
            <span className="font-tech font-bold text-slate-900 text-sm">
              {selectedCfg.name} ({selectedMachineId})
            </span>
          </div>
          <span className="text-slate-300">|</span>
          <div className="text-slate-700">
            <span className="text-slate-500">Status:</span>{' '}
            <span className={`font-mono font-bold ${selectedTelem?.status === 'FAULT' ? 'text-rose-600' : 'text-emerald-600'}`}>
              {selectedTelem?.status ?? 'RUNNING'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 font-mono text-[11px]">
          <div>
            <span className="text-slate-500">Vibration:</span>{' '}
            <span className="text-cyan-700 font-bold">{selectedTelem?.vibration} mm/s</span>
          </div>
          <div>
            <span className="text-slate-500">Temp:</span>{' '}
            <span className="text-cyan-700 font-bold">{selectedTelem?.temperature}°C</span>
          </div>
          <div>
            <span className="text-slate-500">ML Risk:</span>{' '}
            <span className={`font-bold ${
              selectedPred.risk_level === 'CRITICAL' ? 'text-rose-600' :
              selectedPred.risk_level === 'HIGH' ? 'text-amber-600' : 'text-emerald-600'
            }`}>
              {(selectedPred.failure_prob * 100).toFixed(0)}% ({selectedPred.risk_level})
            </span>
          </div>
          <div>
            <span className="text-slate-500">Est. TTF:</span>{' '}
            <span className="text-amber-600 font-bold">
              {selectedPred.predicted_ttf_min < 900 ? `${selectedPred.predicted_ttf_min} min` : 'Nominal'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
