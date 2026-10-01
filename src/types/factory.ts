export type MachineId = 'cut_01' | 'cnc_01' | 'weld_01' | 'paint_01' | 'pack_01';

export type MachineStatus = 'RUNNING' | 'IDLE' | 'WARNING' | 'FAULT' | 'MAINTENANCE';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export type FailureMode = 
  | 'none'
  | 'bearing_wear'
  | 'overheating'
  | 'motor_overload'
  | 'hydraulic_leak'
  | 'tool_wear'
  | 'sudden_electrical';

export interface MachineConfig {
  id: MachineId;
  name: string;
  type: string;
  position: number;
  installDate: string;
  criticality: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  nominal: {
    temp: number;
    vib: number;
    current: number;
    pressure: number;
    rpm: number;
    power: number;
    cycle: number;
  };
  tolerances: {
    tempMax: number;
    vibMax: number;
    currentMax: number;
    pressureMin: number;
  };
}

export interface TelemetryReading {
  id?: number;
  ts: string;
  machine_id: MachineId;
  temperature: number;
  vibration: number;
  motor_current: number;
  pressure: number;
  rpm: number;
  power_kw: number;
  cycle_time: number;
  output_count: number;
  reject_count: number;
  status: MachineStatus;
  failure_in_next_30min?: number;
  time_to_failure_min?: number;
  failure_type?: FailureMode;
}

export interface PredictionResult {
  ts: string;
  machine_id: MachineId;
  failure_prob: number;       // 0.0 to 1.0
  predicted_ttf_min: number;  // Minutes remaining
  anomaly_score: number;      // 0.0 to 1.0
  risk_level: RiskLevel;
  model_version: string;
  top_features?: Array<{ name: string; impact: number }>;
}

export interface FactoryAlert {
  id: string;
  ts: string;
  machine_id: MachineId;
  severity: AlertSeverity;
  type: string;
  message: string;
  failure_prob?: number;
  predicted_ttf_min?: number;
  contributing_features: string;
  recommended_action: string;
  acknowledged: boolean;
  acknowledged_by?: string;
  acknowledged_at?: string;
  resolved_at?: string;
}

export interface DowntimeEvent {
  id: string;
  machine_id: MachineId;
  start_ts: string;
  end_ts?: string;
  cause: string;
  duration_min: number;
  was_predicted: boolean;
  lead_time_min: number;
}
