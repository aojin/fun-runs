import React, { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import polyline from "@mapbox/polyline";
import ActivityMap, { VisibleActivitiesCard } from "./ActivityMap";
import ActivityTable from "./ActivityTable";
import "./ActivityDashboard.css";

/* -------------------------
   Small UI primitives
------------------------- */
function TopProgress({ active }) {
  return <div className={`top-progress ${active ? "active" : ""}`} />;
}

function LoaderOverlay({ show, children }) {
  return (
    <div className={`loader-overlay ${show ? "show" : ""}`}>
      <div className="spinner" />
      {children}
    </div>
  );
}

function ErrorBanner({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="error-banner">
      <span>{message}</span>
      {onRetry && (
        <button className="retry-btn" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

function MapSkeleton() {
  return (
    <div className="skeleton-card">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-map" />
    </div>
  );
}

function TableSkeleton({ rows = 8, cols = 6 }) {
  return (
    <div className="skeleton-card">
      <div className="skeleton skeleton-title" />
      <div className="skeleton-table">
        {[...Array(rows)].map((_, r) => (
          <div key={r} className="skeleton-row">
            {[...Array(cols)].map((_, c) => (
              <div key={c} className="skeleton skeleton-cell" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------
   Responsive Hook
------------------------- */
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= breakpoint);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);
  return isMobile;
}

/* -------------------------
   Fetch helpers
------------------------- */
const API_BASE =
  process.env.GATSBY_API_BASE || "https://strava-server.vercel.app";

const fetchLocationDetails = async (lat, lng) => {
  const mapboxAccessToken = process.env.GATSBY_MAPBOX_ACCESS_TOKEN;
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxAccessToken}`;

  try {
    const response = await axios.get(url);
    const features = response.data.features;

    let city = "";
    let state = "";
    let country = "";

    features.forEach((feature) => {
      if (feature.place_type.includes("place")) city = feature.text;
      if (feature.place_type.includes("region")) state = feature.text;
      if (feature.place_type.includes("country")) country = feature.text;
    });

    return { city, state, country };
  } catch (error) {
    console.error("Error fetching location details:", error);
    return { city: "", state: "", country: "" };
  }
};

/* -------------------------
   Dashboard
------------------------- */
const ActivityDashboard = ({ accessToken: accessTokenProp }) => {
  const [activities, setActivities] = useState([]);
  const [visibleActivities, setVisibleActivities] = useState([]);
  const [displayCount, setDisplayCount] = useState(10);
  const [center, setCenter] = useState(null);
  const [page, setPage] = useState(1);
  const [unitSystem, setUnitSystem] = useState("imperial");

  // Shared state
  const [highlightedFeatureId, setHighlightedFeatureId] = useState(null);
  const [openAccordionIndex, setOpenAccordionIndex] = useState(null);

  // Loading & error states
  const [initLoading, setInitLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);

  const inFlight = useRef([]);
  const mapWrapperRef = useRef(null);
  const isMobile = useIsMobile();

  /* ---------- Cancel helpers ---------- */
  const cancelAll = () => {
    inFlight.current.forEach((c) => c.abort && c.abort());
    inFlight.current = [];
  };
  const withAbort = () => {
    const controller = new AbortController();
    inFlight.current.push(controller);
    return controller;
  };

  /* ---------- Token fetch ---------- */
  const getAccessToken = useCallback(async () => {
    if (accessTokenProp) return accessTokenProp;
    const controller = withAbort();
    const res = await axios.get(`${API_BASE}/get-access-token`, {
      signal: controller.signal,
    });
    return res.data.access_token;
  }, [accessTokenProp]);

  /* ---------- Strava fetch ---------- */
  const fetchStravaData = useCallback(
    async (nextPage, token, reset = false) => {
      const perPage = 30;
      const controller = withAbort();
      try {
        const response = await axios.get(`${API_BASE}/strava-data`, {
          params: { page: nextPage, per_page: perPage },
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        const activitiesResponse = response.data;

        const processedActivities = await Promise.all(
          activitiesResponse.map(async (activity) => {
            const coordinates = polyline
              .decode(activity.map.summary_polyline || "")
              .map((coord) => [coord[1], coord[0]]);

            const startLocation = activity.start_latlng || [];
            const { city, state, country } =
              startLocation.length === 2
                ? await fetchLocationDetails(startLocation[0], startLocation[1])
                : { city: "", state: "", country: "" };

            const date = new Date(activity.start_date).toLocaleDateString();
            const totalElevationGainMeters =
              activity.total_elevation_gain || 0;

            return {
              id: activity.id,
              name: activity.name,
              type: activity.type,
              distance: activity.distance,
              movingTime: activity.moving_time,
              elapsedTime: activity.elapsed_time,
              totalElevationGainMeters,
              coordinates,
              startLat: startLocation[0] || "",
              startLng: startLocation[1] || "",
              city,
              state,
              country,
              date,
              geojson: {
                type: "Feature",
                geometry: { type: "LineString", coordinates },
                properties: { name: activity.name, type: activity.type },
              },
            };
          })
        );

        setActivities((prev) =>
          reset ? processedActivities : [...prev, ...processedActivities]
        );

        if (processedActivities.length < perPage) setHasMore(false);

        if (processedActivities.length > 0) {
          const lastWithCoords = processedActivities.find(
            (a) => a.coordinates.length > 0
          );
          if (lastWithCoords) setCenter(lastWithCoords.coordinates[0]);
        }
      } finally {
        inFlight.current = inFlight.current.filter((c) => c !== controller);
      }
    },
    []
  );

  /* ---------- Initial fetch ---------- */
  useEffect(() => {
    let mounted = true;
    setError(null);
    setInitLoading(true);
    setHasMore(true);
    setPage(1);
    cancelAll();

    (async () => {
      const start = Date.now(); // track time
      try {
        const token = await getAccessToken();
        if (!mounted) return;
        await fetchStravaData(1, token, true);
      } catch (err) {
        if (mounted) {
          console.error(err);
          setError("Failed to load activities.");
        }
      } finally {
        const elapsed = Date.now() - start;
        const delay = Math.max(0, 400 - elapsed); // minimum 400ms skeleton
        setTimeout(() => {
          if (mounted) setInitLoading(false);
        }, delay);
      }
    })();

    return () => {
      mounted = false;
      cancelAll();
    };
  }, [getAccessToken, fetchStravaData]);

  /* ---------- Refetch on unit change ---------- */
  useEffect(() => {
    let mounted = true;
    if (initLoading) return;
    setError(null);
    setIsRefetching(true);
    setHasMore(true);
    setPage(1);
    cancelAll();

    (async () => {
      try {
        const token = await getAccessToken();
        if (!mounted) return;
        await fetchStravaData(1, token, true);
      } catch (err) {
        if (mounted) {
          console.error(err);
          setError("Failed to reload with the selected unit system.");
        }
      } finally {
        if (mounted) setIsRefetching(false);
      }
    })();

    return () => {
      mounted = false;
      cancelAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitSystem]);

  /* ---------- Load more ---------- */
  const loadMoreActivities = useCallback(async () => {
    if (isFetchingMore || !hasMore) return;
    setIsFetchingMore(true);
    setError(null);
    try {
      const token = await getAccessToken();
      await fetchStravaData(page + 1, token);
      setPage((prev) => prev + 1);
    } catch (err) {
      console.error(err);
      setError("Failed to load more activities.");
    } finally {
      setIsFetchingMore(false);
    }
  }, [isFetchingMore, hasMore, page, fetchStravaData, getAccessToken]);

  /* ---------- Retry ---------- */
  const retryInitial = useCallback(() => {
    setInitLoading(true);
    setError(null);
    setHasMore(true);
    setPage(1);
    cancelAll();
    (async () => {
      const start = Date.now();
      try {
        const token = await getAccessToken();
        await fetchStravaData(1, token, true);
      } catch (err) {
        console.error(err);
        setError("Failed to load activities.");
      } finally {
        const elapsed = Date.now() - start;
        const delay = Math.max(0, 400 - elapsed);
        setTimeout(() => setInitLoading(false), delay);
      }
    })();
  }, [fetchStravaData, getAccessToken]);

  const toggleUnitSystem = () =>
    setUnitSystem((prev) => (prev === "metric" ? "imperial" : "metric"));

  /* ---------- Scroll helper ---------- */
  const scrollToMap = () => {
    if (!mapWrapperRef.current) return;
    const rect = mapWrapperRef.current.getBoundingClientRect();
    const y = window.pageYOffset + rect.top - 80;
    window.scrollTo({ top: y, behavior: "smooth" });
  };

  /* ---------- Render ---------- */
  return (
    <div>
      <TopProgress active={initLoading || isRefetching} />
      <ErrorBanner message={error} onRetry={retryInitial} />

      {initLoading && (
        <>
          <MapSkeleton />
          <TableSkeleton rows={10} cols={7} />
        </>
      )}

      {!initLoading && (
        <>
          {/* Map */}
          <div ref={mapWrapperRef} style={{ position: "relative" }}>
            <LoaderOverlay show={isRefetching}>
              <div style={{ marginTop: 8 }}>Updating units…</div>
            </LoaderOverlay>
            <ActivityMap
              center={center}
              activities={activities}
              unitSystem={unitSystem}
              toggleUnitSystem={toggleUnitSystem}
              setCenter={setCenter}
              showFloatingCard={!isMobile}
              displayCount={displayCount}
              setDisplayCount={setDisplayCount}
              visibleActivities={visibleActivities}
              onVisibleChange={setVisibleActivities}
              highlightedFeatureId={highlightedFeatureId}
              setHighlightedFeatureId={setHighlightedFeatureId}
              openAccordionIndex={openAccordionIndex}
              setOpenAccordionIndex={setOpenAccordionIndex}
            />
          </div>

          {/* Mobile: render activities below map */}
          {isMobile && visibleActivities.length > 0 && (
            <VisibleActivitiesCard
              activities={visibleActivities}
              unitSystem={unitSystem}
              displayCount={displayCount}
              setDisplayCount={setDisplayCount}
              onActivityClick={(a) => {
                setCenter(a.coordinates[0] || [a.startLng, a.startLat]);
                setHighlightedFeatureId(
                  `${a.id || a.date}-${a.name.replace(/\s+/g, "-")}`
                );
                scrollToMap();
              }}
              highlightedFeatureId={highlightedFeatureId}
              setHighlightedFeatureId={setHighlightedFeatureId}
              openAccordionIndex={openAccordionIndex}
              setOpenAccordionIndex={setOpenAccordionIndex}
              collapsible={true}
              forceMobile={true}
            />
          )}

          {/* Table */}
          <ActivityTable
            activities={activities}
            unitSystem={unitSystem}
            toggleUnitSystem={toggleUnitSystem}
            loadMoreActivities={loadMoreActivities}
            hasMore={hasMore}
            isFetchingMore={isFetchingMore}
            jumpToActivity={(coords) => {
              setCenter(coords);
              scrollToMap();
            }}
          />
        </>
      )}
    </div>
  );
};

export default ActivityDashboard;
