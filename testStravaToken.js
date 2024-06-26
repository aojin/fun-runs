const axios = require("axios")
require("dotenv").config()

const fetchDefaultProfile = async () => {
  try {
    const token = process.env.GATSBY_PERSONAL_STRAVA_ACCESS_TOKEN
    if (!token) throw new Error("No default token provided")

    console.log("Using token:", token) // Log the token to verify it's correct

    const response = await axios.get("https://www.strava.com/api/v3/athlete", {
      headers: { Authorization: `Bearer ${token}` },
    })

    console.log("Default profile data:", response.data)
  } catch (error) {
    console.error("Error fetching default profile:", error)
    if (error.response) {
      console.error("Response data:", error.response.data)
    }
  }
}

fetchDefaultProfile()
