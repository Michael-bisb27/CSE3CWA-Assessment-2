# SmartFarm Crop IoT Dashboard

## Overview
The SmartFarm Crop IoT Dashboard is a full-stack web application designed for farm staff to monitor and manage crop conditions. The application combines user-managed crop configuration cards stored in SQLite with simulated IoT sensor readings read from a static JSON feed. The React frontend matches both data sources using an exact, case-sensitive crop name key, finds the latest reading by timestamp, and evaluates the crop's condition according to an authoritative decision priority table.

## Setup and Running

### Prerequisites
- Node.js (v18 or higher recommended; developed and verified on Node v25)
- npm (v9 or higher)

### 1. Backend Setup
From the `smartfarm/backend` directory:
```bash
cd smartfarm/backend
npm install
npm run dev
```
The backend Express server will start on: **http://localhost:3001**

### 2. Frontend Setup
From the `smartfarm/frontend` directory:
```bash
cd smartfarm/frontend
npm install
npm run dev
```
The Vite development server will start on: **http://localhost:5173**

Vite is configured with a development proxy that forwards all `/api` requests from `http://localhost:5173` to `http://localhost:3001`.

---

## Database

### Schema Creation
The database is managed with `better-sqlite3` and located at `smartfarm/backend/data/smartfarm.db`. When the backend boots, `db.js` executes the authoritative schema from Section 17 of the specification:

```sql
CREATE TABLE IF NOT EXISTS crops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  crop_name TEXT NOT NULL UNIQUE
    CHECK (crop_name IN ('Tomato','Lettuce','Wheat','Maize')),
  location TEXT NOT NULL,
  target_min REAL NOT NULL CHECK (target_min >= 0 AND target_min <= 100),
  target_max REAL NOT NULL CHECK (target_max >= 0 AND target_max <= 100),
  normal_water REAL NOT NULL CHECK (normal_water > 0 AND normal_water <= 10000),
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (target_min < target_max)
);
```

### Seeding
Upon initialization, `db.js` checks if the `crops` table is empty. If there are zero rows, it inserts three seed crop cards:
1. **Tomato**: Greenhouse A (Target: 55% - 75%, Normal Water: 500 L)
2. **Lettuce**: Greenhouse B (Target: 60% - 80%, Normal Water: 400 L)
3. **Wheat**: North Field (Target: 35% - 55%, Normal Water: 300 L)

**Maize is deliberately unseeded** so that testers can immediately test card creation through the user interface. Restarting the backend server does not duplicate rows.

### Resetting the Database
To reset the database back to its initial seeded state during development:
```bash
rm smartfarm/backend/data/smartfarm.db
```
When `npm run dev` restarts the backend, it will automatically recreate the database file and reseed Tomato, Lettuce, and Wheat.

---

## API Routes and Error Format

All error responses from the API consistently use JSON with the shape:
```json
{ "error": "Description of the error" }
```

### Route Summary

| Method | Route | Description | Success Status | Error Codes |
|---|---|---|---|---|
| `GET` | `/api/health` | Service health status check | `200 OK` | - |
| `GET` | `/api/crops` | Returns all crop cards from SQLite | `200 OK` | `500` |
| `GET` | `/api/crops/:id` | Returns one crop card by ID | `200 OK` | `404`, `500` |
| `POST` | `/api/crops` | Creates a new crop card | `201 Created` | `400`, `409`, `500` |
| `PUT` | `/api/crops/:id` | Updates an existing card (crop_name immutable) | `200 OK` | `400`, `404`, `500` |
| `DELETE` | `/api/crops/:id` | Deletes a crop card | `200 OK` | `404`, `500` |
| `GET` | `/api/readings` | Reads, validates, and returns 20 sensor readings | `200 OK` | `500` |

---

## Data Ownership

The application maintains strict boundaries between two independent data sources:
1. **Crop Cards (SQLite `crops` table)**:
   - Owned and managed exclusively by the user via standard Create, Read, Update, and Delete actions.
   - Stores user configuration: `location`, `target_min`, `target_max`, `normal_water`, and optional `notes`.
2. **Simulated Sensor Feed (`backend/data/sensor-readings.json`)**:
   - Read-only simulation of an external IoT feed.
   - Express validates the file structure on every request and returns raw readings only.
   - The backend never creates, updates, or deletes sensor readings.
3. **Dashboard Analysis Results (React State / Rendering)**:
   - Condition, recommended water, alerts, action, and Overall Farm Status are computed on the frontend on each render.
   - Analysis results are never persisted in SQLite or returned by the backend.

---

## `crop_name` Matching

