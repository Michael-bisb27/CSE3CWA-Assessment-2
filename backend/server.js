const express = require('express');
const fs = require('fs');
const path = require('path');
const {
  getAllCrops,
  getCropById,
  getCropByName,
  createCrop,
  updateCrop,
  deleteCrop
} = require('./db');

const app = express();
const PORT = 3001;
const sensorFilePath = path.join(__dirname, 'data/sensor-readings.json');

app.use(express.json());

function isValidCalendarDateTime(ts) {
  if (typeof ts !== 'string') return false;
  const match = ts.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);

  if (month < 1 || month > 12) return false;
  if (hour < 0 || hour > 23) return false;
  if (minute < 0 || minute > 59) return false;
  if (second < 0 || second > 59) return false;

  const d = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day &&
    d.getUTCHours() === hour &&
    d.getUTCMinutes() === minute &&
    d.getUTCSeconds() === second
  );
}

function validateSensorData(data) {
  if (!Array.isArray(data)) {
    throw new Error('Top-level value is not an array');
  }
  if (data.length !== 20) {
    throw new Error('Sensor array does not contain exactly 20 readings');
  }

  const allowedCrops = ['Tomato', 'Lettuce', 'Wheat', 'Maize'];
  const cropCounts = { Tomato: 0, Lettuce: 0, Wheat: 0, Maize: 0 };
  const allowedStatuses = ['Online', 'Offline', 'Faulty'];
  const requiredKeys = ['crop_name', 'timestamp', 'soil_moisture', 'temperature', 'rainfall', 'sensor_status', 'notes'];

  for (const item of data) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new Error('Reading must be an object');
    }

    const keys = Object.keys(item);
    if (keys.length !== requiredKeys.length) {
      throw new Error('Reading contains incorrect number of fields');
    }
    for (const key of requiredKeys) {
      if (!(key in item)) {
        throw new Error(`Missing required field: ${key}`);
      }
    }

    if (cropCounts[item.crop_name] === undefined) {
      throw new Error(`Invalid crop name: ${item.crop_name}`);
    }
    cropCounts[item.crop_name] += 1;

    if (typeof item.timestamp !== 'string' || !isValidCalendarDateTime(item.timestamp)) {
      throw new Error(`Invalid timestamp: ${item.timestamp}`);
    }

    if (typeof item.soil_moisture !== 'number' || Number.isNaN(item.soil_moisture)) {
      throw new Error('soil_moisture must be a valid number');
    }
    if (typeof item.temperature !== 'number' || Number.isNaN(item.temperature)) {
      throw new Error('temperature must be a valid number');
    }
    if (typeof item.rainfall !== 'number' || Number.isNaN(item.rainfall)) {
      throw new Error('rainfall must be a valid number');
    }
    if (typeof item.sensor_status !== 'string' || !allowedStatuses.includes(item.sensor_status)) {
      throw new Error(`Invalid sensor_status: ${item.sensor_status}`);
    }
    if (typeof item.notes !== 'string') {
      throw new Error('notes must be a string');
    }
  }

  for (const crop of allowedCrops) {
    if (cropCounts[crop] !== 5) {
      throw new Error(`Crop ${crop} does not have exactly 5 readings`);
    }
    const cropTimestamps = data.filter(item => item.crop_name === crop).map(item => item.timestamp);
    if (new Set(cropTimestamps).size !== 5) {
      throw new Error(`Crop ${crop} has duplicate timestamps`);
    }
  }
}

function readAndValidateSensorFeed() {
  const raw = fs.readFileSync(sensorFilePath, 'utf8');
  const data = JSON.parse(raw);
  validateSensorData(data);
  return data;
}

