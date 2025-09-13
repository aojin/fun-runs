import React, { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import "./ActivityMap.css";
import mapboxglSupported from "@mapbox/mapbox-gl-supported";

// ✅ Mapbox token
mapboxgl.accessToken = process.env.GATSBY_MAPBOX_ACCESS_TOKEN || "";

/* -------------------------
   Helpers
------------------------- */
const makeFeatureId = (a) =>
  `${a.id || a.date}-${a.name.replace(/\s+/g, "-")}`;

/* -------------------------
   Visible Activities Card
------------------------- */
function VisibleActivitiesCard({
  activities = [],
  unitSystem = "imperial",
  displayCount = 10,
  setDisplayCount = () => {},
  highlightedFeatureId,
  setHighlightedFeatureId,
  openAccordionIndex,
  setOpenAccordionIndex,
  onActivityClick = () => {},
  collapsible = true,
  forceMobile = false,
}) {
  const [open, setOpen] = useState(!collapsible || forceMobile);

  const loadMoreActivities = () => setDisplayCount((c) => c + 10);

  // Slice for mobile, show all on desktop
  const shownActivities = forceMobile
    ? activities.slice(0, displayCount)
    : activities;

  return (
    <div
      className={`floating-card ${forceMobile ? "mobile" : ""} ${
        open ? "open" : "closed"
      }`}
    >
      {/* Header */}
      <div
        className="floating-card-header"
        onClick={() => collapsible && !forceMobile && setOpen(!open)}
        style={{ cursor: collapsible && !forceMobile ? "pointer" : "default" }}
      >
        <h3>
          {forceMobile
            ? `Last ${shownActivities.length} Activities in View`
            : `Visible Activities (${activities.length})`}
        </h3>
        {collapsible && !forceMobile && (
          <button className="toggle-btn">{open ? "▼" : "▲"}</button>
        )}
      </div>

      {/* List */}
      {open && (
        <>
          <ul className="activity-list">
            {shownActivities.map((a, idx) => {
              const activityId = makeFeatureId(a);
              const distance =
                unitSystem === "metric"
                  ? (a.distance / 1000).toFixed(2) + " km"
                  : (a.distance / 1609.34).toFixed(2) + " mi";
              const elevationGain =
                unitSystem === "metric"
                  ? Number(a.totalElevationGainMeters).toFixed(2) + " m"
                  : (
                      Number(a.totalElevationGainMeters) * 3.28084
                    ).toFixed(2) + " ft";

              return (
                <li
                  key={activityId}
                  className={`activity-row cursor-pointer ${
                    highlightedFeatureId === activityId ? "active" : ""
                  }`}
                  onMouseEnter={() =>
                    !forceMobile && setHighlightedFeatureId?.(activityId)
                  }
                  onMouseLeave={() => {
                    if (!forceMobile && highlightedFeatureId === activityId) {
                      setHighlightedFeatureId?.(null);
                    }
                  }}
                >
                  <div
                    className="activity-header"
                    onClick={() => {
                      setHighlightedFeatureId?.(activityId);
                      onActivityClick(a);
                    }}
                  >
                    <span>
                      {a.name} - {new Date(a.date).toLocaleDateString()}
                    </span>
                    <span
                      className="caret"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenAccordionIndex?.(
                          openAccordionIndex === idx ? null : idx
                        );
                      }}
                    >
                      {openAccordionIndex === idx ? "▼" : "►"}
                    </span>
                  </div>

                  {openAccordionIndex === idx && (
                    <div className="activity-details">
                      <ul>
                        <li>Type: {a.type}</li>
                        <li>Distance: {distance}</li>
                        <li>
                          Moving Time: {(a.movingTime / 60).toFixed(2)} mins
                        </li>
                        <li>
                          Elapsed Time: {(a.elapsedTime / 60).toFixed(2)} mins
                        </li>
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

          {/* Only mobile gets "Load More" */}
          {forceMobile && displayCount < activities.length && (
            <button onClick={loadMoreActivities}>Load More</button>
          )}
        </>
      )}
    </div>
  );
}


/* -------------------------
   Activity Map
------------------------- */
const ActivityMap = ({
  center,
  activities,
  unitSystem,
  toggleUnitSystem,
  setCenter,
  showFloatingCard = true,
  displayCount,
  setDisplayCount,
  onVisibleChange,
  visibleActivities = [],
  forceMobile = false, // 👈 from Dashboard for mobile mode
  highlightedFeatureId,
  setHighlightedFeatureId,
  openAccordionIndex,
  setOpenAccordionIndex,
}) => {
  const mapContainerRef = useRef(null);
  const map = useRef(null);
  const mapLoaded = useRef(false);

  const [satelliteVisible, setSatelliteVisible] = useState(false);
  const [terrainEnabled, setTerrainEnabled] = useState(false);

  // ─── Helpers ─────────────────────────────────────────────
  const hashColor = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00ffffff).toString(16).toUpperCase();
    return "#" + "00000".substring(0, 6 - c.length) + c;
  };

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

      onVisibleChange?.(unique);
    }
  }, [activities, onVisibleChange]);

  const addActivityLayer = useCallback(() => {
    if (!mapLoaded.current || !map.current) return;

    const features = activities.map((activity) => ({
      type: "Feature",
      geometry: { type: "LineString", coordinates: activity.coordinates },
      properties: {
        id: makeFeatureId(activity),
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
    } else {
      const src = map.current.getSource("activities");
      src.setData({ type: "FeatureCollection", features });
    }
  }, [activities]);

  // 🔑 Sync highlight state with map layer
  useEffect(() => {
    if (!map.current || !mapLoaded.current) return;
    const filterId = highlightedFeatureId || "";
    if (map.current.getLayer("activities-highlighted")) {
      map.current.setFilter("activities-highlighted", ["==", "id", filterId]);
    }
  }, [highlightedFeatureId]);

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

  useEffect(() => {
    if (map.current && center) {
      map.current.flyTo({ center, zoom: 14, essential: true });
    }
  }, [center]);

  const toggleSatelliteLayer = () => {
    if (!map.current) return;
    if (satelliteVisible) {
      map.current.setStyle("mapbox://styles/mapbox/outdoors-v12");
      setSatelliteVisible(false);
    } else {
      map.current.setStyle("mapbox://styles/mapbox/satellite-streets-v12");
      setSatelliteVisible(true);
    }

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

  const handleActivityClick = (activity) => {
    if (!map.current) return;

    let lngLat = null;
    if (activity.coordinates && activity.coordinates.length > 0) {
      lngLat = activity.coordinates[0];
    } else if (activity.startLng && activity.startLat) {
      lngLat = [activity.startLng, activity.startLat];
    }

    if (!lngLat) {
      console.warn("No valid coordinates for activity:", activity);
      return;
    }

    const [lng, lat] = lngLat;
    const featureId = makeFeatureId(activity);

    setHighlightedFeatureId(featureId);

    if (map.current.getLayer("activities-highlighted")) {
      map.current.setFilter("activities-highlighted", ["==", "id", featureId]);
      map.current.triggerRepaint();
    }

    map.current.flyTo({ center: [lng, lat], zoom: 15 });
  };

  // ─── Render ──────────────────────────────────────────
  return (
    <div className="map-container" ref={mapContainerRef}>
      {showFloatingCard && (
        <VisibleActivitiesCard
          activities={visibleActivities}
          unitSystem={unitSystem}
          displayCount={displayCount}
          setDisplayCount={setDisplayCount}
          highlightedFeatureId={highlightedFeatureId}
          setHighlightedFeatureId={setHighlightedFeatureId}
          openAccordionIndex={openAccordionIndex}
          setOpenAccordionIndex={setOpenAccordionIndex}
          onActivityClick={handleActivityClick}
          collapsible={true}
          forceMobile={forceMobile}
        />
      )}

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
export { VisibleActivitiesCard };