- **Exact Key**: `crop_name` is the sole join key connecting a crop card in SQLite with readings in the sensor feed.
- **Case-Sensitive**: Matching is exact and case-sensitive (e.g., `Tomato` matches `Tomato`, but `Tomato` does not match `tomato`).
- **Testing Verification**:
  - Unit tests in `test-analysis.mjs` verify that `getLatestReading('Tomato', [{ crop_name: 'tomato' }])` returns `null`.
  - In `getAvailableCropNames`, `tomato` does not subtract `Tomato` from the available names list.
  - In the backend, `POST /api/crops` checks if `crop_name` exists in the valid sensor readings feed before accepting creation.

---

## Latest Timestamp Selection

- Sensor readings are not guaranteed to be in chronological order in the JSON file.
- The function `getLatestReading(cropName, readings)` filters all readings where `r.crop_name === cropName` and sorts them using `b.timestamp.localeCompare(a.timestamp)` to pick index `0` (the greatest timestamp).
- Tested and verified: In `sensor-readings.json`, the latest Maize reading (`2026-08-06T09:00:00`) is placed at array index 4 (not the end of the array), and `getLatestReading` reliably selects it.

---

## Dashboard Decision Priority

When evaluating a crop card against its latest sensor reading, `analyseCrop(card, reading)` applies the authoritative decision table from Section 10 in top-to-bottom priority order:

1. **Priority 1 (Sensor Problem)**:
   - Check: `sensor_status` is `Offline` or `Faulty`.
   - Result: Main condition = `Sensor Problem`, Recommended water = `N/A`, Alert = `Check sensor`, Action = `Check sensor`. (Execution stops; moisture values are ignored).
2. **Priority 2 (Invalid Data)**:
   - Check: Online reading with values outside business ranges (moisture outside 0-100, temperature outside 0-50, or rainfall outside 0-50).
   - Result: Main condition = `Invalid Data`, Recommended water = `N/A`, Action = `Check reading`, Alert identifies the invalid field(s). (Execution stops).
3. **Priority 3 (Dry)**:
   - Check: `soil_moisture < target_min`.
   - Result: Main condition = `Dry`, Recommended water = `normal_water`, Action = `Water crop`.
4. **Priority 4 (Healthy)**:
   - Check: `target_min <= soil_moisture <= target_max`.
   - Result: Main condition = `Healthy`, Recommended water = `0 L`, Action = `Monitor`.
5. **Priority 5 (Too Wet)**:
   - Check: `soil_moisture > target_max`.
   - Result: Main condition = `Too Wet`, Recommended water = `0 L`, Action = `Stop watering`.

### Additional Alerts (Online Readings Only)
- **High temperature**: Temperature > 35 °C adds alert `High temperature`.
- **Rain detected**: Rainfall >= 5 mm adds alert `Rain detected`.
- Additional alerts never alter the calculated `recommended_water`.

### Overall Farm Status Order
- **No Crops**: 0 crop cards exist in SQLite.
- **Sensor Feed Unavailable**: 1 or more cards exist, but the sensor feed request has failed.
- **Critical**: Any card has condition `Sensor Problem` or `Invalid Data`.
- **Watch**: Otherwise, any card has condition `Dry`, `Too Wet`, or has alert `High temperature`.
- **Normal**: All other conditions satisfied.

---

## Sensor Data Checks

The sensor dataset at `backend/data/sensor-readings.json` has been validated against all structural requirements using `backend/scripts/check-sensors.js`.

Running `node backend/scripts/check-sensors.js` produces 100% passing results:
```
PASS: JSON parses
PASS: Top level is an array
PASS: Exactly 20 objects
PASS: Five per crop
PASS: Exact field set
PASS: Field types
PASS: Timestamp format and a real calendar date
PASS: Distinct timestamps per crop
PASS: Valid status values
PASS: The four latest cases
PASS: The Wheat invalid reading is not the latest Wheat reading
```

---

## AI Use

used AI as a guide, both Claude and Gemini

---

## Project Limitation

- **Limitation 1: Static File IoT Simulation**: Sensor readings are loaded from a static JSON file on the local filesystem rather than streamed over a live IoT protocol (such as MQTT or WebSockets). In a production agricultural facility, readings would be published dynamically by field sensors.
- **Limitation 2: Fixed Crop Taxonomy**: The system enforces a fixed set of four crop types (`Tomato`, `Lettuce`, `Wheat`, `Maize`) via SQLite `CHECK` constraints and schema validation, preventing farm operators from adding arbitrary new crop species without code and schema modifications.
- **Limitation 3: Single-Node Deployment**: The SQLite database is designed for local single-process usage without multi-user authentication, access controls, or distributed failover.
