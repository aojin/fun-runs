// src/components/ActivityDashboard.js

import React, { useEffect, useState, useCallback, useRef } from "react"
import axios from "axios"
import polyline from "@mapbox/polyline"
import ActivityMap from "./ActivityMap"
import ActivityTable from "./ActivityTable"
import "./ActivityDashboard.css"

const fetchLocationDetails = async (lat, lng) => {
  const mapboxAccessToken = process.env.GATSBY_MAPBOX_ACCESS_TOKEN
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxAccessToken}`
  try {
    const response = await axios.get(url)
    const features = response.data.features

    let city = ""
    let state = ""
    let country = ""

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

const ActivityDashboard = ({ accessToken }) => {
  const [activities, setActivities] = useState([])
  const [center, setCenter] = useState(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [unitSystem, setUnitSystem] = useState("imperial")
  const mapContainerRef = useRef(null)

  const fetchStravaData = async page => {
    setLoading(true)
    const perPage = 30

    try {
      const activitiesResponse = await axios.get(
        `https://www.strava.com/api/v3/athlete/activities`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { page, per_page: perPage },
        }
      )

      // const rateLimitLimit = activitiesResponse.headers["x-ratelimit-limit"]
      // const rateLimitUsage = activitiesResponse.headers["x-ratelimit-usage"]
      // console.log("Rate limit headers:", { rateLimitLimit, rateLimitUsage })

      const activitiesData = activitiesResponse.data

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
              id: activity.id, // Ensure there's a unique identifier
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

        setActivities(prevActivities => {
          const newActivities = activitiesWithCoordinates.filter(
            newActivity => {
              return !prevActivities.some(
                activity => activity.id === newActivity.id
              )
            }
          )

          return [...prevActivities, ...newActivities]
        })

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
      setLoading(false)
    }
  }

  const loadMoreActivities = () => {
    if (!loading && hasMore) {
      setPage(prevPage => {
        const nextPage = prevPage + 1
        fetchStravaData(nextPage)
        return nextPage
      })
    }
  }

  const jumpToActivity = useCallback(coordinates => {
    setCenter(coordinates)
    mapContainerRef.current.scrollIntoView({ behavior: "smooth" })
  }, [])

  const toggleUnitSystem = () => {
    setUnitSystem(prevUnitSystem =>
      prevUnitSystem === "metric" ? "imperial" : "metric"
    )
  }

  useEffect(() => {
    if (accessToken) {
      fetchStravaData(1)
    }
  }, [accessToken])

  return (
    <div>
      {loading && (
        <div className="loading-container">
          <div className="spinner"></div>
        </div>
      )}
      {!loading && (
        <>
          <div>
            <p>Scroll To Adjust Zoom</p>
            <p>Right-Click or Two Finger Pan to Rotate</p>
          </div>
          <div ref={mapContainerRef}>
            <ActivityMap
              center={center}
              activities={activities}
              unitSystem={unitSystem}
              toggleUnitSystem={toggleUnitSystem}
            />
          </div>
          <ActivityTable
            activities={activities}
            unitSystem={unitSystem}
            toggleUnitSystem={toggleUnitSystem}
            loadMoreActivities={loadMoreActivities}
            hasMore={hasMore}
            loading={loading}
            jumpToActivity={jumpToActivity}
          />
        </>
      )}
    </div>
  )
}

export default ActivityDashboard
