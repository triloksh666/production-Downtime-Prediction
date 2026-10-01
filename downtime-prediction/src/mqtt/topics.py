"""
MQTT Topic definitions for the factory production line.
"""

LINE_ID = "line1"
BASE_TOPIC = f"factory/{LINE_ID}"

# Telemetry streaming: factory/line1/{machine_id}/telemetry
def telemetry_topic(machine_id: str) -> str:
    return f"{BASE_TOPIC}/{machine_id}/telemetry"

# Retained status topic: factory/line1/{machine_id}/status
def status_topic(machine_id: str) -> str:
    return f"{BASE_TOPIC}/{machine_id}/status"

# Line alerts: factory/line1/alerts
ALERTS_TOPIC = f"{BASE_TOPIC}/alerts"

# ML Predictions: factory/line1/predictions/{machine_id}
def predictions_topic(machine_id: str) -> str:
    return f"{BASE_TOPIC}/predictions/{machine_id}"

# Gateway & machine online/LWT status
GATEWAY_LWT_TOPIC = f"{BASE_TOPIC}/gateway/lwt"

# Simulation controls: factory/line1/control
CONTROL_TOPIC = f"{BASE_TOPIC}/control"

# Wildcard patterns for subscribers
ALL_TELEMETRY_TOPIC = f"{BASE_TOPIC}/+/telemetry"
ALL_STATUS_TOPIC = f"{BASE_TOPIC}/+/status"
ALL_PREDICTIONS_TOPIC = f"{BASE_TOPIC}/predictions/+"
