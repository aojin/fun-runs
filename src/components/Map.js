// src/components/StravaMap.js

import React, { useEffect, useState, useMemo, useCallback, useRef } from "react"
import mapboxgl from "mapbox-gl"
import axios from "axios"
import polyline from "@mapbox/polyline"
import "mapbox-gl/dist/mapbox-gl.css" // Import the Mapbox GL CSS
import "./map.css" // Import the CSS for spinner
import { useTable } from "react-table"

// Mapbox access token
mapboxgl.accessToken = process.env.GATSBY_MAPBOX_ACCESS_TOKEN

// Function to fetch location details using Mapbox Geocoding API
const fetchLocationDetails = async (lat, lng) => {
  const mapboxAccessToken = process.env.GATSBY_MAPBOX_ACCESS_TOKEN
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxAccessToken}`
  try {
    const response = await axios.get(url)
    const features = response.data.features

    let city = ""
    let state = ""
    let country = ""

    // Extract city, state, and country from the response
    features.forEach(feature => {
      if (feature.place_type.includes("place")) {
        city = feature.text
      }
      if (feature.place_type.includes("region")) {
        state = feature.text
      }
      if (feature.place_type.includes("country")) {
        country = feature.text
      }
    })

    return { city, state, country }
  } catch (error) {
    console.error("Error fetching location details:", error)
    return { city: "", state: "", country: "" }
  }
}

const StravaMap = () => {
  const [map, setMap] = useState(null)
  const [activities, setActivities] = useState([])
  const [center, setCenter] = useState(null) // Initialize with null to wait for actual coordinates
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true) // Loading state to show spinner
  const [hasMore, setHasMore] = useState(true)
  const [unitSystem, setUnitSystem] = useState("imperial") // Default to imperial
  const mapRef = useRef(null) // Ref to store map instance

  // Function to fetch Strava activities
  const fetchStravaData = async page => {
    const accessToken = localStorage.getItem("strava_access_token")
    if (!accessToken) {
      console.error("No access token found")
      return
    }

    setLoading(true) // Set loading state to true
    const perPage = 30 // Max activities per request

    try {
      const activitiesResponse = await axios.get(
        `https://www.strava.com/api/v3/athlete/activities`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { page, per_page: perPage },
        }
      )

      // Log rate limit headers
      const rateLimitLimit = activitiesResponse.headers["x-ratelimit-limit"]
      const rateLimitUsage = activitiesResponse.headers["x-ratelimit-usage"]
      console.log("Rate limit headers:", { rateLimitLimit, rateLimitUsage })

      const activitiesData = activitiesResponse.data

      // If no more activities, set hasMore to false
      if (activitiesData.length === 0) {
        setHasMore(false)
      } else {
        const activitiesWithCoordinates = await Promise.all(
          activitiesData.map(async activity => {
            const coordinates = activity.map.summary_polyline
              ? polyline
                  .decode(activity.map.summary_polyline)
                  .map(([lat, lng]) => [lng, lat])
              : []
            const startLocation = coordinates[0] || []
            const locationDetails =
              startLocation.length > 0
                ? await fetchLocationDetails(startLocation[1], startLocation[0])
                : { city: "", state: "", country: "" }
            const date = new Date(activity.start_date).toLocaleDateString(
              "en-US"
            )
            return {
              name: activity.name,
              type: activity.type,
              distance: activity.distance,
              movingTime: activity.moving_time,
              elapsedTime: activity.elapsed_time,
              totalElevationGain: activity.total_elevation_gain,
              coordinates,
              startLat: startLocation[1] || "",
              startLng: startLocation[0] || "",
              city: locationDetails.city,
              state: locationDetails.state,
              country: locationDetails.country,
              date: date,
            }
          })
        )

        setActivities(prevActivities => [
          ...prevActivities,
          ...activitiesWithCoordinates,
        ])

        // Set center to the coordinates of the latest activity if this is the first page
        if (page === 1 && activitiesWithCoordinates.length > 0) {
          const latestActivity = activitiesWithCoordinates[0]
          const latestCoordinates = latestActivity.coordinates[0]
          setCenter(latestCoordinates)
        }
      }
    } catch (error) {
      console.error(
        "Error fetching Strava data:",
        error.response ? error.response.data : error.message
      )
    } finally {
      setLoading(false) // Set loading state to false
    }
  }

  // Fetch initial data when component mounts
  useEffect(() => {
    fetchStravaData(1)
  }, [])

  // Initialize map once center coordinates are available
  useEffect(() => {
    if (center) {
      const map = new mapboxgl.Map({
        container: "map",
        style: "mapbox://styles/mapbox/outdoors-v11",
        center: center, // Center map on latest activity's location
        zoom: 12,
      })

      map.on("load", () => {
        setMap(map)
        map.resize()
      })

      mapRef.current = map // Store map instance in ref
    }
  }, [center])

  // Add activity layers to the map
  useEffect(() => {
    if (map && activities.length > 0) {
      activities.forEach((activity, index) => {
        const sourceId = `trail-${index}`
        const layerId = `trail-${index}`

        // Determine color based on activity type
        let color
        if (activity.type === "Trail Run") {
          color = "#FC4C02" // Strava Orange
        } else if (activity.type === "Skiing") {
          color = "#0000FF" // Blue
        } else {
          color = `#${Math.floor(Math.random() * 16777215)
            .toString(16)
            .padStart(6, "0")}` // Random color
        }

        // Add source and layer for each activity
        if (!map.getSource(sourceId)) {
          map.addSource(sourceId, {
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
                  },
                },
              ],
            },
          })
        }

        if (!map.getLayer(layerId)) {
          map.addLayer({
            id: layerId,
            type: "line",
            source: sourceId,
            layout: {
              "line-join": "round",
              "line-cap": "round",
            },
            paint: {
              "line-color": color, // Set color based on activity type
              "line-width": 4,
            },
          })
        }
      })
    }
  }, [map, activities])

  // Function to load more activities
  const loadMoreActivities = () => {
    if (!loading && hasMore) {
      setPage(prevPage => {
        const nextPage = prevPage + 1
        fetchStravaData(nextPage)
        return nextPage
      })
    }
  }

  // Function to jump to an activity on the map and smooth scroll to map
  const jumpToActivity = useCallback((lat, lng) => {
    if (mapRef.current) {
      mapRef.current.flyTo({ center: [lng, lat], zoom: 15 })
      mapRef.current
        .getContainer()
        .scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [])

  // Function to toggle between metric and imperial units
  const toggleUnitSystem = () => {
    setUnitSystem(prevUnitSystem =>
      prevUnitSystem === "metric" ? "imperial" : "metric"
    )
  }

  // Define table columns
  const columns = useMemo(
    () => [
      {
        Header: "Date",
        accessor: "date",
      },
      {
        Header: "Name",
        accessor: "name",
      },
      {
        Header: "Type",
        accessor: "type",
      },
      {
        Header: `Distance (${unitSystem === "metric" ? "km" : "mi"})`,
        accessor: activity =>
          unitSystem === "metric"
            ? (activity.distance / 1000).toFixed(2)
            : (activity.distance / 1609.34).toFixed(2),
      },
      {
        Header: `Moving Time (${unitSystem === "metric" ? "min" : "min"})`,
        accessor: activity => (activity.movingTime / 60).toFixed(2),
      },
      {
        Header: `Elapsed Time (${unitSystem === "metric" ? "min" : "min"})`,
        accessor: activity => (activity.elapsedTime / 60).toFixed(2),
      },
      {
        Header: `Total Elevation Gain (${
          unitSystem === "metric" ? "m" : "ft"
        })`,
        accessor: activity =>
          unitSystem === "metric"
            ? activity.totalElevationGain.toFixed(2)
            : (activity.totalElevationGain * 3.28084).toFixed(2),
      },
      {
        Header: "City",
        accessor: "city",
      },
      {
        Header: "State/Province",
        accessor: "state",
      },
      {
        Header: "Country",
        accessor: "country",
      },
      {
        Header: "Latitude",
        accessor: "startLat",
      },
      {
        Header: "Longitude",
        accessor: "startLng",
      },
      {
        Header: "Actions",
        Cell: ({ row }) => (
          <button
            onClick={() =>
              jumpToActivity(row.original.startLat, row.original.startLng)
            }
          >
            Jump to Activity
          </button>
        ),
      },
    ],
    [unitSystem, jumpToActivity]
  )

  // Memoize table data
  const data = useMemo(() => activities, [activities])

  // React Table setup
  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } =
    useTable({ columns, data })

  return (
    <div>
      {loading && (
        <div className="loading-container">
          <div className="spinner"></div>
        </div>
      )}
      <div style={{ width: "100%", height: "500px" }} id="map"></div>
      <button onClick={toggleUnitSystem} style={{ margin: "10px" }}>
        Toggle to {unitSystem === "metric" ? "Imperial" : "Metric"}
      </button>
      {hasMore && !loading && (
        <button onClick={loadMoreActivities} style={{ margin: "10px" }}>
          Load More
        </button>
      )}
      {loading && <p>Loading...</p>}
      {!loading && activities.length > 0 && (
        <table
          {...getTableProps()}
          style={{
            width: "100%",
            marginTop: "20px",
            borderCollapse: "collapse",
          }}
        >
          <thead>
            {headerGroups.map(headerGroup => (
              <tr {...headerGroup.getHeaderGroupProps()}>
                {headerGroup.headers.map(column => (
                  <th
                    {...column.getHeaderProps()}
                    style={{ border: "1px solid black", padding: "8px" }}
                  >
                    {column.render("Header")}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody {...getTableBodyProps()}>
            {rows.map(row => {
              prepareRow(row)
              return (
                <tr {...row.getRowProps()}>
                  {row.cells.map(cell => (
                    <td
                      {...cell.getCellProps()}
                      style={{ border: "1px solid black", padding: "8px" }}
                    >
                      {cell.render("Cell")}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default StravaMap
