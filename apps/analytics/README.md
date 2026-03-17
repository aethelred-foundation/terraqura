# TerraQura Analytics

Analytics and machine learning service for the TerraQura carbon credit platform on the Aethelred sovereign EVM blockchain.

## Features

- **Carbon Price Prediction** -- Linear regression and random forest models for forecasting credit prices in AETH.
- **Sensor Anomaly Detection** -- Isolation forest model to flag anomalous DAC unit readings (CO2 capture rate, energy consumption, flow rate).
- **Environmental Impact Calculator** -- EPA-equivalent impact metrics (trees planted, cars removed, homes powered, flights offset).
- **Risk Assessment** -- Credit quality scoring, counterparty risk evaluation, and Value-at-Risk (VaR) calculation.
- **Protocol Analytics** -- Aggregate statistics, leaderboards, and time-series data.

## Quick Start

```bash
# Install dependencies
pip install -e ".[dev]"

# Run the API server
python -m terraqura_analytics.main

# Run tests
pytest --cov=terraqura_analytics
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |
| POST | /predict/price | Carbon price prediction |
| POST | /detect/anomalies | Sensor anomaly detection |
| POST | /impact | Environmental impact calculation |
| GET | /stats/protocol | Protocol-level statistics |
| GET | /stats/leaderboard | Leaderboard by metric |
| POST | /risk/assess | Credit risk assessment |
| POST | /risk/var | Value at Risk calculation |
