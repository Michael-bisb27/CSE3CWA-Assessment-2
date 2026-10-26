const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../data/sensor-readings.json');

let rawContent = '';
let data = null;
let parseSuccess = false;

// 1. JSON parses
try {
  rawContent = fs.readFileSync(filePath, 'utf8');
  data = JSON.parse(rawContent);
  parseSuccess = true;
  console.log('PASS: JSON parses');
} catch (err) {
  console.log('FAIL: JSON parses - ' + err.message);
  process.exit(1);
}

// 2. Top level is an array
if (Array.isArray(data)) {
  console.log('PASS: Top level is an array');
} else {
  console.log('FAIL: Top level is an array');
  process.exit(1);
}

// 3. Exactly 20 objects
if (data.length === 20 && data.every(item => typeof item === 'object' && item !== null && !Array.isArray(item))) {
  console.log('PASS: Exactly 20 objects');
} else {
  console.log('FAIL: Exactly 20 objects (found ' + data.length + ')');
}

// 4. Five per crop
const crops = ['Tomato', 'Lettuce', 'Wheat', 'Maize'];
const cropCounts = { Tomato: 0, Lettuce: 0, Wheat: 0, Maize: 0 };
let unknownCrops = false;

for (const item of data) {
  if (cropCounts[item.crop_name] !== undefined) {
    cropCounts[item.crop_name] += 1;
  } else {
    unknownCrops = true;
  }
}

const fivePerCrop = !unknownCrops && crops.every(c => cropCounts[c] === 5);
if (fivePerCrop) {
  console.log('PASS: Five per crop');
} else {
  console.log('FAIL: Five per crop - counts: ' + JSON.stringify(cropCounts));
}

// 5. Exact field set
const requiredFields = ['crop_name', 'timestamp', 'soil_moisture', 'temperature', 'rainfall', 'sensor_status', 'notes'];
let exactFieldSet = true;

for (const item of data) {
  const keys = Object.keys(item);
  if (keys.length !== requiredFields.length) {
    exactFieldSet = false;
    break;
  }
  for (const field of requiredFields) {
    if (!(field in item)) {
      exactFieldSet = false;
      break;
    }
  }
}

if (exactFieldSet) {
  console.log('PASS: Exact field set');
} else {
  console.log('FAIL: Exact field set');
}

// 6. Field types
let fieldTypesValid = true;

for (const item of data) {
  if (
    typeof item.crop_name !== 'string' ||
    typeof item.timestamp !== 'string' ||
    typeof item.soil_moisture !== 'number' || Number.isNaN(item.soil_moisture) ||
    typeof item.temperature !== 'number' || Number.isNaN(item.temperature) ||
    typeof item.rainfall !== 'number' || Number.isNaN(item.rainfall) ||
    typeof item.sensor_status !== 'string' ||
    typeof item.notes !== 'string'
  ) {
    fieldTypesValid = false;
    break;
  }
}

if (fieldTypesValid) {
  console.log('PASS: Field types');
} else {
  console.log('FAIL: Field types');
}

// 7. Timestamp format and a real calendar date (reject 2026-02-30)
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

let allTimestampsValid = true;
for (const item of data) {
  if (!isValidCalendarDateTime(item.timestamp)) {
    allTimestampsValid = false;
    break;
  }
}

if (allTimestampsValid) {
  console.log('PASS: Timestamp format and a real calendar date');
} else {
  console.log('FAIL: Timestamp format and a real calendar date');
}

// 8. Distinct timestamps per crop
let distinctTimestamps = true;

for (const crop of crops) {
  const cropReadings = data.filter(item => item.crop_name === crop);
  const timestamps = cropReadings.map(item => item.timestamp);
  const uniqueTimestamps = new Set(timestamps);
  if (uniqueTimestamps.size !== cropReadings.length) {
    distinctTimestamps = false;
    break;
  }
}

if (distinctTimestamps) {
  console.log('PASS: Distinct timestamps per crop');
} else {
  console.log('FAIL: Distinct timestamps per crop');
}

// 9. Valid status values
const allowedStatuses = ['Online', 'Offline', 'Faulty'];
let validStatuses = true;

for (const item of data) {
  if (!allowedStatuses.includes(item.sensor_status)) {
    validStatuses = false;
    break;
  }
}

if (validStatuses) {
  console.log('PASS: Valid status values');
} else {
  console.log('FAIL: Valid status values');
}

// 10. The four latest cases above
function getLatestReading(cropName) {
  const matches = data.filter(item => item.crop_name === cropName);
  matches.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return matches[0] || null;
}

const latestTomato = getLatestReading('Tomato');
const latestLettuce = getLatestReading('Lettuce');
const latestWheat = getLatestReading('Wheat');
const latestMaize = getLatestReading('Maize');

let latestCasesValid = true;

if (
  !latestTomato ||
  latestTomato.sensor_status !== 'Online' ||
  latestTomato.soil_moisture !== 42 ||
  latestTomato.temperature !== 38 ||
  latestTomato.rainfall !== 0 ||
  latestTomato.notes !== 'Dry and hot'
) {
  latestCasesValid = false;
}

if (
  !latestLettuce ||
  latestLettuce.sensor_status !== 'Online' ||
  latestLettuce.soil_moisture !== 70 ||
  latestLettuce.temperature !== 24 ||
  latestLettuce.rainfall !== 0
) {
  latestCasesValid = false;
}

if (
  !latestWheat ||
  latestWheat.sensor_status !== 'Online' ||
  latestWheat.soil_moisture !== 62 ||
  latestWheat.temperature !== 26 ||
  latestWheat.rainfall !== 8
) {
  latestCasesValid = false;
}

if (
  !latestMaize ||
  latestMaize.sensor_status !== 'Faulty' ||
  latestMaize.soil_moisture !== 58 ||
  latestMaize.temperature !== 27 ||
  latestMaize.rainfall !== 0 ||
  latestMaize.notes !== 'Sensor requires inspection'
) {
  latestCasesValid = false;
}

if (latestCasesValid) {
  console.log('PASS: The four latest cases');
} else {
  console.log('FAIL: The four latest cases');
}

// 11. The Wheat invalid reading is not the latest Wheat reading
const invalidWheat = data.find(item =>
  item.crop_name === 'Wheat' &&
  item.timestamp === '2026-08-01T09:00:00' &&
  item.soil_moisture === 120 &&
  item.sensor_status === 'Online' &&
  item.notes === 'Intentional invalid test'
);

let wheatInvalidCheckPassed = false;
if (invalidWheat && latestWheat && invalidWheat.timestamp < latestWheat.timestamp) {
  wheatInvalidCheckPassed = true;
}

if (wheatInvalidCheckPassed) {
  console.log('PASS: The Wheat invalid reading is not the latest Wheat reading');
} else {
  console.log('FAIL: The Wheat invalid reading is not the latest Wheat reading');
}
