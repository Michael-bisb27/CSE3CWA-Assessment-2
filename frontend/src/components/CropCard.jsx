export default function CropCard({ result, onEdit, onDelete, onViewHistory }) {
  const { crop, latest_reading, condition, recommended_water, alerts, action } = result;

  const conditionClasses = {
    'Dry': 'condition-dry',
    'Healthy': 'condition-healthy',
    'Too Wet': 'condition-wet',
    'Sensor Problem': 'condition-problem',
    'Invalid Data': 'condition-invalid',
    'No Data': 'condition-nodata'
  };

  const conditionBadgeClass = conditionClasses[condition] || 'condition-default';

  return (
    <article className="crop-card">
      <div className="card-header">
        <h2 className="crop-title">
          {crop.crop_name} <span className="crop-location">- {crop.location}</span>
        </h2>
        <span className={`condition-badge ${conditionBadgeClass}`}>{condition}</span>
      </div>

      <div className="card-body">
        <div className="card-section">
          <div className="reading-meta">
            <span className="reading-label">Latest:</span>{' '}
            <span className="reading-value">{latest_reading ? latest_reading.timestamp : 'N/A'}</span>
          </div>

          <div className="sensor-metrics">
            <div className="metric">
              <span className="metric-label">Moisture:</span>{' '}
              <span className="metric-value">
                {latest_reading ? `${latest_reading.soil_moisture}%` : 'N/A'}
              </span>
            </div>
            <div className="metric">
              <span className="metric-label">Temperature:</span>{' '}
              <span className="metric-value">
                {latest_reading ? `${latest_reading.temperature} °C` : 'N/A'}
              </span>
            </div>
            <div className="metric">
              <span className="metric-label">Rainfall:</span>{' '}
              <span className="metric-value">
                {latest_reading ? `${latest_reading.rainfall} mm` : 'N/A'}
              </span>
            </div>
            <div className="metric">
              <span className="metric-label">Status:</span>{' '}
              <span className="metric-value">
                {latest_reading ? latest_reading.sensor_status : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        <div className="card-section targets-section">
          <div className="target-item">
            <span className="target-label">Target Range:</span>{' '}
            <span className="target-value">{crop.target_min}% - {crop.target_max}%</span>
          </div>
          <div className="target-item">
            <span className="target-label">Normal Water:</span>{' '}
            <span className="target-value">{crop.normal_water} L</span>
          </div>
        </div>

        <div className="card-section analysis-section">
          <div className="analysis-item">
            <span className="analysis-label">Recommended:</span>{' '}
            <span className="analysis-value">
              {recommended_water === 'N/A' ? 'N/A' : `${recommended_water} L`}
            </span>
          </div>
          <div className="analysis-item">
            <span className="analysis-label">Action:</span>{' '}
            <span className="analysis-value action-value">{action}</span>
          </div>
          {alerts && alerts.length > 0 && (
            <div className="alerts-row">
              <span className="analysis-label">Alerts:</span>
              <div className="alert-tags">
                {alerts.map((alertText, index) => (
                  <span key={index} className="alert-tag">
                    {alertText}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {crop.notes && (
          <div className="card-notes">
            <span className="notes-label">Notes:</span> {crop.notes}
          </div>
        )}
      </div>

      <div className="card-footer">
        <button
          type="button"
          className="btn btn-sm btn-outline"
          onClick={() => onEdit(crop)}
        >
          Edit
        </button>
        <button
          type="button"
          className="btn btn-sm btn-danger"
          onClick={() => onDelete(crop.id, crop.crop_name)}
        >
          Delete
        </button>
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          onClick={() => onViewHistory(crop)}
        >
          View Sensor History
        </button>
      </div>
    </article>
  );
}
