.PHONY: help install broker seed-data train simulate ingest predict alerts dashboard api test clean all

PYTHON := python3
PIP := pip

help:
	@echo "Smart Production-Line Downtime Prediction Commands:"
	@echo "  make install      - Install python dependencies"
	@echo "  make broker       - Start HiveMQ Community Edition via Docker"
	@echo "  make seed-data    - Generate 30 days of historical data into SQLite"
	@echo "  make train        - Train ML models (XGBoost + RUL + Isolation Forest)"
	@echo "  make simulate     - Start live line sensor data generator over MQTT"
	@echo "  make ingest       - Start telemetry ingestion & SQLite writer service"
	@echo "  make predict      - Start real-time ML inference worker"
	@echo "  make alerts       - Start real-time alerting engine"
	@echo "  make dashboard    - Launch the Streamlit dashboard"
	@echo "  make api          - Launch FastAPI REST server"
	@echo "  make test         - Run pytest suite"
	@echo "  make demo         - Run end-to-end failure injection demo"
	@echo "  make all          - Run broker, ingestion, inference, alerts, and dashboard"

install:
	$(PIP) install -r requirements.txt

broker:
	docker compose up -d hivemq
	@echo "HiveMQ running at localhost:1883. Web console at http://localhost:8080"

seed-data:
	$(PYTHON) -m src.simulator.cli --mode batch --duration-hours 720 --machines 5 --speedup 100

train:
	$(PYTHON) -m src.ml.train --db-path data/factory.db --output-dir models/

simulate:
	$(PYTHON) -m src.simulator.cli --mode live --speedup 1.0

ingest:
	$(PYTHON) -m src.ingestion.subscriber

predict:
	$(PYTHON) -m src.ml.predict

alerts:
	$(PYTHON) -m src.alerts.engine

api:
	uvicorn src.api.main:app --reload --port 8000

dashboard:
	streamlit run src/dashboard/app.py

test:
	pytest tests/ -v

demo:
	$(PYTHON) -m src.simulator.cli --mode demo --machine cnc_01 --failure bearing_wear

clean:
	rm -rf data/*.db models/*.joblib __pycache__ .pytest_cache
