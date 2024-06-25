// src/pages/index.js

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

  const fetchAccessToken = async code => {
    try {
      const response = await axios.post("https://www.strava.com/oauth/token", {
        client_id: process.env.GATSBY_STRAVA_CLIENT_ID,
        client_secret: process.env.GATSBY_STRAVA_CLIENT_SECRET,
        code: code,
        grant_type: "authorization_code",
        redirect_uri: `${window.location.origin}/`,
      })
      const token = response.data.access_token
      setAccessToken(token)
      localStorage.setItem("strava_access_token", token)
      fetchUserProfile(token)
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

  const handleLogin = () => {
    const clientId = process.env.GATSBY_STRAVA_CLIENT_ID
    const redirectUri = `${window.location.origin}/`
    window.location.href = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&approval_prompt=force&scope=read,activity:read_all`
  }

  const handleSwitchUser = () => {
    localStorage.removeItem("strava_access_token")
    setAccessToken(null)
    setProfile(null)
    handleLogin()
  }

  useEffect(() => {
    const { code } = queryString.parse(window.location.search)
    if (code) {
      fetchAccessToken(code)
    } else {
      const token = localStorage.getItem("strava_access_token")
      if (token) {
        setAccessToken(token)
        fetchUserProfile(token)
      } else {
        const defaultToken = process.env.GATSBY_PERSONAL_STRAVA_ACCESS_TOKEN
        setAccessToken(defaultToken)
        fetchUserProfile(defaultToken)
      }
    }
  }, [])

  return (
    <Layout>
      <div className="page-container">
        <h1>My Strava Trails</h1>
        <StravaAuth
          profile={profile}
          setProfile={setProfile}
          onLogout={handleSwitchUser}
        />
        {accessToken && <ActivityDashboard accessToken={accessToken} />}
      </div>
    </Layout>
  )
}

export default IndexPage
