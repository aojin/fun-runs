// src/components/StravaAuth.js

import React from "react"

const StravaAuth = ({ profile, onLogout, onLogin }) => {
  return (
    <div>
      {profile ? (
        <div>
          <p>
            Logged into Strava as {profile.firstname} {profile.lastname}
          </p>
          <p>Membership Type: {profile.premium ? "Premium" : "Free"}</p>
          <button onClick={onLogout}>Log Out</button>
        </div>
      ) : (
        <div>
          <p>Please log in to Strava to view your trails.</p>
          <button onClick={onLogin}>Log In</button>
        </div>
      )}
    </div>
  )
}

export default StravaAuth
