"""
Notification channels: Console, MQTT alerts topic, Slack webhook, Telegram, and Email SMTP.
"""

import os
import json
import logging
import smtplib
from email.mime.text import MIMEText
from typing import Dict, Any
import requests

logger = logging.getLogger(__name__)

class NotificationDispatcher:
    def __init__(self, mqtt_client=None):
        self.mqtt_client = mqtt_client
        self.slack_url = os.getenv("WEBHOOK_SLACK_URL", "").strip()
        self.tg_token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
        self.tg_chat = os.getenv("TELEGRAM_CHAT_ID", "").strip()
        self.smtp_host = os.getenv("SMTP_HOST", "").strip()
        self.smtp_user = os.getenv("SMTP_USER", "").strip()
        self.smtp_pass = os.getenv("SMTP_PASSWORD", "").strip()
        self.smtp_to = os.getenv("ALERT_EMAIL_TO", "").strip()

    def dispatch(self, alert_dict: Dict[str, Any]):
        severity = alert_dict.get("severity", "INFO")
        machine = alert_dict.get("machine_id", "unknown")
        msg = alert_dict.get("message", "")

        # 1. Console structured log
        prefix = f"🚨 [{severity}]" if severity == "CRITICAL" else (f"⚠️ [{severity}]" if severity == "WARNING" else f"ℹ️ [{severity}]")
        logger.warning("%s Machine: %s | %s", prefix, machine, msg)

        # 2. MQTT alerts topic
        if self.mqtt_client and self.mqtt_client.connected:
            from src.mqtt.topics import ALERTS_TOPIC
            self.mqtt_client.publish(ALERTS_TOPIC, alert_dict, qos=1)

        # 3. Optional Slack Webhook
        if self.slack_url:
            try:
                payload = {
                    "text": f"*{prefix} {machine}*\n>{msg}\n*Action:* `{alert_dict.get('recommended_action')}`"
                }
                requests.post(self.slack_url, json=payload, timeout=3.0)
            except Exception as e:
                logger.error("Failed to send Slack alert: %s", e)

        # 4. Optional Telegram Bot
        if self.tg_token and self.tg_chat:
            try:
                tg_url = f"https://api.telegram.org/bot{self.tg_token}/sendMessage"
                text = f"{prefix} {machine}\n{msg}\nAction: {alert_dict.get('recommended_action')}"
                requests.post(tg_url, json={"chat_id": self.tg_chat, "text": text}, timeout=3.0)
            except Exception as e:
                logger.error("Failed to send Telegram alert: %s", e)
