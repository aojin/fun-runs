import React, { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import "./ActivityMap.css";
import mapboxglSupported from "@mapbox/mapbox-gl-supported";

// ✅ Make sure your token is set in .env
mapboxgl.accessToken = process.env.GATSBY_MAPBOX_ACCESS_TOKEN || "";

const ActivityMap = ({
  center,
  activities,
  unitSystem,
  toggleUnitSystem,
  setCenter,
}) => {
  const mapContainerRef = useRef(null);
  const map = useRef(null);
  const mapLoaded = useRef(false);

  const [satelliteVisible, setSatelliteVisible] = useState(false);
  const [terrainEnabled, setTerrainEnabled] = useState(false);
  const [visibleActivities, setVisibleActivities] = useState([]);
  const [displayCount, setDisplayCount] = useState(30);
  const [highlightedFeatureId, setHighlightedFeatureId] = useState(null);
  const [openAccordionIndex, setOpenAccordionIndex] = useState(null);

  // ─── Helpers ─────────────────────────────────────────────
  const hashColor = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00ffffff).toString(16).toUpperCase();
    return "#" + "00000".substring(0, 6 - c.length) + c;
  };

  const generateActivityId = (activity) =>
    `${activity.id || activity.date}-${activity.name.replace(/\s+/g, "-")}`;

  // ─── Visible Activities ────────────────────────────────
  const updateVisibleActivities = useCallback(() => {
    if (map.current && mapLoaded.current) {
      const bounds = map.current.getBounds();
      const visible = activities
        .filter((a) =>
          a.coordinates.some(([lng, lat]) => bounds.contains([lng, lat]))
        )
        .sort((a, b) => new Date(b.date) - new Date(a.date));

      const unique = visible.filter(
        (v, i, self) => i === self.findIndex((o) => o.id === v.id)
      );

      setVisibleActivities(unique);
    }
  }, [activities]);

  // ─── Add/Update Activity Layer ──────────────────────────
  const addActivityLayer = useCallback(() => {
    if (!mapLoaded.current || !map.current) return;

    const features = activities.map((activity) => ({
      type: "Feature",
      geometry: { type: "LineString", coordinates: activity.coordinates },
      properties: {
        id: generateActivityId(activity),
        name: activity.name,
        type: activity.type,
        date: activity.date,
        color: hashColor(activity.id ? activity.id.toString() : activity.name),
      },
    }));

    if (!map.current.getSource("activities")) {
      map.current.addSource("activities", {
        type: "geojson",
        data: { type: "FeatureCollection", features },
      });

      map.current.addLayer({
        id: "activities",
        type: "line",
        source: "activities",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": 4,
          "line-opacity": 0.9,
        },
      });

      map.current.addLayer({
        id: "activities-highlighted",
        type: "line",
        source: "activities",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#FC4C02",
          "line-width": 6,
          "line-opacity": 1,
        },
        filter: ["==", "id", ""],
      });

      // Hover highlight
      map.current.on("mousemove", "activities", (e) => {
        if (e.features?.length) {
          const f = e.features[0];
          setHighlightedFeatureId(f.properties.id);
          map.current.setFilter("activities-highlighted", [
            "==",
            "id",
            f.properties.id,
          ]);
          map.current.getCanvas().style.setProperty("cursor", "pointer");
        }
      });

      map.current.on("mouseleave", "activities", () => {
        setHighlightedFeatureId(null);
        map.current.setFilter("activities-highlighted", ["==", "id", ""]);
        map.current.getCanvas().style.removeProperty("cursor");
      });
    } else {
      const src = map.current.getSource("activities");
      src.setData({ type: "FeatureCollection", features });
    }
  }, [activities]);

  // ─── Init Map ─────────────────────────────────────────
  useEffect(() => {
    if (!mapboxglSupported.supported()) {
      if (mapContainerRef.current) {
        mapContainerRef.current.innerHTML = "WebGL not supported";
      }
      return;
    }

    if (!map.current) {
      map.current = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/outdoors-v12",
        center: center || [0, 0],
        zoom: center ? 12 : 2,
        pitch: 0,
      });

      map.current.on("load", () => {
        mapLoaded.current = true;
        addActivityLayer();
        updateVisibleActivities();
      });

      map.current.addControl(new mapboxgl.NavigationControl(), "top-right");
      map.current.on("moveend", updateVisibleActivities);
    }
  }, [addActivityLayer, updateVisibleActivities]);

  // ─── React to center prop changes ──────────────────────
  useEffect(() => {
    if (map.current && center) {
      map.current.flyTo({
        center,
        zoom: 14,
        essential: true,
      });
    }
  }, [center]);

  // ─── Toggles ──────────────────────────────────────────
  const toggleSatelliteLayer = () => {
    if (!map.current) return;

    if (satelliteVisible) {
      map.current.setStyle("mapbox://styles/mapbox/outdoors-v12");
      setSatelliteVisible(false);
    } else {
      map.current.setStyle("mapbox://styles/mapbox/satellite-streets-v12");
      setSatelliteVisible(true);
    }

    // Reapply activities + terrain after style reload
    map.current.once("style.load", () => {
      addActivityLayer();
      if (terrainEnabled) {
        if (!map.current.getSource("mapbox-dem")) {
          map.current.addSource("mapbox-dem", {
            type: "raster-dem",
            url: "mapbox://mapbox.mapbox-terrain-dem-v1",
            tileSize: 512,
            maxzoom: 14,
          });
        }
        map.current.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });
      }
    });
  };

  const toggleTerrain = () => {
    if (!map.current) return;
    if (terrainEnabled) {
      map.current.setTerrain(null);
      setTerrainEnabled(false);
    } else {
      if (!map.current.getSource("mapbox-dem")) {
        map.current.addSource("mapbox-dem", {
          type: "raster-dem",
          url: "mapbox://mapbox.mapbox-terrain-dem-v1",
          tileSize: 512,
          maxzoom: 14,
        });
      }
      map.current.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });
      setTerrainEnabled(true);
    }
  };

  // ─── Activity List Events ─────────────────────────────
  const handleActivityClick = (coordinates) => {
    if (map.current) {
      const [lng, lat] = coordinates;
      map.current.flyTo({ center: [lng, lat], zoom: 15 });
    }
  };

  const handleRowMouseEnter = (id) => {
    setHighlightedFeatureId(id);
    map.current?.setFilter("activities-highlighted", ["==", "id", id]);
  };

  const handleRowMouseLeave = (id) => {
    if (highlightedFeatureId === id) {
      setHighlightedFeatureId(null);
      map.current?.setFilter("activities-highlighted", ["==", "id", ""]);
    }
  };

  const loadMoreActivities = () => setDisplayCount((c) => c + 30);

  // ─── Render ──────────────────────────────────────────
  return (
    <div className="map-container" ref={mapContainerRef}>
      <div className="floating-card">
        <h3>Visible Activities ({visibleActivities.length})</h3>
        <ul>
          {visibleActivities.slice(0, displayCount).map((a, idx) => {
            const activityId = generateActivityId(a);
            const distance =
              unitSystem === "metric"
                ? (a.distance / 1000).toFixed(2) + " km"
                : (a.distance / 1609.34).toFixed(2) + " mi";
            const elevationGain =
              unitSystem === "metric"
                ? Number(a.totalElevationGainMeters).toFixed(2) + " m"
                : (Number(a.totalElevationGainMeters) * 3.28084).toFixed(2) +
                  " ft";

            return (
              <li
                key={activityId}
                className="activity-row cursor-pointer"
                onMouseEnter={() => handleRowMouseEnter(activityId)}
                onMouseLeave={() => handleRowMouseLeave(activityId)}
              >
                <div
                  className="activity-header"
                  onClick={() => handleActivityClick(a.coordinates[0])}
                >
                  {a.name} - {new Date(a.date).toLocaleDateString()}
                  <span
                    className="caret"
                    onClick={() =>
                      setOpenAccordionIndex(
                        openAccordionIndex === idx ? null : idx
                      )
                    }
                  >
                    {openAccordionIndex === idx ? "▼" : "►"}
                  </span>
                </div>
                {openAccordionIndex === idx && (
                  <div className="activity-details">
                    <ul>
                      <li>Type: {a.type}</li>
                      <li>Distance: {distance}</li>
                      <li>Moving Time: {(a.movingTime / 60).toFixed(2)} mins</li>
                      <li>Elapsed Time: {(a.elapsedTime / 60).toFixed(2)} mins</li>
                      <li>Elevation Gain: {elevationGain}</li>
                      <li>City: {a.city}</li>
                      <li>State: {a.state}</li>
                      <li>Country: {a.country}</li>
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {displayCount < visibleActivities.length && (
          <button onClick={loadMoreActivities}>Load More</button>
        )}
      </div>

      <div className="layer-controls">
        <button onClick={toggleSatelliteLayer}>
          {satelliteVisible ? "Hide Satellite" : "Show Satellite"}
        </button>
        <button onClick={toggleTerrain}>
          {terrainEnabled ? "Disable 3D Terrain" : "Enable 3D Terrain"}
        </button>
      </div>
    </div>
  );
};

export default ActivityMap;
