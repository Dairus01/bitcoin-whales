"""Web interface for WhaleWatch.

This Flask application runs a background instance of :class:`WhaleWatch` and
exposes its events via server‑sent events (SSE) to connected clients.  The
web front‑end displays a live feed of whale transactions, periodic summary
statistics, and new block notifications.
"""

import json
import os
import queue
import threading
import time
from datetime import datetime
from typing import Dict, List, Tuple, Optional

from flask import Flask, render_template, Response, request, stream_with_context

from whalewatch_core import WhaleWatch


app = Flask(__name__, template_folder="templates", static_folder="static")

# Global reference to the WhaleWatch instance; will be created when the server starts
watcher: WhaleWatch | None = None

# List of queues for connected SSE clients.  Each client has its own queue
# so that events are delivered independently.  Access to this list must be
# synchronized.
client_queues: List[queue.Queue] = []
client_lock = threading.Lock()


def broadcast_event(event_type: str, data: Dict[str, any]) -> None:
    """Place an event into each connected client's queue."""
    with client_lock:
        for q in client_queues:
            try:
                q.put((event_type, data), timeout=0.1)
            except queue.Full:
                # Skip if queue is full to avoid blocking
                pass


@app.route("/stream")
def stream() -> Response:
    """SSE endpoint providing a continuous stream of JSON events."""
    def gen() -> any:
        # Create a new queue for this client
        q: queue.Queue = queue.Queue(maxsize=100)
        with client_lock:
            client_queues.append(q)
        try:
            # Send a hello event on connect
            yield f"event: hello\ndata: {{}}\n\n"
            while True:
                try:
                    event_type, data = q.get(timeout=1.0)
                except queue.Empty:
                    # Send keepalive comment to prevent connection from closing
                    yield ": keepalive\n\n"
                    continue
                # Compose SSE formatted message
                yield f"event: {event_type}\ndata: {json.dumps(data)}\n\n"
        finally:
            # Remove the queue when client disconnects
            with client_lock:
                try:
                    client_queues.remove(q)
                except ValueError:
                    pass

    return Response(stream_with_context(gen()), mimetype="text/event-stream")


@app.route("/")
def index() -> str:
    """Render the main page.

    Query parameters may override the whale threshold and summary interval.  For
    example: `/` or `/?threshold=50&interval=30`.
    """
    return render_template("index.html")


@app.route("/config", methods=["GET", "POST"])
def config_endpoint() -> Response:
    """Get or update WhaleWatch configuration.

    GET returns the current threshold and summary interval as JSON.
    POST updates these values; accepts JSON or form data with keys
    ``threshold`` (float) and ``interval`` (int).  After updating, a
    configuration event is broadcast to all clients.
    """
    # Use the global watcher
    global watcher
    if watcher is None:
        # Not started yet; return defaults
        return {
            "threshold": None,
            "interval": None,
            "error": "Watcher not initialized",
        }
    if request.method == "POST":
        try:
            data = request.get_json(force=True, silent=True) or request.form
        except Exception:
            data = request.form
        new_threshold = data.get("threshold")
        new_interval = data.get("interval")
        # Convert to float/int if provided
        threshold_val: Optional[float] = None
        interval_val: Optional[int] = None
        try:
            if new_threshold is not None:
                threshold_val = float(new_threshold)
        except ValueError:
            pass
        try:
            if new_interval is not None:
                interval_val = int(new_interval)
        except ValueError:
            pass
        # Update watcher
        watcher.update_config(threshold_btc=threshold_val, summary_interval=interval_val)
        # Determine effective values
        effective_threshold = watcher.threshold_btc
        effective_interval = watcher.summary_interval
        # Broadcast config event
        broadcast_event(
            "config",
            {
                "threshold": effective_threshold,
                "interval": effective_interval,
            },
        )
        return {
            "status": "ok",
            "threshold": effective_threshold,
            "interval": effective_interval,
        }
    else:
        return {
            "threshold": watcher.threshold_btc,
            "interval": watcher.summary_interval,
        }


@app.route("/health")
def health_check():
    """Health check endpoint for Railway deployment."""
    global watcher
    try:
        if watcher and hasattr(watcher, 'is_running'):
            status = 'healthy' if watcher.is_running() else 'degraded'
        else:
            status = 'starting'
        return {'status': status, 'timestamp': datetime.now().isoformat()}, 200
    except Exception as e:
        return {'status': 'error', 'error': str(e)}, 500


def parse_config() -> Tuple[float, int]:
    """Read whale threshold and interval from environment or defaults."""
    threshold = float(os.environ.get("WHALE_THRESHOLD", "100"))
    interval = int(os.environ.get("SUMMARY_INTERVAL", "60"))
    return threshold, interval


def start_watcher() -> WhaleWatch:
    """Instantiate and start the WhaleWatch background service."""
    threshold, interval = parse_config()
    watcher = WhaleWatch(threshold_btc=threshold, summary_interval=interval, callback=broadcast_event)
    watcher.start()
    return watcher

# For production deployment with Gunicorn, the watcher needs to be started
# when the app is loaded, not just when __name__ == "__main__"
# This ensures the background thread is running when Gunicorn workers start.
def initialize_watcher():
    global watcher
    if watcher is None:
        watcher = start_watcher()

# Initialize watcher when app starts
with app.app_context():
    initialize_watcher()

if __name__ == "__main__":
    # Optionally read threshold and interval from command‑line arguments via env vars
    # Start background watcher
    watcher = start_watcher()
    # Run Flask app
    try:
        app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")), threaded=True)
    finally:
        if watcher is not None:
            watcher.stop()