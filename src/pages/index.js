import React, { useEffect, useState } from "react"
import ActivityDashboard from "../components/ActivityDashboard"
import Layout from "../components/layout"
import axios from "axios"
import "../components/index.css" // Import the global styles

const IndexPage = () => {
  const [accessToken, setAccessToken] = useState(null)
  const [profile, setProfile] = useState(null)
  const [fetchFailed, setFetchFailed] = useState(false) // New state to track fetch failure

  const fetchUserProfile = async token => {
    try {
      const profileResponse = await axios.get(
        "https://www.strava.com/api/v3/athlete",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      setProfile(profileResponse.data)
    } catch (error) {
      console.error(
        "Error fetching Strava profile data:",
        error.response ? error.response.data : error.message
      )
      if (error.response && error.response.status === 401) {
        setFetchFailed(true)
      }
    }
  }

  const fetchDefaultUserProfile = async () => {
    try {
      const tokenResponse = await axios.get(
        "https://strava-server.vercel.app/get-access-token"
      )
      const accessToken = tokenResponse.data.access_token
      setAccessToken(accessToken)
      await fetchUserProfile(accessToken)
    } catch (error) {
      console.error("Error fetching default user profile:", error)
      setFetchFailed(true)
    }
  }

  useEffect(() => {
    fetchDefaultUserProfile()
  }, [])

  return (
    <Layout>
      <div className="page-container">
        <h1>My Strava Trails</h1>
        {fetchFailed && <p>Failed to fetch data. Please try again later.</p>}
        {accessToken && <ActivityDashboard accessToken={accessToken} />}
      </div>
    </Layout>
  )
}

export default IndexPage
