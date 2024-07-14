import React, { useEffect, useRef, useState, useCallback } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import "./ActivityMap.css"
import mapboxglSupported from "@mapbox/mapbox-gl-supported"

mapboxgl.accessToken = process.env.GATSBY_MAPBOX_ACCESS_TOKEN

const ActivityMap = ({
  center,
  activities,
  unitSystem,
  toggleUnitSystem,
  setCenter,
}) => {
  const mapContainerRef = useRef(null)
  const map = useRef(null)
  const mapLoaded = useRef(false)
  const scrollTimeout = useRef(null)
  const [visibleActivities, setVisibleActivities] = useState([])
  const [displayCount, setDisplayCount] = useState(30)
  const [openAccordionIndex, setOpenAccordionIndex] = useState(null)
  const originalColors = useRef({})
  const [highlightedFeatureId, setHighlightedFeatureId] = useState(null)

  const generateActivityId = activity => {
    return `${activity.date}-${activity.name.replace(/\s+/g, "-")}`
  }

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

  const addActivityLayer = useCallback(() => {
    if (!mapLoaded.current) return

    const features = activities.map(activity => ({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: activity.coordinates,
      },
      properties: {
        id: generateActivityId(activity),
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
        color: `#${Math.floor(Math.random() * 16777215)
          .toString(16)
          .padStart(6, "0")}`,
      },
    }))

    if (!map.current.getSource("activities")) {
      map.current.addSource("activities", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features,
        },
      })

      map.current.addLayer({
        id: "activities",
        type: "line",
        source: "activities",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": ["get", "color"],
          "line-width": 4,
          "line-opacity": 0.8,
        },
      })

      map.current.addLayer({
        id: "activities-highlighted",
        type: "line",
        source: "activities",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#FC4C02",
          "line-width": 6,
          "line-opacity": 1,
        },
        filter: ["==", "id", ""], // Initially no feature is highlighted
      })

      map.current.on("mousemove", "activities", e => {
        if (e.features.length > 0) {
          const feature = e.features[0]
          setHighlightedFeatureId(feature.properties.id)
          map.current.setFilter("activities-highlighted", [
            "==",
            "id",
            feature.properties.id,
          ])
          map.current.getCanvas().style.cursor = "pointer" // Change cursor to pointer
        }
      })

      map.current.on("mouseleave", "activities", () => {
        setHighlightedFeatureId(null)
        map.current.setFilter("activities-highlighted", ["==", "id", ""])
        map.current.getCanvas().style.cursor = "" // Reset cursor
      })
    } else {
      const source = map.current.getSource("activities")
      source.setData({
        type: "FeatureCollection",
        features,
      })
    }
  }, [activities])

  useEffect(() => {
    if (mapboxglSupported.supported()) {
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

          map.current.addSource("mapbox-hillshade", {
            type: "raster-dem",
            url: "mapbox://mapbox.mapbox-terrain-dem-v1",
            tileSize: 512,
            maxzoom: 14,
          })

          map.current.addLayer({
            id: "hillshading",
            source: "mapbox-hillshade",
            type: "hillshade",
          })

          mapLoaded.current = true
          map.current.resize()
          addActivityLayer()
          updateVisibleActivities()
        })

        // Add zoom and rotation controls to the map.
        map.current.addControl(new mapboxgl.NavigationControl(), "top-right")

        map.current.on("moveend", updateVisibleActivities)
      }
    } else {
      mapContainerRef.current.innerHTML =
        "WebGL is not supported on your browser."
    }
  }, [center, addActivityLayer, updateVisibleActivities])

  const handleActivityClick = coordinates => {
    if (map.current) {
      const [lng, lat] = coordinates
      map.current.flyTo({ center: [lng, lat], zoom: 15 })
    }
  }

  const handleAccordionToggle = index => {
    setOpenAccordionIndex(prevIndex => (prevIndex === index ? null : index))
  }

  const handleRowMouseEnter = activityId => {
    setHighlightedFeatureId(activityId)
    map.current.setFilter("activities-highlighted", ["==", "id", activityId])
  }

  const handleRowMouseLeave = activityId => {
    if (highlightedFeatureId === activityId) {
      setHighlightedFeatureId(null)
      map.current.setFilter("activities-highlighted", ["==", "id", ""])
    }
  }

  useEffect(() => {
    if (mapLoaded.current) {
      addActivityLayer()
    }
  }, [activities, addActivityLayer])

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
                ? parseFloat(activity.totalElevationGain).toFixed(2) + " m"
                : (parseFloat(activity.totalElevationGain) * 3.28084).toFixed(
                    2
                  ) + " ft"

            return (
              <li
                key={activityId}
                className="activity-row"
                onMouseEnter={() => handleRowMouseEnter(activityId)}
                onMouseLeave={() => handleRowMouseLeave(activityId)}
              >
                <div
                  className="activity-header"
                  onClick={() => handleActivityClick(activity.coordinates[0])}
                  role="button"
                  tabIndex={0}
                  onKeyPress={() =>
                    handleActivityClick(activity.coordinates[0])
                  }
                >
                  {activity.name} -{" "}
                  {new Date(activity.date).toLocaleDateString()}
                  <span
                    className="caret"
                    onClick={() => handleAccordionToggle(index)}
                    role="button"
                    tabIndex={0}
                    onKeyPress={() => handleAccordionToggle(index)}
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
