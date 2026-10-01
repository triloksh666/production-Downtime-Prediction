"""
Thread-safe batch writer for SQLite database with queue flushing.
"""

import time
import queue
import logging
import threading
from typing import List, Dict, Any
from src.db.database import Database

logger = logging.getLogger(__name__)

class BatchDatabaseWriter:
    def __init__(self, db: Database, batch_size: int = 100, flush_interval_sec: float = 1.0):
        self.db = db
        self.batch_size = batch_size
        self.flush_interval_sec = flush_interval_sec
        self.queue: queue.Queue = queue.Queue(maxsize=10000)
        self.running = False
        self.worker_thread: threading.Thread = None
        self.total_written = 0

    def start(self):
        self.running = True
        self.worker_thread = threading.Thread(target=self._worker_loop, daemon=True)
        self.worker_thread.start()
        logger.info("BatchDatabaseWriter started (Batch size: %d, Flush: %.1fs)", self.batch_size, self.flush_interval_sec)

    def enqueue(self, item: Dict[str, Any]) -> bool:
        try:
            self.queue.put_nowait(item)
            return True
        except queue.Full:
            logger.warning("Database write queue is full! Dropping row.")
            return False

    def _worker_loop(self):
        last_flush = time.time()
        buffer: List[Dict[str, Any]] = []

        while self.running or not self.queue.empty():
            try:
                item = self.queue.get(timeout=0.2)
                buffer.append(item)
            except queue.Empty:
                pass

            now = time.time()
            time_to_flush = (now - last_flush) >= self.flush_interval_sec
            size_to_flush = len(buffer) >= self.batch_size

            if buffer and (time_to_flush or size_to_flush or not self.running):
                try:
                    count = self.db.insert_telemetry_batch(buffer)
                    self.total_written += count
                    last_flush = now
                    buffer = []
                except Exception as e:
                    logger.error("Failed to insert telemetry batch: %s", e)
                    # Retry single-row fallback
                    buffer = []

    def stop(self):
        self.running = False
        if self.worker_thread and self.worker_thread.is_alive():
            self.worker_thread.join(timeout=3.0)
        logger.info("BatchDatabaseWriter stopped. Total rows persisted: %d", self.total_written)
