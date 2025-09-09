import React, { useEffect, useState } from "react"
import axios from "axios"

const API_BASE =
  process.env.GATSBY_API_BASE || "https://strava-server.vercel.app"

const StravaAuth = ({ profile, setProfile, onSwitchUser, fetchFailed }) => {
  const [attemptedDefaultFetch, setAttemptedDefaultFetch] = useState(false)

  useEffect(() => {
    const fetchDefaultProfile = async () => {
      try {
        // Fetch via our backend, not Strava directly
        const tokenResponse = await axios.get(`${API_BASE}/get-access-token`)
        const accessToken = tokenResponse.data.access_token

        const response = await axios.get(
          "https://www.strava.com/api/v3/athlete",
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )

        setProfile(response.data)
      } catch (error) {
        console.error("Error fetching default profile:", error)
      } finally {
        setAttemptedDefaultFetch(true)
      }
    }

    if (!profile && !attemptedDefaultFetch) {
      fetchDefaultProfile()
    }
  }, [profile, setProfile, attemptedDefaultFetch])

  return (
    <div>
      {profile ? (
        <div>
          <img
            src={profile.profile}
            alt={`${profile.firstname} ${profile.lastname}`}
            style={{
              borderRadius: "50%",
              width: "50px",
              height: "50px",
              marginRight: "10px",
            }}
          />
          <p>
            Logged into Strava as {profile.firstname} {profile.lastname}
          </p>
          <p>Membership Type: {profile.premium ? "Premium" : "Free"}</p>
        </div>
      ) : (
        <div>
          <p>Please log in to Strava to view your trails.</p>
        </div>
      )}
      <button onClick={onSwitchUser}>
        {fetchFailed ? "Log In" : "Switch User"}
      </button>
    </div>
  )
}

export default StravaAuth
