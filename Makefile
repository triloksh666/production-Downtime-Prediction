.PHONY: help install broker seed-data train simulate ingest predict alerts dashboard api test demo all clean

help:
	@echo "Smart Production-Line Downtime Prediction Commands:"
	@echo "  make broker       - Start HiveMQ Community Edition broker"
	@echo "  make seed-data    - Generate 30 days of historical data into SQLite"
	@echo "  make train        - Train ML models (XGBoost + RUL + Isolation Forest)"
	@echo "  make simulate     - Start live line sensor data generator over MQTT"
	@echo "  make ingest       - Start telemetry ingestion & SQLite writer service"
	@echo "  make predict      - Start real-time ML inference worker"
	@echo "  make alerts       - Start real-time alerting engine"
	@echo "  make dashboard    - Launch the Streamlit dashboard"
	@echo "  make demo         - Run end-to-end failure injection demo"
	@echo "  make all          - Run broker, ingestion, inference, alerts, and dashboard"

broker:
	cd downtime-prediction && make broker

seed-data:
	cd downtime-prediction && make seed-data

train:
	cd downtime-prediction && make train

simulate:
	cd downtime-prediction && make simulate

ingest:
	cd downtime-prediction && make ingest

predict:
	cd downtime-prediction && make predict

alerts:
	cd downtime-prediction && make alerts

dashboard:
	cd downtime-prediction && make dashboard

demo:
	cd downtime-prediction && make demo

test:
	cd downtime-prediction && make test
