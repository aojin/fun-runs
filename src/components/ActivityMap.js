// src/components/ActivityMap.js

import React, { useEffect, useRef, useState } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import "./ActivityMap.css"

mapboxgl.accessToken = process.env.GATSBY_MAPBOX_ACCESS_TOKEN

const ActivityMap = ({ center, activities }) => {
  const mapContainerRef = useRef(null)
  const map = useRef(null)
  const mapLoaded = useRef(false)
  const modalRef = useRef(null)
  const scrollTimeout = useRef(null)

  const [modalContent, setModalContent] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [isMetric, setIsMetric] = useState(false)
  const [selectedTrailId, setSelectedTrailId] = useState(null)
  const [selectedTrailData, setSelectedTrailData] = useState(null)

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
      })
    }
  }, [center])

  const addActivityLayers = () => {
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
              "line-width": selectedTrailId === layerId ? 8 : 4,
            },
          })

          map.current.on("mouseenter", layerId, e => {
            if (e.features.length > 0) {
              const feature = e.features[0]
              const properties = feature.properties

              setModalContent(
                <div className="modal-content">
                  <h3>{properties.name}</h3>
                  <p>
                    <strong>Type:</strong> {properties.type}
                  </p>
                  <p>
                    <strong>Distance:</strong>{" "}
                    {isMetric
                      ? (properties.distance / 1000).toFixed(2) + " km"
                      : (properties.distance * 0.000621371).toFixed(2) +
                        " miles"}
                  </p>
                  <p>
                    <strong>Moving Time:</strong>{" "}
                    {isMetric
                      ? (properties.movingTime / 60).toFixed(2) + " min"
                      : ((properties.movingTime / 60) * 0.621371).toFixed(2) +
                        " min"}
                  </p>
                  <p>
                    <strong>Elapsed Time:</strong>{" "}
                    {isMetric
                      ? (properties.elapsedTime / 60).toFixed(2) + " min"
                      : ((properties.elapsedTime / 60) * 0.621371).toFixed(2) +
                        " min"}
                  </p>
                  <p>
                    <strong>Total Elevation Gain:</strong>{" "}
                    {properties.totalElevationGain} meters
                  </p>
                  <p>
                    <strong>Location:</strong> {properties.city},{" "}
                    {properties.state}, {properties.country}
                  </p>
                  <p>
                    <strong>Date:</strong> {properties.date}
                  </p>
                  <div className="toggle-container">
                    <label>
                      <input
                        type="radio"
                        value="metric"
                        checked={isMetric}
                        onChange={() => setIsMetric(true)}
                      />{" "}
                      Metric
                    </label>
                    <label>
                      <input
                        type="radio"
                        value="imperial"
                        checked={!isMetric}
                        onChange={() => setIsMetric(false)}
                      />{" "}
                      Imperial
                    </label>
                  </div>
                </div>
              )
              setShowModal(true)

              if (selectedTrailId !== layerId) {
                if (selectedTrailId) {
                  map.current.setPaintProperty(selectedTrailId, "line-width", 4)
                  map.current.setPaintProperty(
                    selectedTrailId,
                    "line-color",
                    selectedTrailData.type === "Trail Run"
                      ? "#FC4C02"
                      : selectedTrailData.type === "Skiing"
                      ? "#0000FF"
                      : `#${Math.floor(Math.random() * 16777215)
                          .toString(16)
                          .padStart(6, "0")}`
                  )
                }

                setSelectedTrailId(layerId)
                setSelectedTrailData(properties)
                map.current.setPaintProperty(layerId, "line-width", 8)
                map.current.setPaintProperty(layerId, "line-color", "#FC4C02")
              }
            }
          })

          map.current.on("mouseleave", layerId, () => {})
        }
      })
    }
  }

  useEffect(() => {
    addActivityLayers()
  }, [activities])

  useEffect(() => {
    if (map.current && center) {
      map.current.flyTo({ center: center, zoom: 15 })
    }
  }, [center])

  const closeModal = () => {
    setShowModal(false)
    if (selectedTrailId) {
      map.current.setPaintProperty(selectedTrailId, "line-width", 4)
      map.current.setPaintProperty(
        selectedTrailId,
        "line-color",
        selectedTrailData.type === "Trail Run"
          ? "#FC4C02"
          : selectedTrailData.type === "Skiing"
          ? "#0000FF"
          : `#${Math.floor(Math.random() * 16777215)
              .toString(16)
              .padStart(6, "0")}`
      )
      setSelectedTrailId(null)
    }
  }

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

  return (
    <div className="map-container" ref={mapContainerRef}>
      {showModal && (
        <div ref={modalRef} className="modal">
          <button className="close-button" onClick={closeModal}>
            Close
          </button>
          {modalContent}
        </div>
      )}
    </div>
  )
}

export default ActivityMap
