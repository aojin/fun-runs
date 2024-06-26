import React from "react"
import { navigate } from "gatsby"

const LoginPage = () => {
  const handleLogin = () => {
    const clientId = process.env.GATSBY_STRAVA_CLIENT_ID
    const redirectUri = `${window.location.origin}/`
    window.location.href = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&approval_prompt=force&scope=read,activity:read_all`
  }

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h1>Log in to Strava</h1>
      <p>Please log in to view your activities.</p>
      <button
        onClick={handleLogin}
        style={{ padding: "10px 20px", fontSize: "16px" }}
      >
        Log In with Strava
      </button>
    </div>
  )
}

export default LoginPage
