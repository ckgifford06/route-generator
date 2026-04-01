import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import Map from './Map'
import StatsPanel from './StatsPanel'
import ElevationChart from './ElevationChart'
import styles from './App.module.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

export default function App() {
  const [query, setQuery] = useState('')
  const [locationInput, setLocationInput] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [location, setLocation] = useState(null)
  const [locationLabel, setLocationLabel] = useState('')
  const [route, setRoute] = useState(null)
  const [routeData, setRouteData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const debounceRef = useRef(null)

  // Try GPS on mount
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocationLabel('Current location')
      },
      () => {} // silently fail — user can type instead
    )
  }, [])

  // Geocode as user types
  const handleLocationInput = (e) => {
    const val = e.target.value
    setLocationInput(val)
    setLocationLabel('')
    setSuggestions([])

    if (!val.trim() || val.length < 3) return

    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await axios.get(
          `https://api.mapbox.com/search/geocode/v6/forward`,
          { params: { q: val, access_token: MAPBOX_TOKEN, limit: 4, types: 'place,address,neighborhood' } }
        )
        setSuggestions(res.data.features || [])
      } catch {
        setSuggestions([])
      }
    }, 300)
  }

  const handleSelectSuggestion = (feature) => {
    const [lng, lat] = feature.geometry.coordinates
    setLocation({ lat, lng })
    setLocationLabel(feature.properties.full_address || feature.properties.name)
    setLocationInput(feature.properties.full_address || feature.properties.name)
    setSuggestions([])
  }

  const handleGenerate = async (e) => {
    e.preventDefault()
    if (!query.trim() || loading) return
    if (!location) { setError('Please enter a location first.'); return }

    setLoading(true)
    setError(null)
    setSuggestions([])

    try {
      const { data } = await axios.post(`${API_URL}/routes/generate`, {
        query,
        latitude: location.lat,
        longitude: location.lng,
      })
      setRoute(data.geojson)
      setRouteData(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadGpx = () => {
    if (!routeData?.gpx) return
    const blob = new Blob([routeData.gpx], { type: 'application/gpx+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'route.gpx'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={styles.app}>
      <div className={styles.mapContainer}>
        <Map route={route} userLocation={location ? [location.lng, location.lat] : null} />
      </div>
      <div className={styles.overlay}>
        <div className={styles.header}>
          <div className={styles.logo}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="11" cy="3" r="1.5" fill="currentColor"/>
              <path d="M7 6.5l2-2 2 2.5 1.5-1L14 7.5M6 9l1-2.5M6 9l-1.5 4.5M6 9l4 1.5-1 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>routeflow</span>
          </div>
        </div>

        <div className={styles.searchContainer}>
          {/* Location input */}
          <div className={styles.locationWrapper}>
            <div className={styles.locationForm}>
              <PinIcon />
              <input
                className={styles.locationInput}
                type="text"
                value={locationInput}
                onChange={handleLocationInput}
                onFocus={() => locationLabel && setLocationInput(locationLabel)}
                placeholder={locationLabel || 'Enter a location...'}
              />
              {locationLabel && locationInput === locationLabel && (
                <span className={styles.locationConfirmed}>✓</span>
              )}
            </div>
            {suggestions.length > 0 && (
              <div className={styles.suggestions}>
                {suggestions.map((f) => (
                  <button
                    key={f.id}
                    className={styles.suggestion}
                    onClick={() => handleSelectSuggestion(f)}
                    type="button"
                  >
                    <span className={styles.suggestionName}>{f.properties.name}</span>
                    <span className={styles.suggestionContext}>{f.properties.place_formatted}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Route query input */}
          <form className={styles.searchForm} onSubmit={handleGenerate}>
            <input
              className={styles.input}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="3 mile flat loop..."
              disabled={loading}
              autoFocus
            />
            <button
              className={`${styles.button} ${loading ? styles.buttonLoading : ''}`}
              type="submit"
              disabled={loading || !query.trim()}
            >
              {loading ? (
                <svg className={styles.spinner} width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3"/>
                  <path d="M8 2a6 6 0 016 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              ) : 'Generate'}
            </button>
          </form>

          {error && <div className={styles.error}>{error}</div>}

          {!route && !loading && (
            <div className={styles.hints}>
              <span>Try:</span>
              {['5k with hills', '10 mile trail run', 'flat 2 mile loop'].map((hint) => (
                <button key={hint} className={styles.hint} onClick={() => setQuery(hint)}>
                  {hint}
                </button>
              ))}
            </div>
          )}
        </div>

        {routeData && (
          <div className={styles.statsContainer}>
            <ElevationChart profile={routeData.elevation_profile} />
            <StatsPanel data={routeData} onDownloadGpx={handleDownloadGpx} />
          </div>
        )}
      </div>
    </div>
  )
}

function PinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="7" cy="6" r="2" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M7 1a5 5 0 015 5c0 3-5 8-5 8S2 9 2 6a5 5 0 015-5z" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  )
}