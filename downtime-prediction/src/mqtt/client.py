"""
Factory MQTT Client wrapper using paho-mqtt v2 API.
Supports both Local HiveMQ CE and HiveMQ Cloud (TLS + auth),
with Last Will and Testament (LWT) and auto-reconnection.
"""

import os
import ssl
import json
import time
import logging
from typing import Callable, Optional, Dict, Any
from paho.mqtt import client as mqtt_client
from paho.mqtt.enums import CallbackAPIVersion
from src.mqtt.topics import GATEWAY_LWT_TOPIC

logger = logging.getLogger(__name__)

class FactoryMQTTClient:
    def __init__(self, client_id: str, clean_session: bool = True):
        self.client_id = client_id
        self.broker_mode = os.getenv("BROKER_MODE", "local").lower()
        
        # Configure host and port based on mode
        if self.broker_mode == "cloud":
            self.host = os.getenv("CLOUD_BROKER_HOST", "localhost")
            self.port = int(os.getenv("CLOUD_BROKER_PORT", 8883))
            self.username = os.getenv("CLOUD_BROKER_USERNAME", "")
            self.password = os.getenv("CLOUD_BROKER_PASSWORD", "")
            self.use_tls = True
        else:
            self.host = os.getenv("LOCAL_BROKER_HOST", os.getenv("BROKER_HOST", "localhost"))
            self.port = int(os.getenv("LOCAL_BROKER_PORT", os.getenv("BROKER_PORT", 1883)))
            self.username = None
            self.password = None
            self.use_tls = False

        # Instantiate Paho v2 client
        self.client = mqtt_client.Client(
            CallbackAPIVersion.VERSION2,
            client_id=self.client_id,
            protocol=mqtt_client.MQTTv5
        )

        if self.username and self.password:
            self.client.username_pw_set(self.username, self.password)

        if self.use_tls:
            context = ssl.create_default_context()
            self.client.tls_set_context(context)

        # Set Last Will & Testament (LWT)
        lwt_payload = json.dumps({
            "client_id": self.client_id,
            "status": "OFFLINE",
            "reason": "Unexpected disconnection / LWT triggered",
            "ts": time.time()
        })
        self.client.will_set(
            topic=f"{GATEWAY_LWT_TOPIC}/{self.client_id}",
            payload=lwt_payload,
            qos=1,
            retain=True
        )

        # Callbacks
        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect
        self.client.on_message = self._on_message
        self.message_handlers: Dict[str, Callable] = {}
        self.connected = False

    def _on_connect(self, client, userdata, flags, reason_code, properties):
        if reason_code == 0:
            self.connected = True
            logger.info("Connected to HiveMQ broker [%s:%d] as %s", self.host, self.port, self.client_id)
            # Re-subscribe to any registered topics
            for topic in self.message_handlers.keys():
                client.subscribe(topic, qos=1)
                logger.info("Subscribed to MQTT topic: %s", topic)
        else:
            self.connected = False
            logger.error("Failed to connect to HiveMQ: ReasonCode=%s", reason_code)

    def _on_disconnect(self, client, userdata, disconnect_flags, reason_code, properties):
        self.connected = False
        logger.warning("Disconnected from HiveMQ: %s. Attempting auto-reconnect...", reason_code)

    def _on_message(self, client, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode("utf-8"))
        except Exception:
            payload = msg.payload.decode("utf-8", errors="replace")

        # Route to exact match or wildcard subscriber
        for topic_pattern, handler in self.message_handlers.items():
            if mqtt_client.topic_matches_sub(topic_pattern, msg.topic):
                try:
                    handler(msg.topic, payload)
                except Exception as e:
                    logger.exception("Error executing handler for topic %s: %s", msg.topic, e)

    def subscribe(self, topic: str, handler: Callable[[str, Any], None], qos: int = 1):
        self.message_handlers[topic] = handler
        if self.connected:
            self.client.subscribe(topic, qos=qos)
            logger.info("Subscribed to MQTT topic: %s (QoS %d)", topic, qos)

    def publish(self, topic: str, payload: Any, qos: int = 1, retain: bool = False):
        if isinstance(payload, (dict, list)):
            data_str = json.dumps(payload)
        else:
            data_str = str(payload)
        return self.client.publish(topic, data_str, qos=qos, retain=retain)

    def start(self):
        """Connects and starts background network loop with auto-reconnection."""
        logger.info("Connecting to %s:%d (%s mode)...", self.host, self.port, self.broker_mode)
        self.client.reconnect_delay_set(min_delay=1, max_delay=60)
        self.client.connect_async(self.host, self.port, keepalive=60)
        self.client.loop_start()

    def stop(self):
        # Publish graceful offline status
        graceful_payload = json.dumps({
            "client_id": self.client_id,
            "status": "OFFLINE",
            "reason": "Graceful shutdown",
            "ts": time.time()
        })
        self.client.publish(f"{GATEWAY_LWT_TOPIC}/{self.client_id}", graceful_payload, qos=1, retain=True)
        self.client.loop_stop()
        self.client.disconnect()
        logger.info("MQTT Client %s disconnected gracefully", self.client_id)
