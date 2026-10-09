import {
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Info,
  LockKeyhole,
  MapPin,
  Search,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_MAP_VIEW,
  type MapView,
  SiteMap,
  type SiteMapHandle,
} from "./SiteMap";
import { type ApiSite, groupSites, normalizeSites, type Site } from "./sites";

export interface SiteFinderProps {
  apiUrl?: string;
  initialView?: MapView;
  /** Automatically expand the nearest visible city at this zoom or closer. */
  cityZoom?: number;
}

export function SiteFinder({
  apiUrl = "https://icpc.global/api/contest/public/Kazakhstan-Q-2027",
  initialView = DEFAULT_MAP_VIEW,
  cityZoom = 10,
}: SiteFinderProps) {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [openCities, setOpenCities] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const map = useRef<SiteMapHandle>(null);
  const list = useRef<HTMLDivElement>(null);
  const cities = useMemo(() => groupSites(sites, query), [sites, query]);
  const hasQuery = Boolean(query.trim());

  // biome-ignore lint/correctness/useExhaustiveDependencies: The attempt counter intentionally reruns the request when Retry is clicked.
  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    setLoading(true);
    setError("");
    setSites([]);
    setSelectedId(null);
    setOpenCities(new Set());
    async function load() {
      try {
        const response = await fetch(apiUrl, { signal: controller.signal });
        if (!response.ok)
          throw new Error(`Request failed (${response.status})`);
        const data: { sites?: ApiSite[] } = await response.json();
        if (!Array.isArray(data.sites))
          throw new Error("The response did not contain contest sites");
        if (disposed) return;
        setSites(normalizeSites(data.sites));
      } catch {
        if (!disposed)
          setError(
            controller.signal.aborted
              ? "The request timed out. Please try again."
              : "We couldn’t load the contest sites. Check your connection and try again.",
          );
      } finally {
        window.clearTimeout(timeout);
        if (!disposed) setLoading(false);
      }
    }
    void load();
    return () => {
      disposed = true;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [apiUrl, attempt]);

  const openCity = useCallback((city: string) => {
    setOpenCities((previous) =>
      previous.has(city) ? previous : new Set([...previous, city]),
    );
  }, []);

  const selectSite = useCallback(
    (site: Site) => {
      setQuery("");
      openCity(site.city);
      setSelectedId(site.id);
    },
    [openCity],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: Search and city expansion change the selected row's position in the list.
  useEffect(() => {
    if (!selectedId || !list.current) return;
    const item = document.getElementById(`site-${selectedId}`);
    if (!item) return;
    const parent = list.current;
    const top =
      item.getBoundingClientRect().top -
      parent.getBoundingClientRect().top +
      parent.scrollTop;
    parent.scrollTo({ top: Math.max(0, top - 12), behavior: "smooth" });
  }, [selectedId, query, openCities]);

  function toggleCity(city: string) {
    setOpenCities((previous) => {
      const next = new Set(previous);
      if (next.has(city)) next.delete(city);
      else next.add(city);
      return next;
    });
  }

  return (
    <section className="site-finder">
      <div className="finder-body">
        <SiteMap
          ref={map}
          sites={sites}
          selectedId={selectedId}
          initialView={initialView}
          cityZoom={cityZoom}
          onSelect={selectSite}
          onCityFocus={openCity}
        />
        <aside className="locations-panel">
          <div className="search-wrap">
            <Search size={17} />
            <input
              aria-label="Search cities or universities"
              placeholder="Search city or university"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery("")}
              >
                <X size={16} />
              </button>
            )}
          </div>
          <div className="list-meta">
            <span>
              {hasQuery ? `${cities.length} MATCHING CITIES` : "ALL CITIES"}
            </span>
            <span>
              {loading
                ? "Loading…"
                : `${cities.reduce((total, city) => total + city.sites.length, 0)} sites`}
            </span>
          </div>
          <div className="city-list" ref={list} aria-busy={loading}>
            {loading && (
              <div className="list-message" role="status">
                <span className="loading-spinner" />
                <strong>Loading…</strong>
              </div>
            )}
            {error && (
              <div className="list-message" role="alert">
                <Info size={26} />
                <strong>Sites couldn’t be loaded</strong>
                <span>{error}</span>
                <button
                  type="button"
                  className="retry-button"
                  onClick={() => setAttempt((value) => value + 1)}
                >
                  Try again
                </button>
              </div>
            )}
            {!loading && !error && !cities.length && (
              <div className="list-message">
                <Search size={25} />
                <strong>
                  {hasQuery ? "No matching sites" : "No sites announced yet"}
                </strong>
                <span>
                  {hasQuery
                    ? "Try another city or university name."
                    : "Check back for contest locations."}
                </span>
                {hasQuery && (
                  <button
                    type="button"
                    className="retry-button"
                    onClick={() => setQuery("")}
                  >
                    Clear search
                  </button>
                )}
              </div>
            )}
            {!loading &&
              !error &&
              cities.map((city) => {
                const expanded = hasQuery || openCities.has(city.name);
                const cityId = `city-${encodeURIComponent(city.name)}`;
                return (
                  <div
                    className={`city ${expanded ? "is-open" : ""}`}
                    key={city.name}
                  >
                    <button
                      type="button"
                      className="city-toggle"
                      aria-expanded={expanded}
                      aria-controls={cityId}
                      onClick={() => {
                        if (hasQuery) {
                          setQuery("");
                          openCity(city.name);
                        } else toggleCity(city.name);
                        if (hasQuery || !expanded) {
                          setSelectedId(null);
                          map.current?.focusCity(city.name);
                        }
                      }}
                    >
                      <span className="city-name">{city.name}</span>
                      <span className="city-count">{city.sites.length}</span>
                      <ChevronDown size={16} className="city-chevron" />
                    </button>
                    {expanded && (
                      <div id={cityId} className="city-sites">
                        {city.sites.map((site) => (
                          <article
                            id={`site-${site.id}`}
                            key={site.id}
                            className={`site-item ${selectedId === site.id ? "is-selected" : ""}`}
                          >
                            <button
                              type="button"
                              className="site-toggle"
                              aria-expanded={selectedId === site.id}
                              aria-controls={`details-${site.id}`}
                              onClick={() => {
                                if (selectedId === site.id) {
                                  setSelectedId(null);
                                } else {
                                  selectSite(site);
                                  map.current?.focusSite(site);
                                }
                              }}
                            >
                              <span
                                className={`site-bullet ${site.allowRegistration ? "" : "is-closed"}`}
                              />
                              <span className="site-title">
                                <span>{site.name}</span>
                                {(!site.allowRegistration ||
                                  site.onlyForStudents) && (
                                  <span className="site-pills">
                                    {!site.allowRegistration && (
                                      <span className="closed-pill">
                                        Registration closed
                                      </span>
                                    )}
                                    {site.onlyForStudents && (
                                      <span className="student-pill">
                                        <LockKeyhole size={11} /> Only for
                                        students
                                      </span>
                                    )}
                                  </span>
                                )}
                              </span>
                              <ChevronRight
                                size={15}
                                className="site-chevron"
                              />
                            </button>
                            {selectedId === site.id && (
                              <div
                                className="site-details"
                                id={`details-${site.id}`}
                              >
                                <div className="site-address">
                                  <MapPin size={14} />
                                  <address>
                                    {site.address.length
                                      ? site.address.map((line, index) => (
                                          // biome-ignore lint/suspicious/noArrayIndexKey: Address lines are a static ordered list within each keyed site.
                                          <span key={index}>{line}</span>
                                        ))
                                      : "Address details are not available yet."}
                                  </address>
                                </div>
                                {!site.coordinates && (
                                  <p className="coordinate-note">
                                    Map location unavailable.
                                  </p>
                                )}
                                {site.allowRegistration && (
                                  <div className="registration-row">
                                    <a
                                      className="register-button"
                                      href={`https://icpc.global/private/teamRegistration/site/${encodeURIComponent(site.id)}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      Register <ArrowUpRight size={15} />
                                    </a>
                                  </div>
                                )}
                              </div>
                            )}
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </aside>
      </div>
    </section>
  );
}
