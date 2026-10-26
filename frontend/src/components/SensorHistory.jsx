import { analyseCrop } from '../utils/analysis.js';

export default function SensorHistory({ cropCard, readings, onClose }) {
  // Filter matching readings (exact match) and sort newest first
  const matchingReadings = (readings || [])
    .filter(r => r.crop_name === cropCard.crop_name)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const conditionClasses = {
    'Dry': 'condition-dry',
    'Healthy': 'condition-healthy',
    'Too Wet': 'condition-wet',
    'Sensor Problem': 'condition-problem',
    'Invalid Data': 'condition-invalid',
    'No Data': 'condition-nodata'
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-container modal-large">
        <div className="modal-header">
          <div>
            <h2>Sensor History: {cropCard.crop_name}</h2>
            <p className="modal-subtitle">
              Location: {cropCard.location} | Target: {cropCard.target_min}% - {cropCard.target_max}% | Normal Water: {cropCard.normal_water} L
            </p>
          </div>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="modal-body">
          {matchingReadings.length === 0 ? (
            <p className="empty-history">No sensor readings found for {cropCard.crop_name}.</p>
          ) : (
            <div className="table-responsive">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Moisture</th>
                    <th>Temp</th>
                    <th>Rain</th>
                    <th>Status</th>
                    <th>Condition</th>
                    <th>Rec. Water</th>
                    <th>Alerts & Action</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {matchingReadings.map(reading => {
                    const analysed = analyseCrop(cropCard, reading);
                    const badgeClass = conditionClasses[analysed.condition] || 'condition-default';

                    return (
                      <tr
                        key={reading.timestamp}
                        className={analysed.condition === 'Invalid Data' ? 'row-invalid' : ''}
                      >
                        <td className="timestamp-cell">{reading.timestamp}</td>
                        <td className={reading.soil_moisture < 0 || reading.soil_moisture > 100 ? 'cell-invalid' : ''}>
                          {reading.soil_moisture}%
                        </td>
                        <td className={reading.temperature < 0 || reading.temperature > 50 ? 'cell-invalid' : ''}>
                          {reading.temperature} °C
                        </td>
                        <td className={reading.rainfall < 0 || reading.rainfall > 50 ? 'cell-invalid' : ''}>
                          {reading.rainfall} mm
                        </td>
                        <td>{reading.sensor_status}</td>
                        <td>
                          <span className={`condition-badge ${badgeClass}`}>
                            {analysed.condition}
                          </span>
                        </td>
                        <td>
                          {analysed.recommended_water === 'N/A' ? 'N/A' : `${analysed.recommended_water} L`}
                        </td>
                        <td>
                          <div className="action-text">{analysed.action}</div>
                          {analysed.alerts && analysed.alerts.length > 0 && (
                            <div className="alert-tags">
                              {analysed.alerts.map((alertText, i) => (
                                <span
                                  key={i}
                                  className={`alert-tag ${
                                    alertText.startsWith('Invalid') ? 'alert-tag-invalid' : ''
                                  }`}
                                >
                                  {alertText}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="notes-cell">{reading.notes || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
