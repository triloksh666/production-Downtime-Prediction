import React, { useState } from 'react';
import { lineEngine } from '../services/simulationEngine';
import { FactoryAlert, MachineId, AlertSeverity } from '../types/factory';
import { MACHINES_CONFIG } from '../services/factoryData';
import { ShieldAlert, AlertTriangle, Info, CheckCircle, UserCheck, ShieldCheck, Filter } from 'lucide-react';

export const AlertsFeedView: React.FC = () => {
  const [severityFilter, setSeverityFilter] = useState<'ALL' | AlertSeverity>('ALL');
  const [machineFilter, setMachineFilter] = useState<'ALL' | MachineId>('ALL');

  const alerts = lineEngine.getAllAlerts();

  const filtered = alerts.filter(a => {
    if (severityFilter !== 'ALL' && a.severity !== severityFilter) return false;
    if (machineFilter !== 'ALL' && a.machine_id !== machineFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Top Filter Bar */}
      <div className="tech-box rounded p-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-cyan-600" />
          <span className="font-tech text-slate-900 font-bold uppercase">Filter Feed:</span>
        </div>

        {/* Severity filter buttons */}
        <div className="flex items-center gap-1">
          {['ALL', 'CRITICAL', 'WARNING', 'INFO'].map(sev => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev as any)}
              className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                severityFilter === sev
                  ? 'bg-cyan-50 text-cyan-800 border border-cyan-400 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>

        {/* Machine filter select */}
        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-medium">Station:</span>
          <select
            value={machineFilter}
            onChange={(e) => setMachineFilter(e.target.value as any)}
            className="p-1 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none"
          >
            <option value="ALL">All Stations (5)</option>
            {Object.keys(MACHINES_CONFIG).map((mId) => (
              <option key={mId} value={mId}>
                {MACHINES_CONFIG[mId as MachineId].name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Alerts Table */}
      <div className="tech-box rounded p-4 font-mono text-xs">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
          <div className="flex items-center gap-2 font-tech font-bold text-slate-900 uppercase text-sm">
            <ShieldAlert className="w-4 h-4 text-rose-600 animate-pulse" />
            <span>Active Incident Log &amp; Event-Driven Alerts</span>
          </div>
          <span className="text-slate-500 text-[11px]">
            {filtered.length} INCIDENTS MATCHING CRITERIA
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] text-slate-500 uppercase font-tech">
                <th className="py-2 px-2">Timestamp</th>
                <th className="py-2 px-2">Severity</th>
                <th className="py-2 px-2">Station</th>
                <th className="py-2 px-2">Alert Type</th>
                <th className="py-2 px-2">Incident Detail &amp; Root Cause</th>
                <th className="py-2 px-2">Recommended Action</th>
                <th className="py-2 px-2 text-center">Status &amp; Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-tech">
                    No active alerts matching filter. All systems nominal.
                  </td>
                </tr>
              ) : (
                filtered.map((alert) => {
                  const cfg = MACHINES_CONFIG[alert.machine_id];
                  const isResolved = !!alert.resolved_at;
                  const isAck = alert.acknowledged;

                  return (
                    <tr key={alert.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-2 text-[10px] text-slate-500 whitespace-nowrap">
                        {alert.ts.substring(11, 19)} UTC
                      </td>

                      <td className="py-2 px-2">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          alert.severity === 'CRITICAL' ? 'bg-rose-50 text-rose-700 border border-rose-300' :
                          alert.severity === 'WARNING' ? 'bg-amber-50 text-amber-700 border border-amber-300' :
                          'bg-cyan-50 text-cyan-700 border border-cyan-300'
                        }`}>
                          {alert.severity === 'CRITICAL' && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />}
                          {alert.severity}
                        </span>
                      </td>

                      <td className="py-2 px-2 font-tech font-bold text-slate-900 whitespace-nowrap">
                        {cfg?.name || alert.machine_id}
                      </td>

                      <td className="py-2 px-2 text-cyan-800 font-bold whitespace-nowrap">
                        {alert.type}
                      </td>

                      <td className="py-2 px-2 max-w-xs text-slate-700 font-sans text-xs">
                        <div>{alert.message}</div>
                        {alert.contributing_features && (
                          <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                            Causes: {alert.contributing_features}
                          </div>
                        )}
                      </td>

                      <td className="py-2 px-2 max-w-xs text-[11px] text-amber-800 font-mono font-medium">
                        {alert.recommended_action}
                      </td>

                      <td className="py-2 px-2 text-center whitespace-nowrap">
                        {isResolved ? (
                          <span className="text-emerald-700 text-[10px] flex items-center justify-center gap-1 font-semibold">
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            Resolved
                          </span>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5">
                            {!isAck && (
                              <button
                                onClick={() => lineEngine.acknowledgeAlert(alert.id)}
                                className="px-2 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 text-[10px] font-tech font-bold transition-colors cursor-pointer"
                              >
                                ACK
                              </button>
                            )}
                            <button
                              onClick={() => {
                                lineEngine.resolveAlert(alert.id);
                                lineEngine.resetMachine(alert.machine_id);
                              }}
                              className="px-2 py-0.5 rounded bg-cyan-100 hover:bg-cyan-200 text-cyan-800 border border-cyan-300 text-[10px] font-tech font-bold transition-colors cursor-pointer"
                            >
                              Resolve
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
