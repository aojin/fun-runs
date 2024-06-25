// src/components/StravaAuth.js

import React, { useEffect, useState } from "react"
import axios from "axios"

const StravaAuth = ({ profile, setProfile }) => {
  const [defaultProfile, setDefaultProfile] = useState(null)

  useEffect(() => {
    const fetchDefaultProfile = async () => {
      try {
        const token = process.env.GATSBY_PERSONAL_STRAVA_ACCESS_TOKEN
        const response = await axios.get(
          "https://www.strava.com/api/v3/athlete",
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        )
        setDefaultProfile(response.data)
        setProfile(response.data)
      } catch (error) {
        console.error("Error fetching default profile:", error)
      }
    }

    if (!profile) {
      fetchDefaultProfile()
    }
  }, [profile, setProfile])

  const handleLogin = () => {
    const clientId = process.env.GATSBY_STRAVA_CLIENT_ID
    const redirectUri = `${window.location.origin}/`
    window.location.href = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&approval_prompt=force&scope=read,activity:read_all`
  }

  return (
    <div>
      {profile ? (
        <div>
          <p>
            Logged into Strava as {profile.firstname} {profile.lastname}
          </p>
          <p>Membership Type: {profile.premium ? "Premium" : "Free"}</p>
          <button onClick={handleLogin}>Switch User</button>
        </div>
      ) : (
        <div>
          <p>Please log in to Strava to view your trails.</p>
          <button onClick={handleLogin}>Log In</button>
        </div>
      )}
    </div>
  )
}

export default StravaAuth
