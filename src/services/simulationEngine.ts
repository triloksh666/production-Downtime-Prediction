import {
  MachineId,
  MachineStatus,
  FailureMode,
  TelemetryReading,
  PredictionResult,
  FactoryAlert,
  DowntimeEvent,
  RiskLevel
} from '../types/factory';
import { MACHINES_CONFIG } from './factoryData';

interface MachineSimState {
  id: MachineId;
  status: MachineStatus;
  activeFailure: FailureMode;
  degradationDurationSec: number;
  degradationElapsedSec: number;
  outputCount: number;
  rejectCount: number;
  cooldownAfterFaultSec: number;
}

export class ProductionLineEngine {
  private machines: Record<MachineId, MachineSimState>;
  private history: Record<MachineId, TelemetryReading[]>;
  private alerts: FactoryAlert[];
  private downtimeHistory: DowntimeEvent[];
  private speedup: number = 1.0;
  private isPaused: boolean = false;
  private timerId: any = null;
  private listeners: Set<() => void> = new Set();
  private mqttPackets: Array<{ topic: string; qos: number; payload: any; ts: string }> = [];
  private lastAlertFired: Record<string, number> = {};

  constructor() {
    this.machines = {
      cut_01: { id: 'cut_01', status: 'RUNNING', activeFailure: 'none', degradationDurationSec: 0, degradationElapsedSec: 0, outputCount: 1420, rejectCount: 18, cooldownAfterFaultSec: 0 },
      cnc_01: { id: 'cnc_01', status: 'RUNNING', activeFailure: 'none', degradationDurationSec: 0, degradationElapsedSec: 0, outputCount: 980, rejectCount: 12, cooldownAfterFaultSec: 0 },
      weld_01: { id: 'weld_01', status: 'RUNNING', activeFailure: 'none', degradationDurationSec: 0, degradationElapsedSec: 0, outputCount: 1250, rejectCount: 8, cooldownAfterFaultSec: 0 },
      paint_01: { id: 'paint_01', status: 'RUNNING', activeFailure: 'none', degradationDurationSec: 0, degradationElapsedSec: 0, outputCount: 890, rejectCount: 14, cooldownAfterFaultSec: 0 },
      pack_01: { id: 'pack_01', status: 'RUNNING', activeFailure: 'none', degradationDurationSec: 0, degradationElapsedSec: 0, outputCount: 1610, rejectCount: 22, cooldownAfterFaultSec: 0 }
    };

    this.history = {
      cut_01: [],
      cnc_01: [],
      weld_01: [],
      paint_01: [],
      pack_01: []
    };

    this.alerts = [
      {
        id: 'alt_init_01',
        ts: new Date(Date.now() - 15 * 60000).toISOString(),
        machine_id: 'cnc_01',
        severity: 'INFO',
        type: 'SYSTEM_BOOT',
        message: 'Telemetry ingestion connected to HiveMQ (Line 1 healthy)',
        contributing_features: 'broker=hivemq-ce',
        recommended_action: 'Line nominal. Calibration valid.',
        acknowledged: true,
        acknowledged_by: 'system',
        acknowledged_at: new Date(Date.now() - 14 * 60000).toISOString()
      }
    ];

    this.downtimeHistory = [
      { id: 'dt_1', machine_id: 'cnc_01', start_ts: '2026-09-28T09:12:00Z', end_ts: '2026-09-28T09:44:00Z', cause: 'Bearing Wear', duration_min: 32.0, was_predicted: true, lead_time_min: 28.0 },
      { id: 'dt_2', machine_id: 'paint_01', start_ts: '2026-09-25T14:30:00Z', end_ts: '2026-09-25T15:05:00Z', cause: 'Cooling / Overheating', duration_min: 35.0, was_predicted: true, lead_time_min: 42.0 },
      { id: 'dt_3', machine_id: 'weld_01', start_ts: '2026-09-22T03:10:00Z', end_ts: '2026-09-22T03:32:00Z', cause: 'Hydraulic / Pneumatic Leak', duration_min: 22.0, was_predicted: true, lead_time_min: 19.0 },
      { id: 'dt_4', machine_id: 'cut_01', start_ts: '2026-09-18T18:00:00Z', end_ts: '2026-09-18T18:25:00Z', cause: 'Motor Overload', duration_min: 25.0, was_predicted: true, lead_time_min: 24.0 },
      { id: 'dt_5', machine_id: 'pack_01', start_ts: '2026-09-12T11:45:00Z', end_ts: '2026-09-12T11:58:00Z', cause: 'Random Electrical', duration_min: 13.0, was_predicted: false, lead_time_min: 0.0 }
    ];

    // Seed initial 30 samples of history per machine
    const now = Date.now();
    for (const mId of Object.keys(this.machines) as MachineId[]) {
      for (let i = 30; i >= 0; i--) {
        const sampleTime = new Date(now - i * 5000);
        const telem = this.generateTelemetry(mId, sampleTime, 1.0);
        this.history[mId].push(telem);
      }
    }

    this.startLoop();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(fn => fn());
  }

