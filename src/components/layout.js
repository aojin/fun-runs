import React from "react"
import "mapbox-gl/dist/mapbox-gl.css" // Import the Mapbox GL CSS
import "./layout.css" // Your custom CSS

const Layout = ({ children }) => {
  return (
    <div>
      <main>{children}</main>
    </div>
  )
}

export default Layout
