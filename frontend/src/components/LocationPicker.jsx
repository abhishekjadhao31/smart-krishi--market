import { useEffect, useMemo, useState } from 'react';
import { reverseLocation, searchLocations } from '../api/logistics.js';

function debounce(fn, delay) {
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export default function LocationPicker({
  label,
  placeholder,
  helperText,
  value,
  onChange,
  onSelect,
  onUseCurrentLocation,
  selectedLocation,
  disabled,
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [error, setError] = useState('');

  const query = value || '';

  const fetchSuggestions = useMemo(
    () => debounce(async (term) => {
      const trimmed = term.trim();
      if (!trimmed) {
        setSuggestions([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const { data } = await searchLocations(trimmed, { limit: 6 });
        setSuggestions(data?.data || data || []);
      } catch (err) {
        setError(err.response?.data?.error || 'Could not search locations');
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 250),
    []
  );

  useEffect(() => {
    fetchSuggestions(query);
    return () => {};
  }, [fetchSuggestions, query]);

  const handleSelect = (item) => {
    onChange?.(item.label || item.displayName || '');
    onSelect?.(item);
    setOpen(false);
    setSuggestions([]);
  };

  const handleCurrentLocation = async () => {
    if (!navigator?.geolocation) {
      setError('Location access is not available in this browser.');
      return;
    }
    setLoading(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          const { data } = await reverseLocation(lat, lon);
          const location = data?.data || data || { label: 'Current location', displayName: 'Current location', latitude: lat, longitude: lon };
          onChange?.(location.label || location.displayName || 'Current location');
          onSelect?.({ ...location, latitude: lat, longitude: lon, source: 'browser' });
          onUseCurrentLocation?.({ ...location, latitude: lat, longitude: lon, source: 'browser' });
        } catch (err) {
          setError(err.response?.data?.error || 'Could not resolve current location');
        } finally {
          setLoading(false);
        }
      },
      () => {
        setLoading(false);
        setError('Please allow location access to use your current location.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="relative">
      <label className="label">{label}</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <input
            className="input pr-10"
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              onChange?.(e.target.value);
              setOpen(true);
            }}
            placeholder={placeholder}
            disabled={disabled}
            autoComplete="off"
          />
          {loading && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">Searching…</span>}
          {open && suggestions.length > 0 && (
            <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-2xl border border-gray-200 bg-white shadow-lg">
              {suggestions.map((item) => (
                <button
                  key={`${item.label}-${item.latitude}-${item.longitude}`}
                  type="button"
                  className="w-full border-b border-gray-100 px-4 py-3 text-left last:border-b-0 hover:bg-krishi-50"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(item)}
                >
                  <div className="font-medium text-krishi-800">{item.label}</div>
                  <div className="text-xs text-gray-500">{item.displayName}</div>
                </button>
              ))}
            </div>
          )}
        </div>
        {onUseCurrentLocation && (
          <button type="button" className="btn-outline whitespace-nowrap" onClick={handleCurrentLocation} disabled={disabled || loading}>
            Use Current Location
          </button>
        )}
      </div>
      {selectedLocation?.displayName && (
        <p className="mt-1 text-xs text-krishi-700">Selected: {selectedLocation.displayName}</p>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {helperText && <p className="mt-1 text-xs text-gray-500">{helperText}</p>}
    </div>
  );
}