  public setSpeedup(speed: number) {
    this.speedup = Math.max(0.5, Math.min(60.0, speed));
    this.restartLoop();
    this.notify();
  }

  public getSpeedup(): number {
    return this.speedup;
  }

  public togglePause() {
    this.isPaused = !this.isPaused;
    this.notify();
  }

  public getIsPaused(): boolean {
    return this.isPaused;
  }

  public injectFailure(machineId: MachineId, failure: FailureMode, leadTimeMin: number = 30.0) {
    const m = this.machines[machineId];
    if (!m) return;
    m.activeFailure = failure;
    m.degradationDurationSec = leadTimeMin * 60.0;
    m.degradationElapsedSec = 0.0;
    m.status = 'RUNNING';

    // Log MQTT control packet
    this.logMqttPacket(`factory/line1/control`, 1, {
      action: 'inject_failure',
      machine_id: machineId,
      failure_type: failure,
      lead_time_min: leadTimeMin
    });

    this.notify();
  }

  public resetMachine(machineId: MachineId) {
    const m = this.machines[machineId];
    if (!m) return;
    m.activeFailure = 'none';
    m.degradationElapsedSec = 0;
    m.degradationDurationSec = 0;
    m.status = 'RUNNING';
    m.cooldownAfterFaultSec = 0;
    this.notify();
  }

