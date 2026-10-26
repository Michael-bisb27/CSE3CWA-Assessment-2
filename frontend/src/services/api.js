async function request(url, options = {}) {
  const response = await fetch(url, options);
  let data;

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    const message = data && data.error ? data.error : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data;
}

export async function getCrops() {
  return request('/api/crops');
}

export async function getCrop(id) {
  return request(`/api/crops/${id}`);
}

export async function createCrop(cropData) {
  return request('/api/crops', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cropData)
  });
}

export async function updateCrop(id, cropData) {
  return request(`/api/crops/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cropData)
  });
}

export async function deleteCrop(id) {
  return request(`/api/crops/${id}`, {
    method: 'DELETE'
  });
}

export async function getReadings() {
  return request('/api/readings');
}
