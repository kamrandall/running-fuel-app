# Running Fuel App

A standalone browser app for calculating running fuel, hydration, sodium, sweat rate, gut training progression, and daily macro targets.

## Run locally

1. `cd /Users/kamiler/Documents/RunningFuelApp`
2. `npm start`
3. Open [http://localhost:4173](http://localhost:4173)

You can also open `index.html` directly, but browser geolocation and live weather lookups work best through a local server.

## Included modules

- Core run calculator with weather risk assessment, carbohydrate targets, sodium reconciliation, and fueling timeline
- Sweat-rate field test calculator with personalized fluid replacement guidance
- 12-week gut-training planner with symptom-aware progression
- Daily macro and recovery calculator with heuristic RED-S messaging
- Built-in commercial fuel library plus custom fuel creation stored in local browser storage

## Notes

- Weather uses the free Open-Meteo API from the browser when you tap `Use my weather`.
- WBGT is an approximation derived from temperature and humidity because the app does not yet ingest solar radiation or wind.
- Garmin Connect and Apple Health integrations are described in the UI as future expansion points and are not wired in this first pass.
