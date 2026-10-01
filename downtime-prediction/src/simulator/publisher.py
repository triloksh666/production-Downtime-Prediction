"""
Publishes live simulation telemetry to HiveMQ over MQTT.
"""

import time
import logging
from datetime import datetime
from typing import Optional

from src.simulator.generator import FactorySimulator
from src.mqtt.client import FactoryMQTTClient
from src.mqtt.topics import telemetry_topic, status_topic, CONTROL_TOPIC

logger = logging.getLogger(__name__)

class TelemetryPublisher:
    def __init__(self, speedup: float = 1.0, failure_rate: float = 0.08, seed: int = 42):
        self.speedup = speedup
        self.simulator = FactorySimulator(failure_rate=failure_rate, seed=seed)
        self.mqtt_client = FactoryMQTTClient(client_id="sim_publisher_gateway")
        self.running = False
        self.paused = False

    def _on_control_message(self, topic: str, payload: dict):
        action = payload.get("action")
        if action == "inject_failure":
            m_id = payload.get("machine_id", "cnc_01")
            ftype = payload.get("failure_type", "bearing_wear")
            lead = float(payload.get("lead_time_min", 45.0))
            success = self.simulator.inject_failure(m_id, ftype, lead)
            logger.info("Control: Injected %s on %s (Lead: %s min). Success: %s", ftype, m_id, lead, success)
        elif action == "pause":
            self.paused = True
            logger.info("Simulator paused via MQTT control")
        elif action == "resume":
            self.paused = False
            logger.info("Simulator resumed via MQTT control")
        elif action == "set_speedup":
            self.speedup = float(payload.get("speedup", 1.0))
            logger.info("Simulator speedup set to %fx", self.speedup)

    def start(self):
        self.mqtt_client.start()
        # Listen for control messages
        self.mqtt_client.subscribe(CONTROL_TOPIC, self._on_control_message)
        self.running = True
        logger.info("Starting live telemetry publisher loop (Speedup: %.1fx)...", self.speedup)

        try:
            while self.running:
                loop_start = time.time()
                current_time = datetime.utcnow()

                if not self.paused:
                    # Simulation step of 1 second virtual time
                    telemetries = self.simulator.step(dt_seconds=1.0 * self.speedup, current_time=current_time)

                    for data in telemetries:
                        m_id = data["machine_id"]
                        # 1. Publish full telemetry payload (QoS 1)
                        self.mqtt_client.publish(telemetry_topic(m_id), data, qos=1)

                        # 2. Publish retained status topic
                        status_payload = {
                            "machine_id": m_id,
                            "status": data["status"],
                            "ts": data["ts"],
                            "temperature": data["temperature"],
                            "vibration": data["vibration"]
                        }
                        self.mqtt_client.publish(status_topic(m_id), status_payload, qos=1, retain=True)

                elapsed = time.time() - loop_start
                sleep_target = max(0.01, (1.0 / max(0.1, self.speedup)) - elapsed)
                time.sleep(sleep_target)

        except KeyboardInterrupt:
            logger.info("Simulation publisher interrupted by user")
        finally:
            self.stop()

    def stop(self):
        self.running = False
        self.mqtt_client.stop()
        logger.info("Telemetry publisher stopped")
