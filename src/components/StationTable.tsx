import React from 'react';
import { MachineId } from '../types/factory';
import { MACHINES_CONFIG } from '../services/factoryData';
import { lineEngine } from '../services/simulationEngine';
import { Table, ArrowRight, ShieldCheck, AlertTriangle } from 'lucide-react';

interface StationTableProps {
  selectedMachineId: MachineId;
  onSelectMachine: (id: MachineId) => void;
}

export const StationTable: React.FC<StationTableProps> = ({
  selectedMachineId,
  onSelectMachine
}) => {
  const machineIds: MachineId[] = ['cut_01', 'cnc_01', 'weld_01', 'paint_01', 'pack_01'];

  return (
    <div className="w-full tech-box rounded p-3 select-none flex flex-col justify-between">
      {/* Table Header with Tag */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
        <div className="flex items-center gap-2">
          <Table className="w-4 h-4 text-cyan-600" />
          <span className="font-tech text-xs font-bold text-slate-900 uppercase tracking-wide">
            Line 1 Station Manifest &amp; Live Telemetry Matrix
          </span>
        </div>
        <span className="text-[10px] font-mono text-cyan-700 font-bold">
          SEQ: 01 -&gt; 05
        </span>
      </div>

      {/* Tabular Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-left font-mono text-[11px] border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500 text-[10px] uppercase font-tech">
              <th className="py-1.5 px-2">Station</th>
              <th className="py-1.5 px-2">Status</th>
              <th className="py-1.5 px-2 text-right">Vib (mm/s)</th>
              <th className="py-1.5 px-2 text-right">Temp (°C)</th>
              <th className="py-1.5 px-2 text-right">Throughput</th>
              <th className="py-1.5 px-2 text-right">Reject %</th>
              <th className="py-1.5 px-2 text-right">Risk (P)</th>
              <th className="py-1.5 px-2 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {machineIds.map((mId, index) => {
              const cfg = MACHINES_CONFIG[mId];
              const telem = lineEngine.getLatestTelemetry(mId);
              const pred = lineEngine.getPrediction(mId);
              const isSelected = selectedMachineId === mId;

              const rejectPct = telem ? ((telem.reject_count / Math.max(1, telem.output_count)) * 100).toFixed(1) : '1.8';
              const isFault = telem?.status === 'FAULT';
              const isHigh = pred.risk_level === 'CRITICAL' || pred.risk_level === 'HIGH';

              return (
                <tr
                  key={mId}
                  onClick={() => onSelectMachine(mId)}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-cyan-50/80 text-cyan-950 font-semibold'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <td className="py-2 px-2 font-tech font-bold flex items-center gap-1.5">
                    <span className="text-slate-400 text-[9px]">0{index + 1}</span>
                    <span className={isSelected ? 'text-cyan-800' : 'text-slate-900'}>
                      {cfg.name}
                    </span>
                  </td>

                  <td className="py-2 px-2">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      isFault ? 'bg-rose-50 text-rose-700 border border-rose-300' :
                      isHigh ? 'bg-amber-50 text-amber-700 border border-amber-300' :
                      'bg-emerald-50 text-emerald-700 border border-emerald-300'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isFault ? 'bg-rose-500 animate-ping' : isHigh ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                      {telem?.status || 'RUNNING'}
                    </span>
                  </td>

                  <td className={`py-2 px-2 text-right font-code ${telem && telem.vibration > cfg.tolerances.vibMax ? 'text-rose-600 font-bold' : 'text-slate-800'}`}>
                    {telem?.vibration ?? cfg.nominal.vib}
                  </td>

                  <td className={`py-2 px-2 text-right font-code ${telem && telem.temperature > cfg.tolerances.tempMax ? 'text-rose-600 font-bold' : 'text-slate-800'}`}>
                    {telem?.temperature ?? cfg.nominal.temp}
                  </td>

                  <td className="py-2 px-2 text-right font-code text-slate-800">
                    {telem?.output_count?.toLocaleString() || '1,200'}
                  </td>

                  <td className="py-2 px-2 text-right font-code text-slate-500">
                    {rejectPct}%
                  </td>

                  <td className={`py-2 px-2 text-right font-code font-bold ${
                    pred.risk_level === 'CRITICAL' ? 'text-rose-600' :
                    pred.risk_level === 'HIGH' ? 'text-amber-600' : 'text-emerald-600'
                  }`}>
                    {(pred.failure_prob * 100).toFixed(0)}%
                  </td>

                  <td className="py-2 px-2 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectMachine(mId);
                      }}
                      className={`p-1 rounded transition-colors ${isSelected ? 'text-cyan-700' : 'text-slate-400 hover:text-slate-700'}`}
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
