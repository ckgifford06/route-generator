import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

const markerRef_start = { current: null }
const markerRef_end = { current: null }

function makeMarkerEl(label, color) {
  const el = document.createElement('div')
  el.style.cssText = `
    width: 32px; height: 32px; border-radius: 50%;
    background: ${color}; border: 3px solid #0f0f0f;
    display: flex; align-items: center; justify-content: center;
    font-family: 'DM Sans', sans-serif; font-size: 11px;
    font-weight: 600; color: #0f0f0f; cursor: default;
    box-shadow: 0 2px 8px rgba(0,0,0,0.5);
  `
  el.textContent = label
  return el
}

export default function Map({ route, userLocation }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const startMarkerRef = useRef(null)
  const endMarkerRef = useRef(null)

  useEffect(() => {
    if (mapRef.current) return

    mapRef.current = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: userLocation || [-71.1685, 42.3356],
      zoom: 13,
    })

    mapRef.current.addControl(new mapboxgl.NavigationControl(), 'bottom-right')
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !route) return

    const draw = () => {
      // Remove existing layers/sources
      if (map.getLayer('route-line')) map.removeLayer('route-line')
      if (map.getLayer('route-line-outline')) map.removeLayer('route-line-outline')
      if (map.getSource('route')) map.removeSource('route')

      // Remove existing markers
      if (startMarkerRef.current) { startMarkerRef.current.remove(); startMarkerRef.current = null }
      if (endMarkerRef.current) { endMarkerRef.current.remove(); endMarkerRef.current = null }

      map.addSource('route', {
        type: 'geojson',
        data: { type: 'Feature', geometry: route },
      })

      map.addLayer({
        id: 'route-line-outline',
        type: 'line',
        source: 'route',
        paint: { 'line-color': '#000000', 'line-width': 6, 'line-opacity': 0.4 },
      })

      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        paint: { 'line-color': '#c8f060', 'line-width': 3.5, 'line-opacity': 0.95 },
      })

      const coords = route.coordinates
      const startCoord = coords[0]
      const endCoord = coords[coords.length - 1]
      const isLoop = Math.abs(startCoord[0] - endCoord[0]) < 0.0005 &&
                     Math.abs(startCoord[1] - endCoord[1]) < 0.0005

      // Start marker — always shown
      startMarkerRef.current = new mapboxgl.Marker({ element: makeMarkerEl('S', '#c8f060') })
        .setLngLat(startCoord)
        .addTo(map)

      // End marker — only show separately for out-and-back
      if (!isLoop) {
        endMarkerRef.current = new mapboxgl.Marker({ element: makeMarkerEl('E', '#ff6b6b') })
          .setLngLat(endCoord)
          .addTo(map)
      }

      const bounds = coords.reduce(
        (b, c) => b.extend(c),
        new mapboxgl.LngLatBounds(coords[0], coords[0])
      )
      map.fitBounds(bounds, { padding: 80, duration: 800 })
    }

    if (map.isStyleLoaded()) {
      draw()
    } else {
      map.once('load', draw)
    }
  }, [route])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100vh' }} />
  )
}