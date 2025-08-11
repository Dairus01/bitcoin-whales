# WhaleWatch Web – A Real‑Time Blockchain Dashboard

WhaleWatch Web is a browser‑based interface built on top of the core
WhaleWatch monitoring engine.  It displays live Bitcoin whale
transactions, periodic network summaries and new block notifications in
an easy‑to‑understand dashboard.  The back‑end is written in Python
using Flask and communicates with the front‑end via server‑sent events
(SSE).

## Features

* **Live whale feed:** transaction hash, value in BTC and USD, timestamp and first output address.
* **Periodic summary:** number of transactions observed, total and average volume, whale count for the most recent interval.
* **Block notifications:** shows the height and transaction count whenever a new block is mined.
* **Runs without API keys:** uses the public Blockchain.com WebSocket API and CoinGecko API【825019551221324†L24-L44】【308011754868277†L64-L74】.

## Running the server

1. Ensure you have Python 3.8 or later installed.
2. Install the dependencies:

   ```bash
   python -m pip install -r requirements.txt
   ```

3. (Optional) Adjust the whale threshold or summary interval by setting environment variables before starting the server:

   * `WHALE_THRESHOLD` – minimum transaction value in BTC to be considered a whale (default: 100).
   * `SUMMARY_INTERVAL` – summary interval in seconds (default: 60).

4. Start the server:

   ```bash
   python app.py
   ```

5. Open your browser and navigate to `http://localhost:5000`.  The dashboard will begin updating automatically.

Press **Ctrl +C** in the terminal to stop the server.  All monitoring threads will shut down gracefully.

## Architecture

* The **back‑end** uses the `WhaleWatch` class from `whalewatch_core.py` to stream
  unconfirmed transactions and new blocks from the Blockchain.com WebSocket API【825019551221324†L24-L44】.  It fetches the current BTC ↔︎ USD price from CoinGecko【308011754868277†L64-L74】 and produces events for whales, summaries and blocks.
* A simple **event broadcaster** stores a queue for each connected client.  When an event is produced, it is pushed into all client queues.
* The **/stream** endpoint sends events as server‑sent events (SSE).  The front‑end opens an `EventSource` connection and listens for different event types.
* The **front‑end** is a single HTML page (`templates/index.html`) with a small amount of JavaScript (`static/app.js`) that updates the page whenever an SSE event is received.

## Limitations

* SSE connections are one‑way (server → client).  If you need bidirectional communication or more sophisticated channel management, consider integrating with WebSockets via libraries such as Flask‑SocketIO.
* The server pushes events to all connected clients.  If many clients are connected simultaneously, or if clients are slow to consume events, memory usage may grow due to queued events.

## Screenshots

Below is a conceptual illustration of the WhaleWatch Web dashboard:

![WhaleWatch Web Dashboard Concept]({{file:file-8Dxghq9vuUDeniGyrZgkDn}})

---

This project demonstrates how on‑chain data can be surfaced in real time in a user‑friendly way.  Feel free to extend it to monitor additional chains or to add charts and filters.