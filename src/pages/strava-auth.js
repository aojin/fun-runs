import React, { useEffect } from "react"
import { navigate } from "gatsby"
import axios from "axios"

const API_BASE =
  process.env.GATSBY_API_BASE || "https://strava-server.vercel.app"

export default function StravaAuthCallback() {
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get("code")

    if (code) {
      axios
        .get(`${API_BASE}/exchange_token?code=${code}`)
        .then(() => {
          console.log("✅ Token exchanged & saved")
          navigate("/") // redirect home
        })
        .catch(err => {
          console.error("❌ Failed to exchange token", err)
          navigate("/login")
        })
    } else {
      navigate("/login")
    }
  }, [])

  return <p>Completing Strava login...</p>
}