  public acknowledgeAlert(alertId: string, user: string = 'Loki (Operator)') {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledged_by = user;
      alert.acknowledged_at = new Date().toISOString();
      this.notify();
    }
  }

  public resolveAlert(alertId: string) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved_at = new Date().toISOString();
      this.notify();
    }
  }

  public getLatestTelemetry(machineId: MachineId): TelemetryReading | undefined {
    const arr = this.history[machineId];
    return arr && arr.length > 0 ? arr[arr.length - 1] : undefined;
  }

  public getTelemetryHistory(machineId: MachineId, count: number = 40): TelemetryReading[] {
    const arr = this.history[machineId] || [];
    return arr.slice(-count);
  }

  public getAllAlerts(): FactoryAlert[] {
    return [...this.alerts].reverse();
  }

  public getDowntimeHistory(): DowntimeEvent[] {
    return this.downtimeHistory;
  }

  public getMqttPackets(): Array<{ topic: string; qos: number; payload: any; ts: string }> {
    return [...this.mqttPackets].slice(-25).reverse();
  }

  private logMqttPacket(topic: string, qos: number, payload: any) {
    this.mqttPackets.push({
      topic,
      qos,
      payload,
      ts: new Date().toISOString().substring(11, 19)
    });
    if (this.mqttPackets.length > 100) {
      this.mqttPackets.shift();
    }
  }

  // --- Real-time ML Inference ---
  public getPrediction(machineId: MachineId): PredictionResult {
    const cfg = MACHINES_CONFIG[machineId];
    const history = this.getTelemetryHistory(machineId, 20);
    const latest = history[history.length - 1];

    if (!latest) {
      return {
        ts: new Date().toISOString(),
        machine_id: machineId,
        failure_prob: 0.02,
        predicted_ttf_min: 999.0,
        anomaly_score: 0.04,
        risk_level: 'LOW',
        model_version: 'XGB-v2026.3',
        top_features: []
      };
    }

    // Extract rolling statistics
    const temps = history.map(h => h.temperature);
    const vibs = history.map(h => h.vibration);
    const currents = history.map(h => h.motor_current);

    const tempSlope = (temps[temps.length - 1] - temps[0]) / Math.max(1, temps.length);
    const vibSlope = (vibs[vibs.length - 1] - vibs[0]) / Math.max(1, vibs.length);

    const vibToRpm = (latest.vibration / (latest.rpm + 1)) * 1000;
    const currentToPower = latest.motor_current / (latest.power_kw + 0.1);

    // Physics + ML Model scoring logic
    let failureProb = 0.03;
    let predictedTtf = 999.0;
    let anomalyScore = 0.04;

    const vibExcess = Math.max(0, (latest.vibration - cfg.nominal.vib) / (cfg.tolerances.vibMax - cfg.nominal.vib));
    const tempExcess = Math.max(0, (latest.temperature - cfg.nominal.temp) / (cfg.tolerances.tempMax - cfg.nominal.temp));
    const currentExcess = Math.max(0, (latest.motor_current - cfg.nominal.current) / (cfg.tolerances.currentMax - cfg.nominal.current));

    const compositeStress = vibExcess * 0.45 + tempExcess * 0.35 + currentExcess * 0.20;

    if (latest.status === 'FAULT') {
      failureProb = 1.0;
      predictedTtf = 0.0;
      anomalyScore = 0.98;
    } else if (latest.status === 'WARNING' || compositeStress > 0.4) {
      failureProb = Math.min(0.96, 0.45 + compositeStress * 0.55);
      predictedTtf = Math.max(2.0, 45.0 * (1.0 - Math.min(0.95, compositeStress)));
      anomalyScore = Math.min(0.95, 0.35 + compositeStress * 0.6);
    } else {
      failureProb = Math.min(0.25, 0.02 + compositeStress * 0.2);
      predictedTtf = compositeStress > 0.15 ? 120.0 : 999.0;
      anomalyScore = Math.min(0.25, 0.03 + compositeStress * 0.15);
    }

    // Risk level classification
    let risk_level: RiskLevel = 'LOW';
    if (failureProb >= 0.80 || predictedTtf <= 15.0) risk_level = 'CRITICAL';
    else if (failureProb >= 0.55 || predictedTtf <= 35.0) risk_level = 'HIGH';
    else if (failureProb >= 0.25 || anomalyScore >= 0.60) risk_level = 'MEDIUM';

    // SHAP Feature Attribution
    const top_features = [
      { name: 'vibration_slope_15m', impact: Math.max(0.05, Math.min(0.85, vibSlope * 4.0 + vibExcess * 0.4)) },
      { name: 'temperature_slope_15m', impact: Math.max(0.04, Math.min(0.75, tempSlope * 3.5 + tempExcess * 0.35)) },
      { name: 'vib_to_rpm_ratio', impact: Math.max(0.03, Math.min(0.65, vibToRpm * 0.15)) },
      { name: 'current_to_power_ratio', impact: Math.max(0.02, Math.min(0.50, currentToPower * 0.2)) }
    ].sort((a, b) => b.impact - a.impact);

    return {
      ts: latest.ts,
      machine_id: machineId,
      failure_prob: Number(failureProb.toFixed(3)),
      predicted_ttf_min: Number(predictedTtf.toFixed(1)),
      anomaly_score: Number(anomalyScore.toFixed(3)),
      risk_level,
      model_version: 'XGBoost-RUL-v2.4',
      top_features
    };
  }

  // --- Physical Sensor Degradation Physics ---
  private generateTelemetry(mId: MachineId, currentTime: Date, dtSeconds: number): TelemetryReading {
    const cfg = MACHINES_CONFIG[mId];
    const m = this.machines[mId];
    const nom = cfg.nominal;

    // Shift load oscillation (day/night)
    const hour = currentTime.getUTCHours();
    const shiftLoad = (hour >= 14 && hour < 22) ? 1.05 : (hour >= 22 || hour < 6) ? 0.92 : 1.0;

    // Gaussian noise function
    const randNoise = (std: number) => (Math.random() - 0.5) * 2 * std;

    let temp = nom.temp * shiftLoad + randNoise(0.4);
    let vib = Math.max(0.2, nom.vib * shiftLoad + randNoise(0.08));
    let current = Math.max(1.0, nom.current * shiftLoad + randNoise(0.3));
    let pressure = Math.max(0.5, nom.pressure + randNoise(0.1));
    let rpm = Math.max(50.0, nom.rpm * (0.99 + 0.02 * Math.random()));
    let power = Math.max(0.5, nom.power * shiftLoad + randNoise(0.2));
    let cycleTime = Math.max(1.0, nom.cycle + randNoise(0.08));

    // Handle post-fault recovery cooldown
    if (m.status === 'FAULT') {
      m.cooldownAfterFaultSec += dtSeconds;
      if (m.cooldownAfterFaultSec > 45.0) {
        m.status = 'RUNNING';
        m.activeFailure = 'none';
        m.cooldownAfterFaultSec = 0;
        m.degradationElapsedSec = 0;
      } else {
        return {
          ts: currentTime.toISOString(),
          machine_id: mId,
          temperature: Math.round(temp * 0.8),
          vibration: 0.15,
          motor_current: 0.0,
          pressure: Math.round(pressure * 0.5 * 10) / 10,
          rpm: 0.0,
          power_kw: 0.5,
          cycle_time: nom.cycle,
          output_count: m.outputCount,
          reject_count: m.rejectCount,
          status: 'FAULT',
          time_to_failure_min: 0.0,
          failure_type: m.activeFailure
        };
      }
    }

    // Degradation trajectory
    let progress = 0.0;
    let ttfMin = 999.0;
    let failureIn30 = 0;

    if (m.activeFailure !== 'none') {
      m.degradationElapsedSec += dtSeconds;
      progress = Math.min(1.0, m.degradationElapsedSec / Math.max(1.0, m.degradationDurationSec));
      const remainingSec = Math.max(0, m.degradationDurationSec - m.degradationElapsedSec);
      ttfMin = Math.round((remainingSec / 60.0) * 10) / 10;
      if (ttfMin <= 30.0) failureIn30 = 1;

      const expFactor = Math.pow(progress, 1.8);

      if (m.activeFailure === 'bearing_wear') {
        vib += 4.5 * expFactor;
        temp += 18.0 * expFactor;
        power += 2.2 * progress;
      } else if (m.activeFailure === 'overheating') {
        temp += 35.0 * expFactor;
        power += 4.8 * progress;
        current += 3.5 * progress;
      } else if (m.activeFailure === 'motor_overload') {
        current += 16.0 * expFactor;
        rpm = Math.max(100, rpm - 500 * expFactor);
        power += 7.0 * expFactor;
        temp += 10.0 * progress;
      } else if (m.activeFailure === 'hydraulic_leak') {
        pressure = Math.max(1.0, pressure - 3.8 * expFactor);
        cycleTime += 3.2 * expFactor;
      } else if (m.activeFailure === 'tool_wear') {
        cycleTime += 1.6 * expFactor;
        vib += 1.1 * expFactor;
        if (progress > 0.4) m.rejectCount += Math.floor(1 + 2 * progress);
      } else if (m.activeFailure === 'sudden_electrical') {
        if (progress >= 0.95) {
          current = 0.0;
          rpm = 0.0;
          power = 0.0;
          vib = 0.05;
        }
      }

      if (progress >= 1.0) {
        m.status = 'FAULT';
        // Add to historical downtime events
        this.downtimeHistory.unshift({
          id: `dt_${Date.now()}`,
          machine_id: mId,
          start_ts: currentTime.toISOString(),
          cause: m.activeFailure.replace('_', ' ').toUpperCase(),
          duration_min: 15.0,
          was_predicted: true,
          lead_time_min: Math.round(m.degradationDurationSec / 60.0)
        });
      } else if (progress >= 0.65) {
        m.status = 'WARNING';
      } else {
        m.status = 'RUNNING';
      }
    }

    // Natural piece production increments
    if (m.status === 'RUNNING' || m.status === 'WARNING') {
      if (Math.random() < dtSeconds / nom.cycle) {
        m.outputCount += 1;
        if (Math.random() < 0.018) {
          m.rejectCount += 1;
        }
      }
    }

    return {
      ts: currentTime.toISOString(),
      machine_id: mId,
      temperature: Number(temp.toFixed(1)),
      vibration: Number(vib.toFixed(2)),
      motor_current: Number(current.toFixed(1)),
      pressure: Number(pressure.toFixed(1)),
      rpm: Number(rpm.toFixed(0)),
      power_kw: Number(power.toFixed(1)),
      cycle_time: Number(cycleTime.toFixed(1)),
      output_count: m.outputCount,
      reject_count: m.rejectCount,
      status: m.status,
      failure_in_next_30min: failureIn30,
      time_to_failure_min: ttfMin,
      failure_type: m.activeFailure
    };
  }

  // --- Real-time Simulation Tick ---
  private step() {
    if (this.isPaused) return;

    const dtSeconds = 1.0 * this.speedup;
    const now = new Date();

    for (const mId of Object.keys(this.machines) as MachineId[]) {
      const telem = this.generateTelemetry(mId, now, dtSeconds);

      // Append to history buffer
      this.history[mId].push(telem);
      if (this.history[mId].length > 120) {
        this.history[mId].shift();
      }

      // Log telemetry packet
      this.logMqttPacket(`factory/line1/${mId}/telemetry`, 1, {
        machine_id: mId,
        temperature: telem.temperature,
        vibration: telem.vibration,
        status: telem.status
      });

      // Run Alert Evaluation Rules
      const pred = this.getPrediction(mId);
      this.evaluateAlertRules(telem, pred);
    }

    this.notify();
  }

  private evaluateAlertRules(telem: TelemetryReading, pred: PredictionResult) {
    const cfg = MACHINES_CONFIG[telem.machine_id];
    const nowTime = Date.now();
    const cooldownMs = 60000; // 1 min cooldown per rule

    // 1. FAULT Status Alert
    if (telem.status === 'FAULT') {
      const key = `${telem.machine_id}_FAULT`;
      if (!this.lastAlertFired[key] || (nowTime - this.lastAlertFired[key]) > cooldownMs) {
        this.lastAlertFired[key] = nowTime;
        const newAlert: FactoryAlert = {
          id: `alt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          ts: new Date().toISOString(),
          machine_id: telem.machine_id,
          severity: 'CRITICAL',
          type: 'UNSCHEDULED_DOWNTIME_FAULT',
          message: `${cfg.name} halted due to hardware terminal fault (${telem.failure_type || 'Unknown'})`,
          contributing_features: `status=FAULT, power=${telem.power_kw}kW`,
          recommended_action: 'Halt upstream conveyor feed. Dispatch electrical and mechanical technician team immediately.',
          acknowledged: false
        };
        this.alerts.push(newAlert);
        this.logMqttPacket(`factory/line1/alerts`, 1, newAlert);
      }
    }

    // 2. ML Predictive Early Warning (TTF < 25 min or prob > 0.65)
    if (pred.risk_level === 'CRITICAL' || pred.risk_level === 'HIGH') {
      const key = `${telem.machine_id}_ML_WARN`;
      if (!this.lastAlertFired[key] || (nowTime - this.lastAlertFired[key]) > cooldownMs) {
        this.lastAlertFired[key] = nowTime;
        const newAlert: FactoryAlert = {
          id: `alt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          ts: new Date().toISOString(),
          machine_id: telem.machine_id,
          severity: pred.risk_level === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
          type: 'PREDICTIVE_MAINTENANCE_EARLY_WARNING',
          message: `ML Predictor: Failure in ~${pred.predicted_ttf_min} min on ${cfg.name} (Risk Prob: ${(pred.failure_prob * 100).toFixed(0)}%)`,
          failure_prob: pred.failure_prob,
          predicted_ttf_min: pred.predicted_ttf_min,
          contributing_features: pred.top_features?.map(f => `${f.name}: ${(f.impact * 100).toFixed(0)}%`).join(', ') || 'Sensor drift',
          recommended_action: 'Pre-stage replacement component and schedule planned inter-batch intervention to avoid line stall.',
          acknowledged: false
        };
        this.alerts.push(newAlert);
        this.logMqttPacket(`factory/line1/alerts`, 1, newAlert);
      }
    }

    // 3. Vibration Limit Breach
    if (telem.vibration > cfg.tolerances.vibMax) {
      const key = `${telem.machine_id}_VIB_LIMIT`;
      if (!this.lastAlertFired[key] || (nowTime - this.lastAlertFired[key]) > cooldownMs) {
        this.lastAlertFired[key] = nowTime;
        const newAlert: FactoryAlert = {
          id: `alt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          ts: new Date().toISOString(),
          machine_id: telem.machine_id,
          severity: 'CRITICAL',
          type: 'EXCESSIVE_VIBRATION',
          message: `${cfg.name} Spindle vibration ${telem.vibration} mm/s breached maximum tolerance of ${cfg.tolerances.vibMax} mm/s`,
          contributing_features: `vibration=${telem.vibration}mm/s, rpm=${telem.rpm}`,
          recommended_action: 'Inspect bearing race, shaft alignment, and tool balance.',
          acknowledged: false
        };
        this.alerts.push(newAlert);
        this.logMqttPacket(`factory/line1/alerts`, 1, newAlert);
      }
    }
  }

  private startLoop() {
    this.timerId = setInterval(() => {
      this.step();
    }, 1000);
  }

  private restartLoop() {
    if (this.timerId) clearInterval(this.timerId);
    this.startLoop();
  }
}

// Global Singleton Instance
export const lineEngine = new ProductionLineEngine();
