"""Core logic for real‑time Bitcoin whale monitoring with callback support.

This module defines the :class:`WhaleWatch` class, which connects to the
Blockchain.com WebSocket API, monitors unconfirmed transactions and blocks,
fetches current BTC price from CoinGecko, and calls user‑provided callback
functions when notable events occur.  It is derived from the command‑line
version of WhaleWatch, but removed console printing and instead exposes
events via callbacks.
"""

import json
import threading
import time
from datetime import datetime
from typing import Callable, Dict, List, Optional, Tuple

import requests
import websocket


class WhaleWatch:
    """Monitor Bitcoin mempool for large transactions and summarize activity.

    This version accepts callback functions to report events to a web
    interface or other consumer.  Callback functions receive two
    positional arguments: ``event_type`` (a string) and ``data`` (a
    dictionary).  Supported event types are:

    * ``"whale"`` – a transaction exceeding the configured threshold
      was detected.  The data dictionary contains keys ``hash``,
      ``value_btc``, ``value_usd``, ``timestamp`` and ``address``.
    * ``"summary"`` – a periodic summary of recent activity.  The
      dictionary contains keys ``count``, ``total_btc``, ``avg_btc``,
      ``total_usd``, ``avg_usd``, ``whales`` and ``timestamp``.
    * ``"block"`` – a new block was observed.  The dictionary
      contains keys ``height`` (optional), ``n_tx`` (optional), and
      ``timestamp``.

    Parameters
    ----------
    threshold_btc: float, optional
        Minimum transaction value in BTC to classify a transaction as a
        whale.  Default is 100 BTC.
    summary_interval: int, optional
        Number of seconds between summary events.  Default is 60.
    callback: callable, optional
        A function ``callback(event_type, data)`` that will be invoked
        whenever a whale is detected, a summary is produced, or a new
        block is observed.  If ``None``, no callback is invoked.
    """

    def __init__(
        self,
        threshold_btc: float = 100.0,
        summary_interval: int = 60,
        callback: Optional[Callable[[str, Dict[str, any]], None]] = None,
    ) -> None:
        self.threshold_btc = threshold_btc
        self.summary_interval = summary_interval
        self.callback = callback

        # Shared state protected by a lock
        self._lock = threading.Lock()
        self._reset_stats()

        # Price caching
        self._price_usd: Optional[float] = None

        # Thread control flag
        self._stop_event = threading.Event()

    def _reset_stats(self) -> None:
        """Reset per‑interval statistics."""
        self._unconfirmed_count = 0
        self._total_value_sat = 0  # in satoshis
        self._whale_count = 0

    # ---------------------- Price fetching ----------------------
    def _fetch_price(self) -> Optional[float]:
        """Fetch current BTC price in USD from CoinGecko."""
        url = (
            "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin"
            "&vs_currencies=usd"
        )
        try:
            resp = requests.get(url, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                return float(data.get("bitcoin", {}).get("usd"))
        except requests.RequestException:
            pass
        return None

    def _price_loop(self) -> None:
        """Background thread that updates the BTC price periodically."""
        while not self._stop_event.is_set():
            price = self._fetch_price()
            if price is not None:
                self._price_usd = price
            time.sleep(60)

    # ---------------------- WebSocket handlers ----------------------
    def _on_open(self, ws: websocket.WebSocketApp) -> None:
        """Subscribe to unconfirmed transactions and new blocks."""
        ws.send(json.dumps({"op": "unconfirmed_sub"}))
        ws.send(json.dumps({"op": "blocks_sub"}))
        ws.send(json.dumps({"op": "ping"}))

    def _on_message(self, ws: websocket.WebSocketApp, message: str) -> None:
        """Handle incoming WebSocket messages."""
        try:
            data = json.loads(message)
        except json.JSONDecodeError:
            return
        op = data.get("op")
        if op == "utx":
            self._handle_unconfirmed_tx(data.get("x", {}))
        elif op == "block":
            self._handle_new_block(data.get("x", {}))

    def _handle_unconfirmed_tx(self, tx: Dict[str, any]) -> None:
        """Process an unconfirmed transaction and trigger whale callback."""
        outputs: List[Dict[str, any]] = tx.get("out", [])
        total_sat = 0
        for out in outputs:
            try:
                total_sat += int(out.get("value", 0))
            except (TypeError, ValueError):
                continue
        total_btc = total_sat / 1e8
        first_addr = outputs[0].get("addr") if outputs else None
        timestamp = tx.get("time")
        tx_hash = tx.get("hash")
        # Update statistics
        with self._lock:
            self._unconfirmed_count += 1
            self._total_value_sat += total_sat
            if total_btc >= self.threshold_btc:
                self._whale_count += 1
                # Trigger callback for whales
                if self.callback is not None:
                    event_data = {
                        "hash": tx_hash,
                        "value_btc": total_btc,
                        "value_usd": (self._price_usd or 0.0) * total_btc,
                        "timestamp": timestamp,
                        "address": first_addr,
                    }
                    try:
                        self.callback("whale", event_data)
                    except Exception:
                        pass

    def _handle_new_block(self, block: Dict[str, any]) -> None:
        """Trigger callback for new block events."""
        height = block.get("height")
        n_tx = block.get("nTx")
        timestamp = datetime.now().timestamp()
        if self.callback is not None:
            event_data = {
                "height": height,
                "n_tx": n_tx,
                "timestamp": timestamp,
            }
            try:
                self.callback("block", event_data)
            except Exception:
                pass

    def _summary_loop(self) -> None:
        """Produce periodic summary events and reset counters."""
        while not self._stop_event.is_set():
            time.sleep(self.summary_interval)
            with self._lock:
                count = self._unconfirmed_count
                total_sat = self._total_value_sat
                whale_count = self._whale_count
                self._reset_stats()
            if count == 0:
                continue
            total_btc = total_sat / 1e8
            avg_btc = total_btc / count
            price = self._price_usd or 0.0
            event_data = {
                "count": count,
                "total_btc": total_btc,
                "avg_btc": avg_btc,
                "total_usd": total_btc * price,
                "avg_usd": avg_btc * price,
                "whales": whale_count,
                "timestamp": datetime.now().timestamp(),
            }
            if self.callback is not None:
                try:
                    self.callback("summary", event_data)
                except Exception:
                    pass

    # ---------------------- Dynamic configuration ----------------------
    def update_threshold(self, threshold_btc: float) -> None:
        """Update the whale detection threshold (BTC).

        Parameters
        ----------
        threshold_btc: float
            New threshold in BTC.
        """
        with self._lock:
            self.threshold_btc = threshold_btc

    def update_interval(self, summary_interval: int) -> None:
        """Update the summary interval (seconds).

        The new interval will take effect for subsequent cycles of the summary
        loop.

        Parameters
        ----------
        summary_interval: int
            New summary interval in seconds.
        """
        # It is safe to update without a lock because this value is read
        # outside of any lock in the summary loop.  However, we use a lock
        # for consistency.
        with self._lock:
            self.summary_interval = summary_interval

    def update_config(self, threshold_btc: Optional[float] = None, summary_interval: Optional[int] = None) -> None:
        """Update both threshold and summary interval.

        Parameters
        ----------
        threshold_btc: float or None
            If provided, sets the whale detection threshold.
        summary_interval: int or None
            If provided, sets the summary interval in seconds.
        """
        with self._lock:
            if threshold_btc is not None:
                self.threshold_btc = threshold_btc
            if summary_interval is not None:
                self.summary_interval = summary_interval

    def _run_ws(self) -> None:
        """Run the WebSocket client with reconnection logic."""
        while not self._stop_event.is_set():
            try:
                ws = websocket.WebSocketApp(
                    "wss://ws.blockchain.info/inv",
                    on_open=self._on_open,
                    on_message=self._on_message,
                    on_error=lambda ws, err: None,
                    on_close=lambda ws: None,
                )
                # Keep running until error
                ws.run_forever(ping_interval=30, ping_timeout=10)
            except Exception:
                pass
            # Brief pause before reconnecting
            time.sleep(5)

    def start(self) -> None:
        """Start background threads for price, summary and WebSocket."""
        price_thread = threading.Thread(target=self._price_loop, daemon=True)
        summary_thread = threading.Thread(target=self._summary_loop, daemon=True)
        ws_thread = threading.Thread(target=self._run_ws, daemon=True)
        price_thread.start()
        summary_thread.start()
        ws_thread.start()

    def stop(self) -> None:
        """Signal all threads to stop."""
        self._stop_event.set()