// src/components/ActivityMap.js

import React, { useEffect, useRef, useState, useCallback } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import "./ActivityMap.css"

mapboxgl.accessToken = process.env.GATSBY_MAPBOX_ACCESS_TOKEN

const ActivityMap = ({ center, activities }) => {
  const mapContainerRef = useRef(null)
  const map = useRef(null)
  const mapLoaded = useRef(false)
  const scrollTimeout = useRef(null)
  const [visibleActivities, setVisibleActivities] = useState([])
  const [displayCount, setDisplayCount] = useState(30)

  useEffect(() => {
    if (center && !map.current) {
      map.current = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/outdoors-v11",
        center: center,
        zoom: 12,
      })

      // Add zoom and rotation controls to the map.
      map.current.addControl(new mapboxgl.NavigationControl(), "top-right")

      map.current.on("load", () => {
        mapLoaded.current = true
        map.current.resize()
        addActivityLayers()
        updateVisibleActivities()
      })

      map.current.on("moveend", updateVisibleActivities)
    }
  }, [center])

  const addActivityLayers = useCallback(() => {
    if (map.current && activities.length > 0 && mapLoaded.current) {
      activities.forEach((activity, index) => {
        const sourceId = `trail-${index}`
        const layerId = `trail-${index}`

        let color
        if (activity.type === "Trail Run") {
          color = "#FC4C02"
        } else if (activity.type === "Skiing") {
          color = "#0000FF"
        } else {
          color = `#${Math.floor(Math.random() * 16777215)
            .toString(16)
            .padStart(6, "0")}`
        }

        if (!map.current.getSource(sourceId)) {
          map.current.addSource(sourceId, {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: [
                {
                  type: "Feature",
                  geometry: {
                    type: "LineString",
                    coordinates: activity.coordinates,
                  },
                  properties: {
                    name: activity.name,
                    type: activity.type,
                    distance: activity.distance,
                    movingTime: activity.movingTime,
                    elapsedTime: activity.elapsedTime,
                    totalElevationGain: activity.totalElevationGain,
                    city: activity.city,
                    state: activity.state,
                    country: activity.country,
                    date: activity.date,
                  },
                },
              ],
            },
          })
        }

        if (!map.current.getLayer(layerId)) {
          map.current.addLayer({
            id: layerId,
            type: "line",
            source: sourceId,
            layout: {
              "line-join": "round",
              "line-cap": "round",
            },
            paint: {
              "line-color": color,
              "line-width": 4,
            },
          })
        }
      })
    }
  }, [activities])

  const updateVisibleActivities = useCallback(() => {
    if (map.current && mapLoaded.current) {
      const bounds = map.current.getBounds()
      const visible = activities
        .filter(activity => {
          const coordinates = activity.coordinates
          return coordinates.some(coord => {
            const [lng, lat] = coord
            return bounds.contains([lng, lat])
          })
        })
        .sort((a, b) => new Date(b.date) - new Date(a.date))
      setVisibleActivities(visible)
    }
  }, [activities])

  const handleActivityClick = coordinates => {
    if (map.current) {
      const [lng, lat] = coordinates[0]
      map.current.flyTo({ center: [lng, lat], zoom: 15 })
    }
  }

  useEffect(() => {
    addActivityLayers()
  }, [activities, addActivityLayers])

  useEffect(() => {
    if (map.current && center) {
      map.current.flyTo({ center: center, zoom: 15 })
    }
  }, [center])

  useEffect(() => {
    const handleScroll = () => {
      if (map.current) {
        map.current.scrollZoom.disable()
        clearTimeout(scrollTimeout.current)
        scrollTimeout.current = setTimeout(() => {
          map.current.scrollZoom.enable()
        }, 200)
      }
    }

    window.addEventListener("scroll", handleScroll)

    return () => {
      window.removeEventListener("scroll", handleScroll)
      if (map.current) {
        map.current.scrollZoom.enable()
      }
    }
  }, [])

  const loadMoreActivities = () => {
    setDisplayCount(prevCount => prevCount + 30)
  }

  return (
    <div className="map-container" ref={mapContainerRef}>
      <div className="floating-card">
        <h3>Visible Activities</h3>
        <ul>
          {visibleActivities.slice(0, displayCount).map((activity, index) => (
            <li
              key={index}
              className="activity-row"
              onClick={() => handleActivityClick(activity.coordinates)}
            >
              {activity.name} - {new Date(activity.date).toLocaleDateString()}
            </li>
          ))}
        </ul>
        {displayCount < visibleActivities.length && (
          <button onClick={loadMoreActivities}>Load More</button>
        )}
      </div>
    </div>
  )
}

export default ActivityMap
