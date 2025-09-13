import React, { useEffect, useState } from "react"
import ActivityDashboard from "../components/ActivityDashboard"
import Layout from "../components/layout"
import axios from "axios"
import "../components/index.css"
import "../components/IndexPage.css"

const IndexPage = () => {
  const [accessToken, setAccessToken] = useState(null)
  const [profile, setProfile] = useState(null)
  const [fetchFailed, setFetchFailed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  const fetchUserProfile = async (token) => {
    try {
      const profileResponse = await axios.get(
        "https://www.strava.com/api/v3/athlete",
        { headers: { Authorization: `Bearer ${token}` } }
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

    // detect mobile vs desktop
    const checkMobile = () =>
      setIsMobile(/Mobi|Android/i.test(navigator.userAgent))
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  return (
    <Layout>
      <div className="page-container">
        {/* Header: My [Strava logo] Trails */}
        <div className="header-row">
          <h1 className="page-title">My</h1>
          <img src="/strava-logo.png" alt="Strava Logo" className="strava-logo" />
          <h1 className="page-title">Trails</h1>
        </div>

        {/* Error message */}
        {fetchFailed && (
          <p className="error-message">
            Failed to fetch data. Please try again later.
          </p>
        )}

        {/* Profile Badge */}
        {profile && (
          <div className="profile-badge">
            <img
              src={profile.profile_medium}
              alt="Profile"
              className="profile-pic"
            />
            <div className="profile-info">
              <p className="profile-name">
                {profile.firstname} {profile.lastname}
              </p>
              <span
                className={`profile-status ${
                  profile.premium ? "status-premium" : "status-free"
                }`}
              >
                {profile.premium ? "Premium User" : "Free User"}
              </span>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="instructions-box">
          <h2>Usage Instructions</h2>
          {isMobile ? (
            <ul>
              <li>Pinch with two fingers to zoom in/out on the map.</li>
              <li>Drag with one finger to pan around.</li>
              <li>Twist with two fingers to <strong>rotate</strong> the map.</li>
              <li>Slide two fingers up or down to <strong>tilt</strong> the map view.</li>
              <li>
                To jump to a specific activity, either tap the{" "}
                <strong>Jump to Activity</strong> button in the table, <em>or</em> tap an
                activity in the <strong>Recent Activities</strong> list.
              </li>
            </ul>
          ) : (
            <ul>
              <li>Scroll to zoom in/out on the map.</li>
              <li>Click and drag with left mouse button to pan.</li>
              <li>
                Right-click drag <em>or</em> hold Ctrl + drag to <strong>rotate/tilt</strong> the map.
              </li>
              <li>
                To jump to a specific activity, either click the{" "}
                <strong>Jump to Activity</strong> button in the table, <em>or</em> click an
                activity in the <strong>Recent Activities</strong> list.
              </li>
            </ul>
          )}
        </div>

        {/* Activities Dashboard */}
        {accessToken && <ActivityDashboard accessToken={accessToken} />}
      </div>
    </Layout>
  )
}

export default IndexPage