function validateCropFields(body) {
  if (body.location === undefined || body.location === null || typeof body.location !== 'string') {
    return 'location is required';
  }
  const trimmedLocation = body.location.trim();
  if (trimmedLocation.length === 0 || trimmedLocation.length > 100) {
    return 'location must be between 1 and 100 characters';
  }

  if (body.target_min === undefined || body.target_min === null) {
    return 'target_min is required';
  }
  if (typeof body.target_min !== 'number' || Number.isNaN(body.target_min)) {
    return 'target_min must be a number';
  }
  if (body.target_min < 0 || body.target_min > 100) {
    return 'target_min must be between 0 and 100';
  }

  if (body.target_max === undefined || body.target_max === null) {
    return 'target_max is required';
  }
  if (typeof body.target_max !== 'number' || Number.isNaN(body.target_max)) {
    return 'target_max must be a number';
  }
  if (body.target_max < 0 || body.target_max > 100) {
    return 'target_max must be between 0 and 100';
  }

  if (body.target_min >= body.target_max) {
    return 'target_min must be less than target_max';
  }

  if (body.normal_water === undefined || body.normal_water === null) {
    return 'normal_water is required';
  }
  if (typeof body.normal_water !== 'number' || Number.isNaN(body.normal_water)) {
    return 'normal_water must be a number';
  }
  if (body.normal_water <= 0 || body.normal_water > 10000) {
    return 'normal_water must be greater than 0 and at most 10000';
  }

  if (body.notes !== undefined && body.notes !== null) {
    if (typeof body.notes !== 'string') {
      return 'notes must be a string';
    }
    if (body.notes.length > 500) {
      return 'notes must not exceed 500 characters';
    }
  }

  return null;
}

function validateCropCreate(body) {
  if (body.crop_name === undefined || body.crop_name === null || typeof body.crop_name !== 'string' || body.crop_name.trim() === '') {
    return 'crop_name is required';
  }
  return validateCropFields(body);
}

function validateCropUpdate(body) {
  return validateCropFields(body);
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// GET /api/readings - read, validate, and return raw sensor readings
app.get('/api/readings', (req, res) => {
  try {
    const data = readAndValidateSensorFeed();
    res.json(data);
  } catch {
    res.status(500).json({ error: 'Sensor data file is invalid' });
  }
});

// GET /api/crops - list all crop cards
app.get('/api/crops', (req, res) => {
  try {
    const crops = getAllCrops();
    res.json(crops);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/crops/:id - get one crop card
app.get('/api/crops/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(404).json({ error: 'Crop card not found' });
  }

  try {
    const crop = getCropById(id);
    if (!crop) {
      return res.status(404).json({ error: 'Crop card not found' });
    }
    res.json(crop);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/crops - create a new crop card
app.post('/api/crops', (req, res) => {
  // Step 1: Check fields first
  const fieldError = validateCropCreate(req.body);
  if (fieldError) {
    return res.status(400).json({ error: fieldError });
  }

  // Step 2: Check crop_name exists in the valid sensor feed
  let sensorData;
  try {
    sensorData = readAndValidateSensorFeed();
  } catch {
    return res.status(500).json({ error: 'Sensor data file is invalid' });
  }

  const cropFoundInSensors = sensorData.some(r => r.crop_name === req.body.crop_name);
  if (!cropFoundInSensors) {
    return res.status(400).json({ error: 'crop_name does not exist in sensor data' });
  }

  // Step 3: Check for duplicates in SQLite
  try {
    const existing = getCropByName(req.body.crop_name);
    if (existing) {
      return res.status(409).json({ error: 'crop_name already exists' });
    }

    const created = createCrop({
      crop_name: req.body.crop_name,
      location: req.body.location.trim(),
      target_min: req.body.target_min,
      target_max: req.body.target_max,
      normal_water: req.body.normal_water,
      notes: req.body.notes ? req.body.notes : ''
    });

    res.status(201).json(created);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/crops/:id - update an existing crop card
app.put('/api/crops/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(404).json({ error: 'Crop card not found' });
  }

  try {
    const existing = getCropById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Crop card not found' });
    }

    // Reject attempt to change crop_name; accept missing or unchanged
    if (req.body.crop_name !== undefined && req.body.crop_name !== existing.crop_name) {
      return res.status(400).json({ error: 'crop_name cannot be changed' });
    }

    const fieldError = validateCropUpdate(req.body);
    if (fieldError) {
      return res.status(400).json({ error: fieldError });
    }

    const updated = updateCrop(id, {
      location: req.body.location.trim(),
      target_min: req.body.target_min,
      target_max: req.body.target_max,
      normal_water: req.body.normal_water,
      notes: req.body.notes ? req.body.notes : ''
    });

    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/crops/:id - delete a crop card
app.delete('/api/crops/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(404).json({ error: 'Crop card not found' });
  }

  try {
    const existing = getCropById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Crop card not found' });
    }

    deleteCrop(id);
    res.json({ deleted: true, id: id });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error middleware for malformed JSON request bodies
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  return res.status(500).json({ error: 'Internal server error' });
});

// Catch-all 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
