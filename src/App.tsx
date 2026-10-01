import React, { useState, useEffect } from 'react';
import { MachineId } from './types/factory';
import { lineEngine } from './services/simulationEngine';
import { HeaderDataV } from './components/HeaderDataV';
import { DigitalTwinCanvas } from './components/DigitalTwinCanvas';
import { TelemetryOscilloscope } from './components/TelemetryOscilloscope';
import { EarlyWarningHUD } from './components/EarlyWarningHUD';
import { StationTable } from './components/StationTable';
import { DowntimeAnalyticsView } from './components/DowntimeAnalyticsView';
import { MLDiagnosticsView } from './components/MLDiagnosticsView';
import { MqttConsoleView } from './components/MqttConsoleView';
import { AlertsFeedView } from './components/AlertsFeedView';
import { MachineDetailView } from './components/MachineDetailView';
import { SimulatorControlsModal } from './components/SimulatorControlsModal';
import {
  Activity,
  AlertTriangle,
  Clock,
  Cpu,
  Layers,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap
} from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<string>('overview');
  const [selectedMachineId, setSelectedMachineId] = useState<MachineId>('cnc_01');
  const [isSimulatorOpen, setIsSimulatorOpen] = useState<boolean>(false);
  const [, setTick] = useState<number>(0);

  // Re-render when simulation ticks or state updates
  useEffect(() => {
    return lineEngine.subscribe(() => {
      setTick(t => t + 1);
    });
  }, []);

  const alerts = lineEngine.getAllAlerts();
  const criticalCount = alerts.filter(a => a.severity === 'CRITICAL' && !a.resolved_at).length;
  const warningCount = alerts.filter(a => a.severity === 'WARNING' && !a.resolved_at).length;
  const prediction = lineEngine.getPrediction(selectedMachineId);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans">
      {/* Top Cybernetic DataV Header */}
      <HeaderDataV
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenSimulator={() => setIsSimulatorOpen(true)}
      />

      {/* Main Command Center Body */}
      <main className="flex-1 max-w-[1780px] w-full mx-auto p-3 sm:p-4 space-y-4">
        {/* VIEW 1: LINE OVERVIEW & DIGITAL TWIN */}
        {currentTab === 'overview' && (
          <div className="space-y-4">
            {/* KPI Top Cards Row matching DataV HUD blocks */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="tech-box rounded p-3 font-mono">
                <div className="text-[10px] text-slate-500 font-tech uppercase">Overall Equipment OEE</div>
                <div className="text-2xl font-bold font-code text-cyan-600 mt-0.5">87.4%</div>
                <div className="text-[10px] text-emerald-600 mt-0.5 flex items-center gap-1 font-tech font-semibold">
                  <TrendingUp className="w-3 h-3" />
                  <span>+1.2% Above Target</span>
                </div>
              </div>

              <div className="tech-box rounded p-3 font-mono">
                <div className="text-[10px] text-slate-500 font-tech uppercase">30-Day Line Uptime</div>
                <div className="text-2xl font-bold font-code text-slate-900 mt-0.5">99.18%</div>
                <div className="text-[10px] text-slate-500 mt-0.5 font-tech">MTBF: 172.4 hrs</div>
              </div>

              <div className="tech-box rounded p-3 font-mono">
                <div className="text-[10px] text-slate-500 font-tech uppercase">Active Alarms</div>
                <div className={`text-2xl font-bold font-code mt-0.5 ${criticalCount > 0 ? 'text-rose-600 glow-red' : warningCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {criticalCount + warningCount} <span className="text-xs text-slate-500 font-normal">({criticalCount} Crit)</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 font-tech">Auto-cooldown active</div>
              </div>

              <div className="tech-box rounded p-3 font-mono">
                <div className="text-[10px] text-slate-500 font-tech uppercase">Predicted Downtime (1h)</div>
                <div className={`text-2xl font-bold font-code mt-0.5 ${prediction.predicted_ttf_min <= 30 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {prediction.predicted_ttf_min < 900 ? `${prediction.predicted_ttf_min} min` : '0 min'}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 font-tech truncate">
                  Focus: {selectedMachineId}
                </div>
              </div>

              <div className="tech-box rounded p-3 font-mono col-span-2 md:col-span-1">
                <div className="text-[10px] text-slate-500 font-tech uppercase">Line Throughput</div>
                <div className="text-2xl font-bold font-code text-purple-700 mt-0.5">6,150 <span className="text-xs text-slate-500 font-normal">pcs</span></div>
                <div className="text-[10px] text-emerald-600 mt-0.5 font-tech font-semibold">Yield: 98.2% · Shift 2</div>
              </div>
            </div>

            {/* Central Dominant Visual: Digital Twin Canvas */}
            <DigitalTwinCanvas
              selectedMachineId={selectedMachineId}
              onSelectMachine={setSelectedMachineId}
            />

            {/* Bottom Row: Manifest Station Table (Left 7 cols) & Early Warning Incident HUD (Right 5 cols) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              <div className="lg:col-span-7">
                <StationTable
                  selectedMachineId={selectedMachineId}
                  onSelectMachine={setSelectedMachineId}
                />
              </div>

              <div className="lg:col-span-5">
                <EarlyWarningHUD
                  selectedMachineId={selectedMachineId}
                  prediction={prediction}
                />
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: MACHINE DETAIL */}
        {currentTab === 'detail' && (
          <MachineDetailView
            selectedMachineId={selectedMachineId}
            onSelectMachine={setSelectedMachineId}
            onOpenSimulator={() => setIsSimulatorOpen(true)}
          />
        )}

        {/* VIEW 3: LIVE ALERTS FEED */}
        {currentTab === 'alerts' && <AlertsFeedView />}

        {/* VIEW 4: DOWNTIME ANALYTICS */}
        {currentTab === 'analytics' && <DowntimeAnalyticsView />}

        {/* VIEW 5: ML PERFORMANCE */}
        {currentTab === 'ml' && <MLDiagnosticsView />}

        {/* VIEW 6: MQTT CONSOLE & ARCHITECTURE */}
        {currentTab === 'mqtt' && <MqttConsoleView />}
      </main>

      {/* Simulator Control & Fault Injection Modal */}
      <SimulatorControlsModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        onSelectMachine={setSelectedMachineId}
      />
    </div>
  );
}
