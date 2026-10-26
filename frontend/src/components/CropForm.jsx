import { useState } from 'react';

export default function CropForm({
  mode, // 'create' or 'edit'
  initialData,
  availableCropNames,
  onSave,
  onCancel
}) {
  const isEdit = mode === 'edit';

  const [cropName, setCropName] = useState(
    initialData ? initialData.crop_name : (availableCropNames[0] || '')
  );
  const [location, setLocation] = useState(initialData ? initialData.location : '');
  const [targetMin, setTargetMin] = useState(
    initialData !== undefined && initialData !== null ? initialData.target_min : ''
  );
  const [targetMax, setTargetMax] = useState(
    initialData !== undefined && initialData !== null ? initialData.target_max : ''
  );
  const [normalWater, setNormalWater] = useState(
    initialData !== undefined && initialData !== null ? initialData.normal_water : ''
  );
  const [notes, setNotes] = useState(initialData && initialData.notes ? initialData.notes : '');

  const [clientError, setClientError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate() {
    if (!isEdit) {
      if (!cropName || cropName.trim() === '') {
        return 'Please select a crop name.';
      }
    }

    const trimmedLocation = location.trim();
    if (trimmedLocation.length === 0) {
      return 'Location is required.';
    }
    if (trimmedLocation.length > 100) {
      return 'Location must not exceed 100 characters.';
    }

    if (targetMin === '' || targetMin === null || isNaN(Number(targetMin))) {
      return 'Target min must be a valid number.';
    }
    const minVal = Number(targetMin);
    if (minVal < 0 || minVal > 100) {
      return 'Target min must be between 0 and 100.';
    }

    if (targetMax === '' || targetMax === null || isNaN(Number(targetMax))) {
      return 'Target max must be a valid number.';
    }
    const maxVal = Number(targetMax);
    if (maxVal < 0 || maxVal > 100) {
      return 'Target max must be between 0 and 100.';
    }

    if (minVal >= maxVal) {
      return 'Target min must be strictly less than Target max.';
    }

    if (normalWater === '' || normalWater === null || isNaN(Number(normalWater))) {
      return 'Normal water must be a valid number.';
    }
    const waterVal = Number(normalWater);
    if (waterVal <= 0 || waterVal > 10000) {
      return 'Normal water must be greater than 0 and at most 10000 litres.';
    }

    if (notes && notes.length > 500) {
      return 'Notes must not exceed 500 characters.';
    }

    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setClientError('');

    const validationMsg = validate();
    if (validationMsg) {
      setClientError(validationMsg);
      return;
    }

    const payload = {
      crop_name: cropName,
      location: location.trim(),
      target_min: Number(targetMin),
      target_max: Number(targetMax),
      normal_water: Number(normalWater),
      notes: notes.trim()
    };

    setIsSubmitting(true);
    try {
      await onSave(payload);
    } catch (err) {
      setClientError(err.message || 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-container">
        <div className="modal-header">
          <h2>{isEdit ? `Edit Crop Card: ${cropName}` : 'Add New Crop Card'}</h2>
          <button type="button" className="btn-close" onClick={onCancel} aria-label="Close">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="crop-form">
          {clientError && <div className="form-error">{clientError}</div>}

          <div className="form-group">
            <label htmlFor="crop_name">Crop Name</label>
            {isEdit ? (
              <input
                id="crop_name"
                type="text"
                value={cropName}
                readOnly
                className="input-readonly"
              />
            ) : (
              <select
                id="crop_name"
                value={cropName}
                onChange={e => setCropName(e.target.value)}
                required
              >
                {availableCropNames.map(name => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="location">Location</label>
            <input
              id="location"
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g. Greenhouse A"
              required
              maxLength={100}
            />
          </div>

          <div className="form-row">
            <div className="form-group form-col">
              <label htmlFor="target_min">Target Min (%)</label>
              <input
                id="target_min"
                type="number"
                min="0"
                max="100"
                step="any"
                value={targetMin}
                onChange={e => setTargetMin(e.target.value)}
                required
              />
            </div>
            <div className="form-group form-col">
              <label htmlFor="target_max">Target Max (%)</label>
              <input
                id="target_max"
                type="number"
                min="0"
                max="100"
                step="any"
                value={targetMax}
                onChange={e => setTargetMax(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="normal_water">Normal Water (Litres)</label>
            <input
              id="normal_water"
              type="number"
              min="0.1"
              max="10000"
              step="any"
              value={normalWater}
              onChange={e => setNormalWater(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="notes">Notes (Optional)</label>
            <textarea
              id="notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add optional notes..."
              rows={3}
              maxLength={500}
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-outline"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Crop Card'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
