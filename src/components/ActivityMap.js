// src/components/ActivityMap.js

import React, { useEffect, useRef, useState, useCallback } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import "./ActivityMap.css"

mapboxgl.accessToken = process.env.GATSBY_MAPBOX_ACCESS_TOKEN

const ActivityMap = ({ center, activities, unitSystem, toggleUnitSystem }) => {
  const mapContainerRef = useRef(null)
  const map = useRef(null)
  const mapLoaded = useRef(false)
  const scrollTimeout = useRef(null)
  const [visibleActivities, setVisibleActivities] = useState([])
  const [displayCount, setDisplayCount] = useState(30)
  const [openAccordionIndex, setOpenAccordionIndex] = useState(null)
  const originalColors = useRef({})
  const [hoveredActivityId, setHoveredActivityId] = useState(null)
  const [highlightedLayerId, setHighlightedLayerId] = useState(null)

  useEffect(() => {
    if (center && !map.current) {
      map.current = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/aojin91/clxuz1mxm00sl01obcdlk5hg4",
        center: center,
        zoom: 12,
        pitch: 75, // Set the initial pitch to 75 degrees
      })

      // Enable 3D terrain
      map.current.on("load", () => {
        map.current.addSource("mapbox-dem", {
          type: "raster-dem",
          url: "mapbox://mapbox.mapbox-terrain-dem-v1",
          tileSize: 512,
          maxzoom: 14,
        })
        map.current.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 })

        map.current.addLayer({
          id: "hillshading",
          source: "mapbox-dem",
          type: "hillshade",
        })

        mapLoaded.current = true
        map.current.resize()
        addActivityLayers()
        updateVisibleActivities()
      })

      // Add zoom and rotation controls to the map.
      map.current.addControl(new mapboxgl.NavigationControl(), "top-right")

      map.current.on("moveend", updateVisibleActivities)
    }
  }, [center])

  const generateActivityId = activity => {
    return `${activity.date}-${activity.name.replace(/\s+/g, "-")}`
  }

  const addActivityLayers = useCallback(() => {
    if (map.current && activities.length > 0 && mapLoaded.current) {
      activities.forEach((activity, index) => {
        const activityId = generateActivityId(activity)
        const sourceId = `trail-${activityId}`
        const layerId = `trail-${activityId}`

        const color = `#${Math.floor(Math.random() * 16777215)
          .toString(16)
          .padStart(6, "0")}`

        // Store the original color
        originalColors.current[layerId] = color

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
                    id: activityId,
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
          // console.log(`Source added: ${sourceId}`)
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
          // console.log(`Layer added: ${layerId}`)
        }

        // Event listener for mouse enter
        map.current.on("mouseenter", layerId, () => {
          if (highlightedLayerId) {
            const previousOriginalColor =
              originalColors.current[highlightedLayerId]
            map.current.setPaintProperty(
              highlightedLayerId,
              "line-color",
              previousOriginalColor
            )
            map.current.setPaintProperty(highlightedLayerId, "line-width", 4)
          }

          setHighlightedLayerId(layerId)
          setHoveredActivityId(activityId)
          map.current.setPaintProperty(layerId, "line-color", "#FC4C02") // Strava orange
          map.current.setPaintProperty(layerId, "line-width", 6)
          map.current.getCanvas().style.cursor = "pointer"
        })

        // Event listener for mouse leave
        map.current.on("mouseleave", layerId, () => {
          setHoveredActivityId(null)
          const originalColor = originalColors.current[layerId]
          map.current.setPaintProperty(layerId, "line-color", originalColor)
          map.current.setPaintProperty(layerId, "line-width", 4)
          map.current.getCanvas().style.cursor = ""
        })
      })
    }
  }, [activities, highlightedLayerId])

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

      // Check for duplicates in the visible activities
      const uniqueVisibleActivities = visible.reduce((acc, current) => {
        const x = acc.find(item => item.id === current.id)
        if (!x) {
          return acc.concat([current])
        } else {
          return acc
        }
      }, [])

      setVisibleActivities(uniqueVisibleActivities)
    }
  }, [activities])

  const handleActivityClick = coordinates => {
    if (map.current) {
      const [lng, lat] = coordinates[0]
      console.log({ lng }, { lat })
      map.current.flyTo({ center: [lng, lat], zoom: 15 })
    }
  }

  const handleAccordionToggle = index => {
    setOpenAccordionIndex(prevIndex => (prevIndex === index ? null : index))
  }

  const handleRowMouseEnter = activityId => {
    if (highlightedLayerId) {
      const previousOriginalColor = originalColors.current[highlightedLayerId]
      map.current.setPaintProperty(
        highlightedLayerId,
        "line-color",
        previousOriginalColor
      )
      map.current.setPaintProperty(highlightedLayerId, "line-width", 4)
    }

    setHoveredActivityId(activityId)
    const layerId = `trail-${activityId}`
    setHighlightedLayerId(layerId)
    if (map.current.getLayer(layerId)) {
      map.current.setPaintProperty(layerId, "line-color", "#FC4C02") // Strava orange
      map.current.setPaintProperty(layerId, "line-width", 6)
    }
  }

  const handleRowMouseLeave = activityId => {
    setHoveredActivityId(null)
    const layerId = `trail-${activityId}`
    if (map.current.getLayer(layerId)) {
      const originalColor = originalColors.current[layerId]
      map.current.setPaintProperty(layerId, "line-color", originalColor)
      map.current.setPaintProperty(layerId, "line-width", 4)
    }
  }

  useEffect(() => {
    if (mapLoaded.current) {
      addActivityLayers()
    }
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
        <h3>Visible Activities ({visibleActivities.length})</h3>
        <ul>
          {visibleActivities.slice(0, displayCount).map((activity, index) => {
            const activityId = generateActivityId(activity)
            const distance =
              unitSystem === "metric"
                ? (activity.distance / 1000).toFixed(2) + " km"
                : (activity.distance / 1609.34).toFixed(2) + " mi"
            const elevationGain =
              unitSystem === "metric"
                ? activity.totalElevationGain.toFixed(2) + " m"
                : (activity.totalElevationGain * 3.28084).toFixed(2) + " ft"

            return (
              <li
                key={activityId}
                className="activity-row"
                onMouseEnter={() => handleRowMouseEnter(activityId)}
                onMouseLeave={() => handleRowMouseLeave(activityId)}
              >
                <div className="activity-header">
                  <span
                    onClick={() => handleActivityClick(activity.coordinates)}
                  >
                    {activity.name} -{" "}
                    {new Date(activity.date).toLocaleDateString()}
                  </span>
                  <span
                    className="caret"
                    onClick={() => handleAccordionToggle(index)}
                  >
                    {openAccordionIndex === index ? "▼" : "►"}
                  </span>
                </div>
                {openAccordionIndex === index && (
                  <div className="activity-details">
                    <ul>
                      <li>Type: {activity.type}</li>
                      <li>Distance: {distance}</li>
                      <li>
                        Moving Time: {(activity.movingTime / 60).toFixed(2)}{" "}
                        mins
                      </li>
                      <li>
                        Elapsed Time: {(activity.elapsedTime / 60).toFixed(2)}{" "}
                        mins
                      </li>
                      <li>Elevation Gain: {elevationGain}</li>
                      <li>City: {activity.city}</li>
                      <li>State: {activity.state}</li>
                      <li>Country: {activity.country}</li>
                      <li>
                        Date: {new Date(activity.date).toLocaleDateString()}
                      </li>
                    </ul>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
        {displayCount < visibleActivities.length && (
          <button onClick={loadMoreActivities}>Load More</button>
        )}
      </div>
    </div>
  )
}

export default ActivityMap
