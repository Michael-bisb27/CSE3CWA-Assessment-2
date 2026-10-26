import { useState, useEffect, useCallback } from 'react';
import TopSummary from './components/TopSummary';
import CropCard from './components/CropCard';
import CropForm from './components/CropForm';
import SensorHistory from './components/SensorHistory';
import {
  getCrops,
  getReadings,
  createCrop,
  updateCrop,
  deleteCrop
} from './services/api';
import {
  getAvailableCropNames,
  getLatestReading,
  analyseCrop,
  calculateFarmStatus
} from './utils/analysis';
import './App.css';

export default function App() {
  const [crops, setCrops] = useState([]);
  const [readings, setReadings] = useState([]);
  const [feedAvailable, setFeedAvailable] = useState(false);
  const [lastRefresh, setLastRefresh] = useState('Never');

  const [loading, setLoading] = useState(true);
  const [cropsError, setCropsError] = useState(null);
  const [refreshError, setRefreshError] = useState(null);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', text: '' }
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modal state: null | { type: 'create' | 'edit' | 'history', card?: object }
  const [modal, setModal] = useState(null);

  function formatCurrentTime() {
    return new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setCropsError(null);
    setRefreshError(null);

    let cropsLoaded = false;
    let fetchedCrops = [];

    // Step 1: Fetch crops
    try {
      fetchedCrops = await getCrops();
      setCrops(fetchedCrops);
      cropsLoaded = true;
    } catch (err) {
      setCropsError(err.message || 'Failed to load crop cards');
      setLoading(false);
      return;
    }

    // Step 2: Fetch sensor readings
    try {
      const fetchedReadings = await getReadings();
      setReadings(fetchedReadings);
      setFeedAvailable(true);
      setLastRefresh(formatCurrentTime());
    } catch {
      // First sensor request fails: keep crops visible, feedAvailable false, lastRefresh Never
      setReadings([]);
      setFeedAvailable(false);
      setLastRefresh('Never');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Refresh sensor data
  async function handleRefresh() {
    setIsRefreshing(true);
    setRefreshError(null);

    try {
      const freshReadings = await getReadings();
      setReadings(freshReadings);
      setFeedAvailable(true);
      setLastRefresh(formatCurrentTime());
    } catch (err) {
      // Later refresh fails: keep last successful readings & results, show error banner
      setRefreshError(err.message || 'Failed to refresh sensor feed');
    } finally {
      setIsRefreshing(false);
    }
  }

  // Refetch crops helper
  async function refetchCrops() {
    const updatedCrops = await getCrops();
    setCrops(updatedCrops);
  }

  // Crop Card Actions
  async function handleCreateCrop(payload) {
    await createCrop(payload);
    await refetchCrops();
    setModal(null);
    setFeedback({ type: 'success', text: `Crop card for ${payload.crop_name} created successfully.` });
    setTimeout(() => setFeedback(null), 4000);
  }

  async function handleUpdateCrop(payload) {
    if (!modal || !modal.card) return;
    await updateCrop(modal.card.id, payload);
    await refetchCrops();
    setModal(null);
    setFeedback({ type: 'success', text: `Crop card for ${modal.card.crop_name} updated successfully.` });
    setTimeout(() => setFeedback(null), 4000);
  }

  async function handleDeleteCrop(id, cropName) {
    const confirmed = window.confirm(`Are you sure you want to delete the crop card for "${cropName}"?`);
    if (!confirmed) return;

    try {
      await deleteCrop(id);
      await refetchCrops();
      setFeedback({ type: 'success', text: `Crop card for ${cropName} deleted successfully.` });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Failed to delete crop card.' });
      setTimeout(() => setFeedback(null), 4000);
    }
  }

  // Compute results on each render (never store analysis results in state or db)
  const dashboardResults = crops.map(card => {
    const latestReading = feedAvailable ? getLatestReading(card.crop_name, readings) : null;
    return analyseCrop(card, latestReading);
  });

  const overallStatus = calculateFarmStatus(dashboardResults, feedAvailable);
  const availableCropNames = getAvailableCropNames(readings, crops);

  // If initial crops request failed, show application error with Retry button
  if (cropsError) {
    return (
      <div className="app-container">
        <header className="top-summary error-header">
          <h1>SmartFarm Crop Dashboard</h1>
        </header>
        <main className="error-screen">
          <div className="error-box">
            <h2>Unable to Connect to Server</h2>
            <p>{cropsError}</p>
            <button type="button" className="btn btn-primary" onClick={loadInitialData}>
              Retry Connection
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-container">
      <TopSummary
        overallStatus={overallStatus}
        cropCount={crops.length}
        lastRefresh={lastRefresh}
        feedAvailable={feedAvailable}
        availableCropCount={availableCropNames.length}
        onAddCrop={() => setModal({ type: 'create' })}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />

      {refreshError && (
        <aside className="banner banner-error" role="alert">
          <div className="banner-content">
            <strong>Refresh Error:</strong> {refreshError} (preserving existing dashboard readings)
          </div>
          <button
            type="button"
            className="btn-banner-close"
            onClick={() => setRefreshError(null)}
            aria-label="Dismiss banner"
          >
            ×
          </button>
        </aside>
      )}

      {feedback && (
        <aside className={`banner banner-${feedback.type}`} role="status">
          <div className="banner-content">{feedback.text}</div>
          <button
            type="button"
            className="btn-banner-close"
            onClick={() => setFeedback(null)}
            aria-label="Dismiss banner"
          >
            ×
          </button>
        </aside>
      )}

      <main className="main-content">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading farm data and sensor readings...</p>
          </div>
        ) : crops.length === 0 ? (
          <section className="empty-state">
            <h2>No Crop Cards Found</h2>
            <p>No crops are currently configured in SQLite. Click "Add Crop Card" above to create one.</p>
            {feedAvailable && availableCropNames.length > 0 && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setModal({ type: 'create' })}
              >
                Add Your First Crop Card
              </button>
            )}
          </section>
        ) : (
          <section className="crop-grid" aria-label="Crop Cards">
            {dashboardResults.map(result => (
              <CropCard
                key={result.crop.id}
                result={result}
                onEdit={crop => setModal({ type: 'edit', card: crop })}
                onDelete={handleDeleteCrop}
                onViewHistory={crop => setModal({ type: 'history', card: crop })}
              />
            ))}
          </section>
        )}
      </main>

      {modal && modal.type === 'create' && (
        <CropForm
          mode="create"
          availableCropNames={availableCropNames}
          onSave={handleCreateCrop}
          onCancel={() => setModal(null)}
        />
      )}

      {modal && modal.type === 'edit' && modal.card && (
        <CropForm
          mode="edit"
          initialData={modal.card}
          availableCropNames={[]}
          onSave={handleUpdateCrop}
          onCancel={() => setModal(null)}
        />
      )}

      {modal && modal.type === 'history' && modal.card && (
        <SensorHistory
          cropCard={modal.card}
          readings={readings}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
