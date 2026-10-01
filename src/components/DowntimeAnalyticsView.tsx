import React from 'react';
import { lineEngine } from '../services/simulationEngine';
import { MACHINES_CONFIG } from '../services/factoryData';
import { BarChart3, PieChart, Clock, ShieldCheck, TrendingDown } from 'lucide-react';

export const DowntimeAnalyticsView: React.FC = () => {
  const events = lineEngine.getDowntimeHistory();

  const causesPareto = [
    { cause: 'Bearing Wear', hours: 42.5, count: 8, pct: 36.2 },
    { cause: 'Cooling / Overheat', hours: 28.0, count: 5, pct: 23.8 },
    { cause: 'Motor Overload', hours: 19.5, count: 4, pct: 16.6 },
    { cause: 'Pneumatic Leak', hours: 14.2, count: 3, pct: 12.1 },
    { cause: 'Tool Edge Blunting', hours: 9.8, count: 3, pct: 8.3 },
    { cause: 'Random Electrical', hours: 3.5, count: 1, pct: 3.0 }
  ];

  const shiftStats = [
    { shift: 'Shift 1 (Morning 06-14)', incidents: 7, hours: 26.5, oee: '89.2%' },
    { shift: 'Shift 2 (Evening 14-22)', incidents: 13, hours: 58.0, oee: '84.8%' },
    { shift: 'Shift 3 (Night 22-06)', incidents: 4, hours: 33.0, oee: '88.1%' }
  ];

  const mtbfMttr = [
    { id: 'cut_01', name: 'Cutting Machine', mtbf: '184 hrs', mttr: '24 min', avail: '99.4%' },
    { id: 'cnc_01', name: 'CNC Milling', mtbf: '112 hrs', mttr: '38 min', avail: '98.6%' },
    { id: 'weld_01', name: 'Welding Robot', mtbf: '196 hrs', mttr: '21 min', avail: '99.5%' },
    { id: 'paint_01', name: 'Painting Booth', mtbf: '145 hrs', mttr: '32 min', avail: '99.1%' },
    { id: 'pack_01', name: 'Packaging Unit', mtbf: '220 hrs', mttr: '18 min', avail: '99.7%' }
  ];

  return (
    <div className="space-y-4">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="tech-box rounded p-3">
          <div className="text-[10px] font-tech text-slate-500 uppercase">30-Day Line Uptime</div>
          <div className="text-2xl font-bold font-code text-cyan-700 mt-1">99.18%</div>
          <div className="text-[10px] text-emerald-600 font-mono mt-1 font-semibold">▲ +0.45% vs baseline</div>
        </div>

        <div className="tech-box rounded p-3">
          <div className="text-[10px] font-tech text-slate-500 uppercase">Mean Time to Repair (MTTR)</div>
          <div className="text-2xl font-bold font-code text-amber-700 mt-1">26.6 min</div>
          <div className="text-[10px] text-cyan-700 font-mono mt-1 font-semibold">▼ -14.2 min via early warning</div>
        </div>

        <div className="tech-box rounded p-3">
          <div className="text-[10px] font-tech text-slate-500 uppercase">Predictive Lead Time</div>
          <div className="text-2xl font-bold font-code text-emerald-700 mt-1">24.5 min</div>
          <div className="text-[10px] text-slate-500 font-mono mt-1 font-medium">Req: ≥ 15 min achieved</div>
        </div>

        <div className="tech-box rounded p-3">
          <div className="text-[10px] font-tech text-slate-500 uppercase">Prevented Line Stalls</div>
          <div className="text-2xl font-bold font-code text-purple-700 mt-1">21 of 24</div>
          <div className="text-[10px] text-emerald-600 font-mono mt-1 font-semibold">87.5% catch rate</div>
        </div>
      </div>

      {/* Middle Row: Pareto Cause Chart + Shift Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Pareto Causes Chart (8 Cols) */}
        <div className="lg:col-span-7 tech-box rounded p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-cyan-600" />
              <span className="font-tech text-xs font-bold text-slate-900 uppercase">
                Downtime Cause Pareto (Cumulative Impact)
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-500">PAST 30 DAYS</span>
          </div>

          <div className="space-y-2.5 my-2">
            {causesPareto.map((item, idx) => (
              <div key={item.cause} className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-800 font-medium flex items-center gap-1.5">
                    <span className="text-slate-400 text-[10px]">0{idx + 1}.</span>
                    {item.cause}
                  </span>
                  <span className="text-cyan-800 font-bold">
                    {item.hours} hrs <span className="text-slate-500 text-[10px]">({item.pct}%)</span>
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      idx === 0 ? 'bg-rose-500' : idx === 1 ? 'bg-amber-500' : 'bg-cyan-600'
                    }`}
                    style={{ width: `${item.pct * 2.2}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="text-[10px] font-mono text-slate-600 pt-2 border-t border-slate-200">
            Top 2 causes (Bearing wear + Cooling) constitute <span className="text-amber-700 font-bold">60%</span> of all line downtime.
          </div>
        </div>

        {/* Shift Distribution & MTBF Summary (5 Cols) */}
        <div className="lg:col-span-5 tech-box rounded p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
            <div className="flex items-center gap-2">
              <PieChart className="w-4 h-4 text-amber-600" />
              <span className="font-tech text-xs font-bold text-slate-900 uppercase">
                Downtime by Work Shift
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-500">3 SHIFTS</span>
          </div>

          <div className="space-y-3 my-2">
            {shiftStats.map((s) => (
              <div key={s.shift} className="p-2.5 rounded bg-slate-50 border border-slate-200 flex items-center justify-between font-mono text-xs">
                <div>
                  <div className="text-slate-800 font-bold">{s.shift}</div>
                  <div className="text-[10px] text-slate-500">{s.incidents} incidents recorded</div>
                </div>
                <div className="text-right">
                  <div className="text-amber-700 font-bold">{s.hours} hrs lost</div>
                  <div className="text-[10px] text-slate-500 font-semibold">OEE: {s.oee}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-2.5 rounded bg-cyan-50 border border-cyan-200 text-[11px] font-mono text-cyan-900">
            Shift 2 shows 48% higher thermal stress due to peak continuous factory duty cycle.
          </div>
        </div>
      </div>

      {/* Machine Reliability Indices (MTBF / MTTR) */}
      <div className="tech-box rounded p-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-600" />
            <span className="font-tech text-xs font-bold text-slate-900 uppercase">
              Station Reliability Indices (MTBF / MTTR / Availability)
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          {mtbfMttr.map(m => (
            <div key={m.id} className="p-3 rounded bg-slate-50 border border-slate-200 font-mono">
              <div className="text-slate-500 text-[10px] uppercase font-tech truncate font-semibold">{m.name}</div>
              <div className="text-xs font-bold text-slate-900 mt-1">{m.id}</div>
              <div className="mt-2 text-[11px] text-slate-700">
                MTBF: <span className="text-cyan-800 font-bold">{m.mtbf}</span>
              </div>
              <div className="text-[11px] text-slate-700">
                MTTR: <span className="text-amber-800 font-bold">{m.mttr}</span>
              </div>
              <div className="text-[11px] text-emerald-700 font-bold mt-1">
                Avail: {m.avail}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
