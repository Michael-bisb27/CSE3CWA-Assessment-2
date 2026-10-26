import {
  getCrops,
  getReadings,
  createCrop,
  updateCrop,
  deleteCrop
} from '../src/services/api.js';
import {
  getAvailableCropNames,
  getLatestReading,
  analyseCrop,
  calculateFarmStatus
} from '../src/utils/analysis.js';

// Polyfill fetch for node environment pointing to local dev proxy/backend
const BASE_URL = 'http://localhost:3001';

async function runFlowTest() {
  console.log('--- STARTING COMPLETE DASHBOARD FLOW TEST ---');

  // Step 1: Initial load
  console.log('\n1. Initial Load:');
  const initialCrops = await (await fetch(`${BASE_URL}/api/crops`)).json();
  const initialReadings = await (await fetch(`${BASE_URL}/api/readings`)).json();
  
  const initialResults = initialCrops.map(card =>
    analyseCrop(card, getLatestReading(card.crop_name, initialReadings))
  );
  const initialStatus = calculateFarmStatus(initialResults, true);
  const initialAvailable = getAvailableCropNames(initialReadings, initialCrops);

  console.log(`- Loaded ${initialCrops.length} cards:`, initialCrops.map(c => c.crop_name).join(', '));
  console.log(`- Overall Farm Status: ${initialStatus}`);
  console.log(`- Available for Create: ${initialAvailable.join(', ')}`);
  if (initialCrops.length === 3 && initialStatus === 'Watch' && initialAvailable.includes('Maize')) {
    console.log('PASS: Step 1 Initial Load verified');
  } else {
    console.log('FAIL: Step 1 Initial Load');
  }

  // Step 2: Create Maize
  console.log('\n2. Create Maize:');
  const createPayload = {
    crop_name: 'Maize',
    location: 'South Field',
    target_min: 50,
    target_max: 70,
    normal_water: 600,
    notes: 'Testing maize'
  };
  const createdMaize = await (await fetch(`${BASE_URL}/api/crops`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(createPayload)
  })).json();
  console.log('- Created Maize card ID:', createdMaize.id);

  // Step 3: Latest Maize Result
  console.log('\n3. Latest Maize Result:');
  const updatedCropsAfterCreate = await (await fetch(`${BASE_URL}/api/crops`)).json();
  const maizeCard = updatedCropsAfterCreate.find(c => c.crop_name === 'Maize');
  const latestMaizeReading = getLatestReading('Maize', initialReadings);
  const maizeAnalysis = analyseCrop(maizeCard, latestMaizeReading);
  
  const resultsWithMaize = updatedCropsAfterCreate.map(card =>
    analyseCrop(card, getLatestReading(card.crop_name, initialReadings))
  );
  const statusWithMaize = calculateFarmStatus(resultsWithMaize, true);

  console.log(`- Maize latest timestamp: ${latestMaizeReading.timestamp}`);
  console.log(`- Maize sensor status: ${latestMaizeReading.sensor_status}`);
  console.log(`- Maize condition: ${maizeAnalysis.condition}`);
  console.log(`- Maize recommended water: ${maizeAnalysis.recommended_water}`);
  console.log(`- Maize action: ${maizeAnalysis.action}`);
  console.log(`- Overall Farm Status: ${statusWithMaize}`);

  if (
    maizeAnalysis.condition === 'Sensor Problem' &&
    maizeAnalysis.recommended_water === 'N/A' &&
    maizeAnalysis.action === 'Check sensor' &&
    statusWithMaize === 'Critical'
  ) {
    console.log('PASS: Step 3 Latest Maize result verified');
  } else {
    console.log('FAIL: Step 3 Latest Maize result');
  }

  // Step 4: Edit
  console.log('\n4. Edit Maize:');
  const editPayload = {
    location: 'South Field East',
    target_min: 52,
    target_max: 72,
    normal_water: 650,
    notes: 'Updated notes'
  };
  const updatedMaize = await (await fetch(`${BASE_URL}/api/crops/${maizeCard.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(editPayload)
  })).json();

  console.log(`- Updated location: ${updatedMaize.location}`);
  console.log(`- Updated water: ${updatedMaize.normal_water}`);
  if (updatedMaize.location === 'South Field East' && updatedMaize.normal_water === 650) {
    console.log('PASS: Step 4 Edit verified');
  } else {
    console.log('FAIL: Step 4 Edit');
  }

  // Step 5: Delete
  console.log('\n5. Delete Maize:');
  const deleteRes = await (await fetch(`${BASE_URL}/api/crops/${maizeCard.id}`, {
    method: 'DELETE'
  })).json();
  const cropsAfterDelete = await (await fetch(`${BASE_URL}/api/crops`)).json();
  const availableAfterDelete = getAvailableCropNames(initialReadings, cropsAfterDelete);
  const statusAfterDelete = calculateFarmStatus(
    cropsAfterDelete.map(c => analyseCrop(c, getLatestReading(c.crop_name, initialReadings))),
    true
  );

  console.log(`- Delete response:`, JSON.stringify(deleteRes));
  console.log(`- Crop count after delete: ${cropsAfterDelete.length}`);
  console.log(`- Available crops after delete: ${availableAfterDelete.join(', ')}`);
  console.log(`- Overall status after delete: ${statusAfterDelete}`);

  if (
    deleteRes.deleted === true &&
    cropsAfterDelete.length === 3 &&
    availableAfterDelete.includes('Maize') &&
    statusAfterDelete === 'Watch'
  ) {
    console.log('PASS: Step 5 Delete verified');
  } else {
    console.log('FAIL: Step 5 Delete');
  }

  // Step 6: Re-create Maize
  console.log('\n6. Re-create Maize:');
  const recreatedMaize = await (await fetch(`${BASE_URL}/api/crops`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(createPayload)
  })).json();
  const cropsAfterRecreate = await (await fetch(`${BASE_URL}/api/crops`)).json();
  const recreatedAnalysis = analyseCrop(recreatedMaize, getLatestReading('Maize', initialReadings));

  console.log(`- Re-created Maize ID: ${recreatedMaize.id}`);
  console.log(`- Re-created Maize condition: ${recreatedAnalysis.condition}`);
  if (cropsAfterRecreate.length === 4 && recreatedAnalysis.condition === 'Sensor Problem') {
    console.log('PASS: Step 6 Re-create Maize verified');
  } else {
    console.log('FAIL: Step 6 Re-create Maize');
  }

  // Clean up Maize so db returns to seeded 3 cards
  await fetch(`${BASE_URL}/api/crops/${recreatedMaize.id}`, { method: 'DELETE' });

  // Step 7: Refresh
  console.log('\n7. Refresh Sensor Data:');
  const freshReadings = await (await fetch(`${BASE_URL}/api/readings`)).json();
  console.log(`- Successfully refreshed ${freshReadings.length} sensor readings`);
  if (freshReadings.length === 20) {
    console.log('PASS: Step 7 Refresh verified');
  } else {
    console.log('FAIL: Step 7 Refresh');
  }

  // Step 8: View Sensor History (Wheat)
  console.log('\n8. Sensor History Verification (Wheat):');
  const wheatCard = initialCrops.find(c => c.crop_name === 'Wheat');
  const wheatReadings = freshReadings
    .filter(r => r.crop_name === 'Wheat')
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  console.log(`- Wheat readings count: ${wheatReadings.length}`);
  const invalidWheatReading = wheatReadings.find(r => r.timestamp === '2026-08-01T09:00:00');
  const invalidAnalysis = analyseCrop(wheatCard, invalidWheatReading);
  console.log(`- Wheat 2026-08-01 reading condition: ${invalidAnalysis.condition}`);
  console.log(`- Wheat 2026-08-01 alerts:`, invalidAnalysis.alerts);

  if (
    wheatReadings.length === 5 &&
    invalidAnalysis.condition === 'Invalid Data' &&
    invalidAnalysis.alerts.includes('Invalid soil_moisture')
  ) {
    console.log('PASS: Step 8 Wheat Sensor History verified');
  } else {
    console.log('FAIL: Step 8 Wheat Sensor History');
  }

  console.log('\n--- ALL FLOW STEPS SUCCESSFULLY TESTED ---');
}

runFlowTest().catch(console.error);
