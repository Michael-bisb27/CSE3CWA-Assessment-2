export function getAvailableCropNames(readings, crops) {
  if (!Array.isArray(readings)) return [];
  const existingNames = new Set((crops || []).map(c => c.crop_name));
  const available = new Set();

  for (const reading of readings) {
    if (reading && reading.crop_name && !existingNames.has(reading.crop_name)) {
      available.add(reading.crop_name);
    }
  }

  return Array.from(available);
}

export function getLatestReading(cropName, readings) {
  if (!Array.isArray(readings) || !cropName) return null;

  // Filter exact case-sensitive match
  const matches = readings.filter(r => r.crop_name === cropName);
  if (matches.length === 0) return null;

  // Select greatest timestamp
  const sorted = [...matches].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return sorted[0] || null;
}

export function analyseCrop(card, reading) {
  if (!reading) {
    return {
      crop: card,
      latest_reading: null,
      condition: 'No Data',
      recommended_water: 'N/A',
      alerts: ['No sensor data'],
      action: 'N/A'
    };
  }

  // Priority 1: sensor_status Offline or Faulty takes precedence over reading values
  if (reading.sensor_status === 'Offline' || reading.sensor_status === 'Faulty') {
    return {
      crop: card,
      latest_reading: reading,
      condition: 'Sensor Problem',
      recommended_water: 'N/A',
      alerts: ['Check sensor'],
      action: 'Check sensor'
    };
  }

  // Priority 2: Online reading with values outside business ranges
  if (reading.sensor_status === 'Online') {
    const invalidFields = [];
    if (reading.soil_moisture < 0 || reading.soil_moisture > 100) {
      invalidFields.push('Invalid soil_moisture');
    }
    if (reading.temperature < 0 || reading.temperature > 50) {
      invalidFields.push('Invalid temperature');
    }
    if (reading.rainfall < 0 || reading.rainfall > 50) {
      invalidFields.push('Invalid rainfall');
    }

    if (invalidFields.length > 0) {
      return {
        crop: card,
        latest_reading: reading,
        condition: 'Invalid Data',
        recommended_water: 'N/A',
        alerts: invalidFields,
        action: 'Check reading'
      };
    }
  }

  let condition = '';
  let recommended_water = 0;
  let action = '';

  // Priorities 3-5: Moisture condition checked against target range
  if (reading.soil_moisture < card.target_min) {
    condition = 'Dry';
    recommended_water = card.normal_water;
    action = 'Water crop';
  } else if (reading.soil_moisture <= card.target_max) {
    condition = 'Healthy';
    recommended_water = 0;
    action = 'Monitor';
  } else {
    condition = 'Too Wet';
    recommended_water = 0;
    action = 'Stop watering';
  }

  // Additional alerts for Online readings (never affect recommended_water)
  const alerts = [];
  if (reading.sensor_status === 'Online') {
    if (reading.temperature > 35) {
      alerts.push('High temperature');
    }
    if (reading.rainfall >= 5) {
      alerts.push('Rain detected');
    }
  }

  return {
    crop: card,
    latest_reading: reading,
    condition,
    recommended_water,
    alerts,
    action
  };
}

export function calculateFarmStatus(results, feedAvailable) {
  if (!results || results.length === 0) {
    return 'No Crops';
  }

  if (feedAvailable === false) {
    return 'Sensor Feed Unavailable';
  }

  const hasCritical = results.some(r => r.condition === 'Sensor Problem' || r.condition === 'Invalid Data');
  if (hasCritical) {
    return 'Critical';
  }

  const hasWatch = results.some(r =>
    r.condition === 'Dry' ||
    r.condition === 'Too Wet' ||
    (r.alerts && r.alerts.includes('High temperature'))
  );
  if (hasWatch) {
    return 'Watch';
  }

  return 'Normal';
}
