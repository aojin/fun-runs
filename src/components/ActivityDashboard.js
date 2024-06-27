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

const ActivityDashboard = () => {
  const [activities, setActivities] = useState([])
  const [center, setCenter] = useState(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [unitSystem, setUnitSystem] = useState("imperial")
  const mapContainerRef = useRef(null)

  console.log({ center })

  const fetchStravaData = useCallback(
    async (page, accessToken) => {
      setLoading(true)
      const perPage = 30 // Adjust the number of activities per page as needed

      try {
        const response = await axios.get(
          "https://strava-server.vercel.app/strava-data",
          {
            params: { page, per_page: perPage },
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        )
        const activitiesResponse = response.data

        const processedActivities = await Promise.all(
          activitiesResponse.map(async activity => {
            const coordinates = polyline
              .decode(activity.map.summary_polyline)
              .map(coord => [coord[1], coord[0]])
            const startLocation = activity.start_latlng || []
            const { city, state, country } =
              startLocation.length === 2
                ? await fetchLocationDetails(startLocation[0], startLocation[1])
                : { city: "", state: "", country: "" }
            const date = new Date(activity.start_date).toLocaleDateString() // Convert date to string

            return {
              id: activity.id, // Ensure there's a unique identifier
              name: activity.name,
              type: activity.type,
              distance: activity.distance,
              movingTime: activity.moving_time,
              elapsedTime: activity.elapsed_time,
              totalElevationGain:
                unitSystem === "imperial"
                  ? (activity.total_elevation_gain * 3.28084).toFixed(2)
                  : activity.total_elevation_gain,
              coordinates,
              startLat: startLocation[1] || "",
              startLng: startLocation[0] || "",
              city,
              state,
              country,
              date,
              geojson: {
                type: "Feature",
                geometry: {
                  type: "LineString",
                  coordinates,
                },
                properties: {
                  name: activity.name,
                  type: activity.type,
                },
              },
            }
          })
        )

        setActivities(prevActivities => [
          ...prevActivities,
          ...processedActivities,
        ])

        if (processedActivities.length < perPage) {
          setHasMore(false)
        }

        if (processedActivities.length > 0) {
          const activitiesWithCoordinates = processedActivities.filter(
            activity => activity.coordinates.length > 0
          )

          if (activitiesWithCoordinates.length > 0) {
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
    },
    [unitSystem]
  )

  const loadMoreActivities = useCallback(
    async accessToken => {
      if (!loading && hasMore) {
        await fetchStravaData(page + 1, accessToken)
        setPage(prevPage => prevPage + 1)
      }
    },
    [loading, hasMore, page, fetchStravaData]
  )

  const jumpToActivity = useCallback(coordinates => {
    console.log("coordinates in jumpToActivity", coordinates)
    setCenter(coordinates)
    mapContainerRef.current.scrollIntoView({ behavior: "smooth" })
  }, [])

  const toggleUnitSystem = () => {
    setUnitSystem(prevUnitSystem =>
      prevUnitSystem === "metric" ? "imperial" : "metric"
    )
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch the access token
        const tokenResponse = await axios.get(
          "https://strava-server.vercel.app/get-access-token"
        )
        const accessToken = tokenResponse.data.access_token

        // Fetch the initial Strava data
        await fetchStravaData(page, accessToken)
      } catch (error) {
        console.error("Error fetching access token:", error)
      }
    }

    fetchData()
  }, [fetchStravaData, page])

  useEffect(() => {
    setPage(1) // Reset to the first page when unit system changes
    setActivities([])
    setHasMore(true)
    const fetchData = async () => {
      try {
        const tokenResponse = await axios.get(
          "https://strava-server.vercel.app/get-access-token"
        )
        const accessToken = tokenResponse.data.access_token

        await fetchStravaData(1, accessToken)
      } catch (error) {
        console.error("Error fetching access token:", error)
      }
    }

    fetchData()
  }, [unitSystem, fetchStravaData])

  const handleScroll = useCallback(async () => {
    if (
      window.innerHeight + document.documentElement.scrollTop !==
        document.documentElement.offsetHeight ||
      loading ||
      !hasMore
    )
      return
    const tokenResponse = await axios.get(
      "https://strava-server.vercel.app/get-access-token"
    )
    const accessToken = tokenResponse.data.access_token
    loadMoreActivities(accessToken)
  }, [loading, hasMore, loadMoreActivities])

  useEffect(() => {
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [handleScroll])

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
