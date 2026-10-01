-- Smart Production-Line Downtime Prediction Database Schema
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;

-- Machines Table
CREATE TABLE IF NOT EXISTS machines (
    machine_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    line TEXT NOT NULL DEFAULT 'line1',
    position INTEGER NOT NULL,
    install_date TEXT NOT NULL,
    criticality TEXT DEFAULT 'MEDIUM',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Raw Telemetry Table
CREATE TABLE IF NOT EXISTS telemetry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    machine_id TEXT NOT NULL,
    temperature REAL NOT NULL,
    vibration REAL NOT NULL,
    motor_current REAL NOT NULL,
    pressure REAL NOT NULL,
    rpm REAL NOT NULL,
    power_kw REAL NOT NULL,
    cycle_time REAL NOT NULL,
    output_count INTEGER NOT NULL,
    reject_count INTEGER NOT NULL,
    status TEXT NOT NULL,
    FOREIGN KEY (machine_id) REFERENCES machines(machine_id)
);

CREATE INDEX IF NOT EXISTS idx_telemetry_machine_ts ON telemetry(machine_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_ts ON telemetry(ts DESC);

-- Rolling Features Table
CREATE TABLE IF NOT EXISTS features (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    machine_id TEXT NOT NULL,
    temp_roll_mean_1m REAL,
    temp_roll_std_1m REAL,
    temp_roll_max_5m REAL,
    temp_slope_15m REAL,
    vib_roll_mean_1m REAL,
    vib_roll_std_1m REAL,
    vib_roll_max_5m REAL,
    vib_slope_15m REAL,
    current_roll_mean_1m REAL,
    current_roll_std_1m REAL,
    current_roll_max_5m REAL,
    pressure_roll_mean_1m REAL,
    pressure_slope_15m REAL,
    vib_rpm_ratio REAL,
    current_power_ratio REAL,
    reject_rate_15m REAL,
    FOREIGN KEY (machine_id) REFERENCES machines(machine_id)
);

CREATE INDEX IF NOT EXISTS idx_features_machine_ts ON features(machine_id, ts DESC);

-- Predictions Table
CREATE TABLE IF NOT EXISTS predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    machine_id TEXT NOT NULL,
    failure_prob REAL NOT NULL,
    predicted_ttf_min REAL NOT NULL,
    anomaly_score REAL NOT NULL,
    risk_level TEXT NOT NULL, -- LOW, MEDIUM, HIGH, CRITICAL
    model_version TEXT NOT NULL,
    FOREIGN KEY (machine_id) REFERENCES machines(machine_id)
);

CREATE INDEX IF NOT EXISTS idx_predictions_machine_ts ON predictions(machine_id, ts DESC);

-- Alerts Table
CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    machine_id TEXT NOT NULL,
    severity TEXT NOT NULL, -- INFO, WARNING, CRITICAL
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    failure_prob REAL,
    predicted_ttf_min REAL,
    contributing_features TEXT,
    recommended_action TEXT,
    acknowledged INTEGER DEFAULT 0,
    acknowledged_by TEXT,
    acknowledged_at TEXT,
    resolved_at TEXT,
    FOREIGN KEY (machine_id) REFERENCES machines(machine_id)
);

CREATE INDEX IF NOT EXISTS idx_alerts_ts ON alerts(ts DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_machine ON alerts(machine_id, acknowledged);

-- Downtime Events Table
CREATE TABLE IF NOT EXISTS downtime_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id TEXT NOT NULL,
    start_ts TEXT NOT NULL,
    end_ts TEXT,
    cause TEXT NOT NULL,
    duration_min REAL,
    was_predicted INTEGER DEFAULT 0,
    lead_time_min REAL,
    FOREIGN KEY (machine_id) REFERENCES machines(machine_id)
);

CREATE INDEX IF NOT EXISTS idx_downtime_machine ON downtime_events(machine_id, start_ts DESC);

-- Model Registry Table
CREATE TABLE IF NOT EXISTS model_registry (
    version TEXT PRIMARY KEY,
    trained_at TEXT NOT NULL,
    metrics_json TEXT NOT NULL,
    path TEXT NOT NULL,
    is_active INTEGER DEFAULT 0
);
