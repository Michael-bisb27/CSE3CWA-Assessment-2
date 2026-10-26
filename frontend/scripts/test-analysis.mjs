import {
  getAvailableCropNames,
  getLatestReading,
  analyseCrop,
  calculateFarmStatus
} from '../src/utils/analysis.js';

const sampleCard = {
  id: 1,
  crop_name: 'Tomato',
  location: 'Greenhouse A',
  target_min: 50,
  target_max: 70,
  normal_water: 500,
  notes: ''
};

// 1. moisture exactly equal to target_min and target_max is Healthy
const atMinReading = {
  crop_name: 'Tomato',
  timestamp: '2026-08-05T09:00:00',
  soil_moisture: 50,
  temperature: 25,
  rainfall: 0,
  sensor_status: 'Online',
  notes: ''
};
const atMaxReading = {
  crop_name: 'Tomato',
  timestamp: '2026-08-05T09:00:00',
  soil_moisture: 70,
  temperature: 25,
  rainfall: 0,
  sensor_status: 'Online',
  notes: ''
};

const minResult = analyseCrop(sampleCard, atMinReading);
const maxResult = analyseCrop(sampleCard, atMaxReading);

if (minResult.condition === 'Healthy' && maxResult.condition === 'Healthy') {
  console.log('PASS: moisture exactly equal to target_min and target_max is Healthy');
} else {
  console.log('FAIL: moisture exactly equal to target_min and target_max is Healthy');
}

// 2. moisture 120 Online is Invalid Data
const invalidOnlineReading = {
  crop_name: 'Tomato',
  timestamp: '2026-08-05T09:00:00',
  soil_moisture: 120,
  temperature: 25,
  rainfall: 0,
  sensor_status: 'Online',
  notes: ''
};

const invalidResult = analyseCrop(sampleCard, invalidOnlineReading);

if (
  invalidResult.condition === 'Invalid Data' &&
  invalidResult.recommended_water === 'N/A' &&
  invalidResult.action === 'Check reading' &&
  invalidResult.alerts.includes('Invalid soil_moisture')
) {
  console.log('PASS: moisture 120 Online is Invalid Data');
} else {
  console.log('FAIL: moisture 120 Online is Invalid Data');
}

// 3. Faulty with moisture 120 is Sensor Problem, not Invalid Data
const faultyReading = {
  crop_name: 'Tomato',
  timestamp: '2026-08-05T09:00:00',
  soil_moisture: 120,
  temperature: 25,
  rainfall: 0,
  sensor_status: 'Faulty',
  notes: ''
};

const faultyResult = analyseCrop(sampleCard, faultyReading);

if (
  faultyResult.condition === 'Sensor Problem' &&
  faultyResult.recommended_water === 'N/A' &&
  faultyResult.action === 'Check sensor'
) {
  console.log('PASS: Faulty with moisture 120 is Sensor Problem, not Invalid Data');
} else {
  console.log('FAIL: Faulty with moisture 120 is Sensor Problem, not Invalid Data');
}

// 4. temperature exactly 35 gives no High temperature alert; 36 does
const temp35Reading = {
  crop_name: 'Tomato',
  timestamp: '2026-08-05T09:00:00',
  soil_moisture: 60,
  temperature: 35,
  rainfall: 0,
  sensor_status: 'Online',
  notes: ''
};
const temp36Reading = {
  crop_name: 'Tomato',
  timestamp: '2026-08-05T09:00:00',
  soil_moisture: 60,
  temperature: 36,
  rainfall: 0,
  sensor_status: 'Online',
  notes: ''
};

const res35 = analyseCrop(sampleCard, temp35Reading);
const res36 = analyseCrop(sampleCard, temp36Reading);

if (!res35.alerts.includes('High temperature') && res36.alerts.includes('High temperature')) {
  console.log('PASS: temperature exactly 35 gives no High temperature alert; 36 does');
} else {
  console.log('FAIL: temperature exactly 35 gives no High temperature alert; 36 does');
}

// 5. rainfall exactly 5 gives Rain detected; 4.9 does not
const rain5Reading = {
  crop_name: 'Tomato',
  timestamp: '2026-08-05T09:00:00',
  soil_moisture: 60,
  temperature: 25,
  rainfall: 5,
  sensor_status: 'Online',
  notes: ''
};
const rain49Reading = {
  crop_name: 'Tomato',
  timestamp: '2026-08-05T09:00:00',
  soil_moisture: 60,
  temperature: 25,
  rainfall: 4.9,
  sensor_status: 'Online',
  notes: ''
};

const res5 = analyseCrop(sampleCard, rain5Reading);
const res49 = analyseCrop(sampleCard, rain49Reading);

if (res5.alerts.includes('Rain detected') && !res49.alerts.includes('Rain detected')) {
  console.log('PASS: rainfall exactly 5 gives Rain detected; 4.9 does not');
} else {
  console.log('FAIL: rainfall exactly 5 gives Rain detected; 4.9 does not');
}

// 6. latest reading chosen correctly from a mixed-order array
const mixedReadings = [
  { crop_name: 'Maize', timestamp: '2026-08-04T10:00:00', soil_moisture: 60 },
  { crop_name: 'Maize', timestamp: '2026-08-06T10:00:00', soil_moisture: 58 },
  { crop_name: 'Maize', timestamp: '2026-08-02T10:00:00', soil_moisture: 65 }
];

const latestMaize = getLatestReading('Maize', mixedReadings);

if (latestMaize && latestMaize.timestamp === '2026-08-06T10:00:00') {
  console.log('PASS: latest reading chosen correctly from a mixed-order array');
} else {
  console.log('FAIL: latest reading chosen correctly from a mixed-order array');
}

// 7. "tomato" does not match "Tomato"
const lowercaseReading = [{ crop_name: 'tomato', timestamp: '2026-08-05T09:00:00' }];
const matchResult = getLatestReading('Tomato', lowercaseReading);

const availableNames = getAvailableCropNames(
  [{ crop_name: 'Tomato' }],
  [{ crop_name: 'tomato' }]
);

if (matchResult === null && availableNames.includes('Tomato')) {
  console.log('PASS: "tomato" does not match "Tomato"');
} else {
  console.log('FAIL: "tomato" does not match "Tomato"');
}

// 8. Overall status for empty cards, feed failure, Critical, Watch, Normal
const statusEmpty = calculateFarmStatus([], true);
const statusFeedFail = calculateFarmStatus([{ condition: 'Healthy' }], false);
const statusCriticalProb = calculateFarmStatus([{ condition: 'Sensor Problem' }], true);
const statusCriticalInv = calculateFarmStatus([{ condition: 'Invalid Data' }], true);
const statusWatchDry = calculateFarmStatus([{ condition: 'Dry' }], true);
const statusWatchWet = calculateFarmStatus([{ condition: 'Too Wet' }], true);
const statusWatchHighTemp = calculateFarmStatus([{ condition: 'Healthy', alerts: ['High temperature'] }], true);
const statusNormal = calculateFarmStatus([{ condition: 'Healthy', alerts: [] }], true);

if (
  statusEmpty === 'No Crops' &&
  statusFeedFail === 'Sensor Feed Unavailable' &&
  statusCriticalProb === 'Critical' &&
  statusCriticalInv === 'Critical' &&
  statusWatchDry === 'Watch' &&
  statusWatchWet === 'Watch' &&
  statusWatchHighTemp === 'Watch' &&
  statusNormal === 'Normal'
) {
  console.log('PASS: Overall status for empty cards, feed failure, Critical, Watch, Normal');
} else {
  console.log('FAIL: Overall status for empty cards, feed failure, Critical, Watch, Normal');
}
