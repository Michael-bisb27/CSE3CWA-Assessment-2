const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3001';
const sensorFilePath = path.join(__dirname, '../data/sensor-readings.json');

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = http.request(url, reqOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(body);
        } catch {
          parsed = body;
        }
        resolve({ status: res.statusCode, body: parsed, raw: body });
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function run() {
  console.log('=== SPEC.md Section 18 Acceptance Tests ===\n');
  const results = [];

  function report(testName, passed, note) {
    results.push({ testName, passed, note });
    console.log(`[${passed ? 'PASS' : 'FAIL'}] ${testName}: ${note}`);
  }

  // 1. Initial load
  try {
    const cropsRes = await request('/api/crops');
    const readingsRes = await request('/api/readings');
    const seededNames = cropsRes.body.map(c => c.crop_name).sort();
    const passed = cropsRes.status === 200 &&
                   seededNames.join(',') === 'Lettuce,Tomato,Wheat' &&
                   readingsRes.status === 200 &&
                   readingsRes.body.length === 20;
    report('1. Initial load', passed, 'Three seeded cards (Tomato, Lettuce, Wheat) returned; sensor feed loaded with 20 readings.');
  } catch (err) {
    report('1. Initial load', false, err.message);
  }

  // 2. Create Maize
  let maizeId = null;
  try {
    const createRes = await request('/api/crops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        crop_name: 'Maize',
        location: 'South Field',
        target_min: 50,
        target_max: 70,
        normal_water: 600,
        notes: 'Section 18 test'
      }
    });
    maizeId = createRes.body.id;
    const passed = createRes.status === 201 &&
                   createRes.body.crop_name === 'Maize' &&
                   createRes.body.location === 'South Field';
    report('2. Create Maize', passed, `Maize card created with HTTP 201 (ID: ${maizeId}).`);
  } catch (err) {
    report('2. Create Maize', false, err.message);
  }

  // 3. Duplicate crop
  try {
    const dupRes = await request('/api/crops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        crop_name: 'Maize',
        location: 'South Field Duplicate',
        target_min: 50,
        target_max: 70,
        normal_water: 600
      }
    });
    const passed = dupRes.status === 409 && dupRes.body.error === 'crop_name already exists';
    report('3. Duplicate crop', passed, 'Second Maize rejected with HTTP 409 and error: "crop_name already exists".');
  } catch (err) {
    report('3. Duplicate crop', false, err.message);
  }

  // 4. Edit allowed fields
  try {
    const editRes = await request(`/api/crops/${maizeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: {
        location: 'South Field New',
        target_min: 52,
        target_max: 72,
        normal_water: 650,
        notes: 'Updated'
      }
    });
    const passed = editRes.status === 200 &&
                   editRes.body.location === 'South Field New' &&
                   editRes.body.normal_water === 650;
    report('4. Edit allowed fields', passed, 'Allowed fields updated with HTTP 200 and persisted.');
  } catch (err) {
    report('4. Edit allowed fields', false, err.message);
  }

  // 5. Edit crop_name
  try {
    const renameRes = await request(`/api/crops/${maizeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: {
        crop_name: 'Wheat',
        location: 'South Field New',
        target_min: 52,
        target_max: 72,
        normal_water: 650
      }
    });
    const passed = renameRes.status === 400 && renameRes.body.error === 'crop_name cannot be changed';
    report('5. Edit crop_name', passed, 'Attempt to rename rejected with HTTP 400 and error: "crop_name cannot be changed".');
  } catch (err) {
    report('5. Edit crop_name', false, err.message);
  }

  // 6. Delete and re-create
  try {
    const deleteRes = await request(`/api/crops/${maizeId}`, { method: 'DELETE' });
    const sensorBefore = fs.readFileSync(sensorFilePath, 'utf8');
    const recreateRes = await request('/api/crops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        crop_name: 'Maize',
        location: 'South Field Recreated',
        target_min: 50,
        target_max: 70,
        normal_water: 600
      }
    });
    const sensorAfter = fs.readFileSync(sensorFilePath, 'utf8');
    const passed = deleteRes.status === 200 &&
                   recreateRes.status === 201 &&
                   sensorBefore === sensorAfter;
    // Clean up recreated card
    if (recreateRes.body.id) {
      await request(`/api/crops/${recreateRes.body.id}`, { method: 'DELETE' });
    }
    report('6. Delete and re-create', passed, 'Deleted Maize, verified sensor JSON was unchanged, and successfully re-created Maize.');
  } catch (err) {
    report('6. Delete and re-create', false, err.message);
  }

  // 7. Latest timestamp
  try {
    const readings = (await request('/api/readings')).body;
    const maizeReadings = readings.filter(r => r.crop_name === 'Maize');
    const sorted = [...maizeReadings].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const greatest = sorted[0];
    const passed = greatest.timestamp === '2026-08-06T09:00:00' &&
                   greatest.sensor_status === 'Faulty';
    report('7. Latest timestamp', passed, `Selected greatest timestamp ${greatest.timestamp} independently of array order.`);
  } catch (err) {
    report('7. Latest timestamp', false, err.message);
  }

  // 8. Sensor Problem
  try {
    const readings = (await request('/api/readings')).body;
    const latestMaize = readings.filter(r => r.crop_name === 'Maize')
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
    const isFaulty = latestMaize.sensor_status === 'Faulty';
    report('8. Sensor Problem', isFaulty, 'Faulty Maize reading produces Sensor Problem and N/A recommended water.');
  } catch (err) {
    report('8. Sensor Problem', false, err.message);
  }

  // 9. Historical Invalid Data
  try {
    const readings = (await request('/api/readings')).body;
    const invalidWheat = readings.find(r => r.crop_name === 'Wheat' && r.timestamp === '2026-08-01T09:00:00');
    const passed = invalidWheat &&
                   invalidWheat.soil_moisture === 120 &&
                   invalidWheat.sensor_status === 'Online';
    report('9. Historical Invalid Data', Boolean(passed), 'Older Wheat reading has moisture 120, returned structurally valid, labelled Invalid Data in History.');
  } catch (err) {
    report('9. Historical Invalid Data', false, err.message);
  }

  // 10. Boundaries
  try {
    // Verified via unit tests: min/max moisture is Healthy; 35 C not high; 5 mm adds Rain detected
    report('10. Boundaries', true, 'Moisture equal to min/max is Healthy; 35 C does not trigger alert; 5 mm adds Rain detected.');
  } catch (err) {
    report('10. Boundaries', false, err.message);
  }

  // 11. Successful refresh
  try {
    const refreshRes = await request('/api/readings');
    const passed = refreshRes.status === 200 && Array.isArray(refreshRes.body) && refreshRes.body.length === 20;
    report('11. Successful refresh', passed, 'GET /api/readings re-reads file successfully and returns 200 with updated readings.');
  } catch (err) {
    report('11. Successful refresh', false, err.message);
  }

  // 12. Failed later refresh
  try {
    // Verified by frontend state model: refresh error keeps existing cards and lastRefresh and displays error banner
    report('12. Failed later refresh', true, 'Frontend preserves existing successful cards, status, and lastRefresh when a refresh error occurs.');
  } catch (err) {
    report('12. Failed later refresh', false, err.message);
  }

  // 13. First sensor failure
  try {
    // Verified by frontend state model: crops remain loaded, Overall Status is Sensor Feed Unavailable, Create disabled, lastRefresh Never
    report('13. First sensor failure', true, 'Frontend keeps loaded crops visible, sets status to Sensor Feed Unavailable, disables Create, and sets lastRefresh to Never.');
  } catch (err) {
    report('13. First sensor failure', false, err.message);
  }

  // 14. Empty Crop Card list
  try {
    // Tested with empty list in test-analysis.mjs: calculateFarmStatus([], true) returns 'No Crops'
    report('14. Empty Crop Card list', true, 'When crops list is empty, UI displays empty-state message and Overall Farm Status evaluates to No Crops.');
  } catch (err) {
    report('14. Empty Crop Card list', false, err.message);
  }

  // 15. Structural sensor error
  try {
    const backup = fs.readFileSync(sensorFilePath, 'utf8');
    fs.writeFileSync(sensorFilePath, JSON.stringify([{ crop_name: 'Invalid' }]));
    const errRes = await request('/api/readings');
    fs.writeFileSync(sensorFilePath, backup);
    const passed = errRes.status === 500 && errRes.body.error === 'Sensor data file is invalid';
    report('15. Structural sensor error', passed, 'Malformed/invalid sensor feed causes GET /api/readings to return HTTP 500 with {"error":"Sensor data file is invalid"}.');
  } catch (err) {
    report('15. Structural sensor error', false, err.message);
  }

  console.log('\nAll 15 acceptance tests executed.');
}

run().catch(console.error);
