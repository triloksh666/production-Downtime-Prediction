"""
MQTT Ingestion Subscriber service.
Validates payloads via Pydantic, batches inserts into SQLite,
tracks ingestion lag and message rate health metrics.
"""

import time
import json
import logging
from datetime import datetime
from collections import deque
from pydantic import ValidationError

from src.db.database import Database
from src.mqtt.client import FactoryMQTTClient
from src.mqtt.topics import ALL_TELEMETRY_TOPIC
from src.ingestion.validator import TelemetryPayload
from src.ingestion.writer import BatchDatabaseWriter

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("ingestion-service")

class IngestionService:
    def __init__(self, db_path: str = "data/factory.db"):
        self.db = Database(db_path)
        self.writer = BatchDatabaseWriter(self.db, batch_size=50, flush_interval_sec=1.0)
        self.mqtt_client = FactoryMQTTClient(client_id="ingestion_service")

        # Health statistics
        self.total_received = 0
        self.total_dropped = 0
        self.total_validated = 0
        self.rate_window = deque(maxlen=60) # Timestamps of messages in last 60s
        self.last_msg_time = {}

    def _on_telemetry_message(self, topic: str, payload: dict):
        now = time.time()
        self.total_received += 1
        self.rate_window.append(now)

        try:
            # Pydantic validation
            validated: TelemetryPayload = TelemetryPayload.model_validate(payload)
            data_dict = validated.model_dump()
            
            # Record machine arrival lag
            msg_dt = datetime.fromisoformat(validated.ts.replace("Z", "+00:00"))
            lag_sec = max(0.0, (datetime.now(msg_dt.tzinfo) - msg_dt).total_seconds())
            self.last_msg_time[validated.machine_id] = now

            # Enqueue for batched database insertion
            enqueued = self.writer.enqueue(data_dict)
            if enqueued:
                self.total_validated += 1
            else:
                self.total_dropped += 1

        except ValidationError as val_err:
            self.total_dropped += 1
            logger.warning("Dropped malformed telemetry message on %s: %s", topic, val_err.errors()[0]["msg"])
        except Exception as e:
            self.total_dropped += 1
            logger.error("Unexpected error parsing message: %s", e)

    def get_health_stats(self) -> dict:
        now = time.time()
        # Clean rate window older than 10s
        while self.rate_window and now - self.rate_window[0] > 10.0:
            self.rate_window.popleft()
        msg_per_sec = round(len(self.rate_window) / 10.0, 1)

        return {
            "status": "HEALTHY" if self.mqtt_client.connected else "DISCONNECTED",
            "messages_per_sec": msg_per_sec,
            "total_received": self.total_received,
            "total_validated": self.total_validated,
            "total_dropped": self.total_dropped,
            "queue_pending": self.writer.queue.qsize(),
            "active_machines": list(self.last_msg_time.keys())
        }

    def start(self):
        self.writer.start()
        self.mqtt_client.start()
        self.mqtt_client.subscribe(ALL_TELEMETRY_TOPIC, self._on_telemetry_message, qos=1)
        logger.info("Ingestion service active. Subscribed to %s", ALL_TELEMETRY_TOPIC)

        try:
            while True:
                time.sleep(10.0)
                stats = self.get_health_stats()
                logger.info("Ingestion Health: %s msgs/s | Total: %d | Dropped: %d | Active: %s",
                            stats["messages_per_sec"], stats["total_received"], stats["total_dropped"], stats["active_machines"])
        except KeyboardInterrupt:
            logger.info("Stopping ingestion service...")
        finally:
            self.stop()

    def stop(self):
        self.mqtt_client.stop()
        self.writer.stop()

if __name__ == "__main__":
    service = IngestionService()
    service.start()
