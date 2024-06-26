import React, { useEffect, useState } from "react"
import axios from "axios"

const StravaAuth = ({ profile, setProfile, onSwitchUser }) => {
  const [defaultProfile, setDefaultProfile] = useState(null)
  const [attemptedDefaultFetch, setAttemptedDefaultFetch] = useState(false)

  useEffect(() => {
    const fetchDefaultProfile = async () => {
      try {
        const token = process.env.GATSBY_PERSONAL_STRAVA_ACCESS_TOKEN
        if (!token) throw new Error("No default token provided")
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
      <button onClick={onSwitchUser}>Switch User</button>
    </div>
  )
}

export default StravaAuth
