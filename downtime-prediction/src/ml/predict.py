"""
Real-time ML Inference Service.
Scores live sensor telemetry from memory buffer, generates failure probabilities,
predicted time-to-failure (TTF), and anomaly scores, and publishes to MQTT predictions topic.
"""

import os
import time
import json
import logging
from collections import defaultdict, deque
from datetime import datetime

from src.db.database import Database
from src.mqtt.client import FactoryMQTTClient
from src.mqtt.topics import ALL_TELEMETRY_TOPIC, predictions_topic
from src.features.engineering import FeatureEngineer
from src.ml.train import DowntimeModelPackage
import joblib

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("inference-service")

class InferenceService:
    def __init__(self, model_path: str = "models/latest_model.joblib", db_path: str = "data/factory.db"):
        self.model_path = model_path
        self.db = Database(db_path)
        self.mqtt_client = FactoryMQTTClient(client_id="inference_worker")
        
        # Buffer of last 120 samples per machine for sliding window features
        self.history: dict[str, deque] = defaultdict(lambda: deque(maxlen=120))
        self.model_pkg: DowntimeModelPackage = None
        self._load_model()

    def _load_model(self):
        if os.path.exists(self.model_path):
            try:
                self.model_pkg = joblib.load(self.model_path)
                logger.info("Loaded ML model package from %s", self.model_path)
            except Exception as e:
                logger.error("Failed loading model from %s: %s", self.model_path, e)
        else:
            logger.warning("Model file not found at %s. Inference will use heuristic fallback until model is trained.", self.model_path)

    def _on_telemetry_message(self, topic: str, payload: dict):
        try:
            m_id = payload["machine_id"]
            self.history[m_id].append(payload)

            # Need at least 3 samples to compute features
            if len(self.history[m_id]) < 3:
                return

            # Extract features in real time
            feats = FeatureEngineer.extract_single_observation(list(self.history[m_id]))

            if self.model_pkg:
                pred = self.model_pkg.predict(feats)
                version = self.model_pkg.metadata.get("version", "v1.0")
            else:
                # Physics rule-based fallback
                last = payload
                is_stress = (last["vibration"] > 3.5 or last["temperature"] > 75.0)
                prob = 0.75 if is_stress else 0.05
                pred = {
                    "failure_prob": prob,
                    "predicted_ttf_min": 25.0 if is_stress else 999.0,
                    "anomaly_score": 0.6 if is_stress else 0.05,
                    "risk_level": "HIGH" if prob > 0.6 else "LOW"
                }
                version = "heuristic_baseline"

            # Create prediction record
            record = {
                "ts": payload["ts"],
                "machine_id": m_id,
                "failure_prob": pred["failure_prob"],
                "predicted_ttf_min": pred["predicted_ttf_min"],
                "anomaly_score": pred["anomaly_score"],
                "risk_level": pred["risk_level"],
                "model_version": version
            }

            # 1. Persist to SQLite
            self.db.insert_prediction(record)

            # 2. Publish to MQTT predictions topic
            self.mqtt_client.publish(predictions_topic(m_id), record, qos=1)

            if pred["risk_level"] in ["HIGH", "CRITICAL"]:
                logger.warning("[%s] HIGH RISK PREDICTED: Prob=%.2f, TTF=%.1f min, Anomaly=%.2f",
                               m_id, pred["failure_prob"], pred["predicted_ttf_min"], pred["anomaly_score"])

        except Exception as e:
            logger.exception("Error during inference: %s", e)

    def start(self):
        self.mqtt_client.start()
        self.mqtt_client.subscribe(ALL_TELEMETRY_TOPIC, self._on_telemetry_message, qos=1)
        logger.info("Inference service active and listening to %s", ALL_TELEMETRY_TOPIC)

        try:
            while True:
                time.sleep(5.0)
        except KeyboardInterrupt:
            logger.info("Stopping inference service...")
        finally:
            self.stop()

    def stop(self):
        self.mqtt_client.stop()

if __name__ == "__main__":
    service = InferenceService()
    service.start()
