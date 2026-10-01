# Smart Production-Line Downtime Prediction
### Industrial IoT & ML Digital Twin Command Center

An end-to-end predictive maintenance system for continuous manufacturing lines. Simulates a 5-station industrial forming and assembly line, streams high-frequency sensor telemetry over MQTT through HiveMQ, persists data in SQLite (WAL mode), predicts machine failures with ML (XGBoost/LightGBM + RUL Regressor + Isolation Forest), dispatches alerts with cooldown and escalation, and visualizes operations through a high-tech DataV digital twin command center.

---

## ⚡ Live Features in this Deployment

1. **Interactive DataV Command Cockpit**:
   - High-tech industrial HUD visual aesthetic inspired by DataV control centers (dark obsidian background, cyan/amber/crimson accents, technical coordinates `<UX2513, GS2513>`).
   - **Central 2D/3D Digital Twin Canvas**: Sequential stations (*Cutting Machine &rarr; CNC Milling &rarr; Welding Robot &rarr; Painting Booth &rarr; Packaging Unit*) with animated conveyor material pulse flows, real-time stress heatmaps, and orbital alert radiation rings.
   - **Multi-Sensor Oscilloscope**: Synchronized live waveforms for Vibration (mm/s), Temperature (°C), Motor Current (A), and Pressure (bar).
   - **Predictive Incident Dispatch HUD**: Station lead badge, real-time $P(\text{downtime} < 30\text{m})$ probability gauge, remaining useful life (TTF) countdown, and 1-click **Acknowledge** and **Resolve** action handlers.
   - **Fault Injector & Simulator**: One-click inject Bearing Wear, Overheating, Motor Overload, Pneumatic Leak, Tool Wear, or Sudden Trip, adjust simulation speedup (1x–60x), and test the early warning pipeline!
   - **Downtime Analytics**: Pareto cause chart, MTBF / MTTR reliability indices, and shift loss distribution.
   - **ML Performance**: Confusion Matrix, SHAP feature attribution waterfall, and PSI data drift monitor.
   - **HiveMQ Virtual Bus**: Live MQTT packet stream with QoS 1 verification and copyable terminal commands.

2. **Complete Python Codebase (`downtime-prediction/`)**:
   - `docker-compose.yml`: HiveMQ Community Edition (port 1883/8080) + Ingestion + Inference + Alerts + FastAPI + Streamlit.
   - `src/simulator/`: Generator with 3-shift pattern, Gaussian noise, sensor drift, and 5 physical degradation models.
   - `src/mqtt/`: Paho-MQTT v2 client with Local HiveMQ and HiveMQ Cloud (TLS) support, LWT, and auto-reconnect.
   - `src/ingestion/`: Pydantic payload validation and thread-safe batch SQLite writer.
   - `src/features/`: Strictly causal rolling features (1m, 5m, 15m window statistics, slopes, EWMA, physics ratios).
   - `src/ml/`: Dual-model architecture (XGBoost classifier + RUL regressor + Isolation Forest anomaly detector), threshold tuning for recall $\ge 85\%$, and joblib artifact persistence.
   - `src/alerts/`: Multi-rule engine (ML risk levels + physical ceilings + anomaly score + FAULT status) with de-duplication, cooldown, and auto-escalation.
   - `tests/`: Pytest suite covering simulator degradation, feature engineering, alert rules, and payload validation.

---

## 🚀 Laptop Terminal Instructions

```bash
# 1. Start HiveMQ Broker in Docker
make broker

# 2. Generate 30 days of historical data (takes < 2 minutes)
make seed-data

# 3. Train ML models (recall >= 85%, lead time >= 15 min)
make train

# 4. Run the live end-to-end demo (Bearing Wear on CNC Milling)
make demo

# 5. Launch all services
make all
```
