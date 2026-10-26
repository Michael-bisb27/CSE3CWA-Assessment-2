export default function TopSummary({
  overallStatus,
  cropCount,
  lastRefresh,
  feedAvailable,
  availableCropCount,
  onAddCrop,
  onRefresh,
  isRefreshing
}) {
  const statusClasses = {
    'No Crops': 'status-no-crops',
    'Sensor Feed Unavailable': 'status-unavailable',
    'Critical': 'status-critical',
    'Watch': 'status-watch',
    'Normal': 'status-normal'
  };

  const badgeClass = statusClasses[overallStatus] || 'status-default';

  return (
    <header className="top-summary">
      <div className="title-section">
        <h1>SmartFarm Crop Dashboard</h1>
        <div className="meta-row">
          <div className="meta-item">
            <span className="meta-label">Overall Status:</span>{' '}
            <span className={`status-badge ${badgeClass}`}>{overallStatus}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Crop Cards:</span>{' '}
            <span className="meta-value">{cropCount}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Last Sensor Refresh:</span>{' '}
            <span className="meta-value">{lastRefresh}</span>
          </div>
        </div>
      </div>

      <div className="actions-section">
        <button
          type="button"
          className="btn btn-primary"
          onClick={onAddCrop}
          disabled={!feedAvailable || availableCropCount === 0}
          title={
            !feedAvailable
              ? 'Sensor feed unavailable'
              : availableCropCount === 0
              ? 'All available crops already have cards'
              : 'Add a new crop card'
          }
        >
          Add Crop Card
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          {isRefreshing ? 'Refreshing...' : 'Refresh Sensor Data'}
        </button>
      </div>
    </header>
  );
}
