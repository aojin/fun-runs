// src/components/LoginPage.js

import React from "react"
import StravaAuth from "./StravaAuth"
import Layout from "./layout"

const LoginPage = () => {
  return (
    <Layout>
      <div className="login-container">
        <h1>Login to Strava</h1>
        <StravaAuth />
      </div>
    </Layout>
  )
}

export default LoginPage
