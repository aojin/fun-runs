import React, { useEffect, useState } from "react"
import ActivityDashboard from "../components/ActivityDashboard"
import StravaAuth from "../components/StravaAuth"
import Layout from "../components/layout"
import axios from "axios"
import queryString from "query-string"
import { navigate } from "gatsby"
import "../components/index.css" // Import the global styles

const IndexPage = () => {
  const [accessToken, setAccessToken] = useState(null)
  const [profile, setProfile] = useState(null)
  const [usingPersonalToken, setUsingPersonalToken] = useState(true)

  const fetchAccessToken = async code => {
    try {
      const response = await axios.post("https://www.strava.com/oauth/token", {
        client_id: process.env.GATSBY_STRAVA_CLIENT_ID,
        client_secret: process.env.GATSBY_STRAVA_CLIENT_SECRET,
        code: code,
        grant_type: "authorization_code",
        redirect_uri: `${window.location.origin}/`,
      })
      const { access_token, refresh_token, expires_at } = response.data
      setAccessToken(access_token)
      localStorage.setItem("strava_access_token", access_token)
      localStorage.setItem("strava_refresh_token", refresh_token)
      localStorage.setItem("strava_expires_at", expires_at)
      fetchUserProfile(access_token)
      setUsingPersonalToken(false)
      navigate("/") // Redirect to home page after login
    } catch (error) {
      console.error(
        "Error fetching access token:",
        error.response ? error.response.data : error.message
      )
    }
  }

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
    }
  }

  const refreshAccessToken = async refreshToken => {
    try {
      const response = await axios.post("https://www.strava.com/oauth/token", {
        client_id: process.env.GATSBY_STRAVA_CLIENT_ID,
        client_secret: process.env.GATSBY_STRAVA_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      })
      const { access_token, refresh_token, expires_at } = response.data
      setAccessToken(access_token)
      localStorage.setItem("strava_access_token", access_token)
      localStorage.setItem("strava_refresh_token", refresh_token)
      localStorage.setItem("strava_expires_at", expires_at)
      fetchUserProfile(access_token)
    } catch (error) {
      console.error(
        "Error refreshing access token:",
        error.response ? error.response.data : error.message
      )
    }
  }

  const handleSwitchUser = () => {
    localStorage.removeItem("strava_access_token")
    localStorage.removeItem("strava_refresh_token")
    localStorage.removeItem("strava_expires_at")
    setAccessToken(null)
    setProfile(null)
    navigate("/login")
  }

  useEffect(() => {
    const checkAndRefreshToken = async () => {
      const expiresAt = localStorage.getItem("strava_expires_at")
      const currentTime = Math.floor(Date.now() / 1000)

      if (currentTime >= expiresAt) {
        const refreshToken = localStorage.getItem("strava_refresh_token")
        await refreshAccessToken(refreshToken)
      } else {
        const token = localStorage.getItem("strava_access_token")
        setAccessToken(token)
        fetchUserProfile(token)
      }
    }

    const { code } = queryString.parse(window.location.search)
    if (code) {
      fetchAccessToken(code)
    } else {
      const token = process.env.GATSBY_PERSONAL_STRAVA_ACCESS_TOKEN
      setAccessToken(token)
      fetchUserProfile(token)
      setUsingPersonalToken(true)
    }
  }, [])

  return (
    <Layout>
      <div className="page-container">
        <h1>My Strava Trails</h1>
        <StravaAuth
          profile={profile}
          setProfile={setProfile}
          onSwitchUser={handleSwitchUser}
        />
        {accessToken && (
          <ActivityDashboard
            accessToken={accessToken}
            usingPersonalToken={usingPersonalToken}
          />
        )}
      </div>
    </Layout>
  )
}

export default IndexPage
