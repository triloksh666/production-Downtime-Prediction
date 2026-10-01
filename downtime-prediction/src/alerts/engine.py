"""
Real-time Alert Engine Service.
Subscribes to telemetry and ML predictions over MQTT, applies multi-tier rules,
handles de-duplication, cooldown timers, auto-escalation, and auto-resolve logic.
"""

import time
import logging
from datetime import datetime
from collections import defaultdict
from typing import Dict, Any

from src.db.database import Database
from src.mqtt.client import FactoryMQTTClient
from src.mqtt.topics import ALL_TELEMETRY_TOPIC, ALL_PREDICTIONS_TOPIC
from src.alerts.rules import AlertRulesEngine, AlertEvaluation
from src.alerts.notifiers import NotificationDispatcher

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("alert-engine")

class AlertEngineService:
    def __init__(self, db_path: str = "data/factory.db", cooldown_seconds: float = 300.0):
        self.db = Database(db_path)
        self.mqtt_client = FactoryMQTTClient(client_id="alert_engine")
        self.notifier = NotificationDispatcher(self.mqtt_client)
        self.cooldown_seconds = cooldown_seconds # 5 minutes cooldown per alert type

        # State tracking: key = (machine_id, alert_type)
        self.last_fired_ts: Dict[tuple, float] = {}
        self.active_alert_ids: Dict[tuple, int] = {}
        self.latest_telemetry: Dict[str, dict] = {}
        self.latest_predictions: Dict[str, dict] = {}

    def _on_telemetry(self, topic: str, payload: dict):
        m_id = payload.get("machine_id")
        if m_id:
            self.latest_telemetry[m_id] = payload
            self._evaluate_machine(m_id)

    def _on_prediction(self, topic: str, payload: dict):
        m_id = payload.get("machine_id")
        if m_id:
            self.latest_predictions[m_id] = payload
            self._evaluate_machine(m_id)

    def _evaluate_machine(self, machine_id: str):
        telem = self.latest_telemetry.get(machine_id)
        if not telem:
            return
        pred = self.latest_predictions.get(machine_id)

        evaluations = AlertRulesEngine.evaluate(telem, pred)
        now = time.time()
        active_types_this_eval = set()

        for ev in evaluations:
            key = (machine_id, ev.type)
            active_types_this_eval.add(key)
            last_fired = self.last_fired_ts.get(key, 0.0)

            # Check cooldown
            if (now - last_fired) >= self.cooldown_seconds:
                alert_dict = {
                    "ts": datetime.utcnow().isoformat() + "Z",
                    "machine_id": machine_id,
                    "severity": ev.severity,
                    "type": ev.type,
                    "message": ev.message,
                    "failure_prob": pred.get("failure_prob") if pred else None,
                    "predicted_ttf_min": pred.get("predicted_ttf_min") if pred else None,
                    "contributing_features": ev.contributing_feature,
                    "recommended_action": ev.recommended_action
                }
                # 1. Insert into database
                alert_id = self.db.insert_alert(alert_dict)
                alert_dict["id"] = alert_id
                self.last_fired_ts[key] = now
                self.active_alert_ids[key] = alert_id

                # 2. Dispatch notifications
                self.notifier.dispatch(alert_dict)

        # Auto-resolve logic: if an active alert is no longer triggered and machine healthy
        for key, alert_id in list(self.active_alert_ids.items()):
            if key[0] == machine_id and key not in active_types_this_eval:
                # Sensor recovered
                if telem.get("status") == "RUNNING" and (not pred or pred.get("failure_prob", 0.0) < 0.3):
                    self.db.resolve_alert(alert_id)
                    logger.info("Auto-resolved alert #%d on %s (%s recovered to nominal)", alert_id, machine_id, key[1])
                    del self.active_alert_ids[key]

    def start(self):
        self.mqtt_client.start()
        self.mqtt_client.subscribe(ALL_TELEMETRY_TOPIC, self._on_telemetry, qos=1)
        self.mqtt_client.subscribe(ALL_PREDICTIONS_TOPIC, self._on_prediction, qos=1)
        logger.info("Alert engine active. Subscribed to telemetry and predictions.")

        try:
            while True:
                time.sleep(5.0)
        except KeyboardInterrupt:
            logger.info("Stopping alert engine...")
        finally:
            self.stop()

    def stop(self):
        self.mqtt_client.stop()

if __name__ == "__main__":
    engine = AlertEngineService()
    engine.start()
