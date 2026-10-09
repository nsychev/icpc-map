import L from "leaflet";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import "leaflet.markercluster";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import { LocateFixed, Minus, Plus } from "lucide-react";
import type { Site } from "./sites";

export interface MapView {
  latitude: number;
  longitude: number;
  zoom: number;
}
export const DEFAULT_MAP_VIEW: MapView = {
  latitude: 48.2,
  longitude: 67.3,
  zoom: 4.5,
};
export interface SiteMapHandle {
  focusSite: (site: Site) => void;
  focusCity: (city: string) => void;
}

interface Props {
  sites: Site[];
  selectedId: string | null;
  initialView: MapView;
  cityZoom: number;
  onSelect: (site: Site) => void;
  onCityFocus: (city: string) => void;
}

function pinIcon(site: Site, selected = false) {
  return L.divIcon({
    className: `site-pin ${site.allowRegistration ? "" : "is-closed"} ${selected ? "is-selected" : ""}`,
    html: '<span class="pin-shape"><span></span></span>',
    iconSize: [28, 36],
    iconAnchor: [14, 34],
    tooltipAnchor: [0, -30],
  });
}

export const SiteMap = forwardRef<SiteMapHandle, Props>(
  function SiteMap(props, ref) {
    const container = useRef<HTMLDivElement>(null);
    const map = useRef<L.Map | null>(null);
    const cluster = useRef<L.MarkerClusterGroup | null>(null);
    const markers = useRef(new Map<string, L.Marker>());
    const current = useRef(props);
    current.current = props;

    useImperativeHandle(
      ref,
      () => ({
        focusCity(city) {
          const coordinates = current.current.sites
            .filter((site) => site.city === city)
            .flatMap((site) => (site.coordinates ? [site.coordinates] : []));
          if (!map.current || !coordinates.length) return;
          map.current.fitBounds(L.latLngBounds(coordinates), {
            padding: [48, 48],
            maxZoom: 12,
          });
        },
        focusSite(site) {
          const marker = markers.current.get(site.id);
          if (!marker || !map.current || !cluster.current) return;
          map.current.setView(
            marker.getLatLng(),
            Math.max(14, map.current.getZoom()),
            { animate: false },
          );
          // Also reveals coincident markers by spiderfying their cluster.
          cluster.current.zoomToShowLayer(marker, () => marker.openTooltip());
        },
      }),
      [],
    );

    useEffect(() => {
      if (!container.current) return;
      const view = current.current.initialView;
      const instance = L.map(container.current, {
        center: [view.latitude, view.longitude],
        zoom: view.zoom,
        zoomSnap: 0.5,
        minZoom: 2,
        maxZoom: 19,
        zoomControl: false,
        scrollWheelZoom: true,
      });
      map.current = instance;
      instance.attributionControl.setPrefix(false);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(instance);
      cluster.current = L.markerClusterGroup({
        maxClusterRadius: 42,
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        iconCreateFunction: (group) =>
          L.divIcon({
            html: `<span>${group.getChildCount()}</span>`,
            className: "site-cluster",
            iconSize: [42, 42],
          }),
      }).addTo(instance);
      let previousCity: string | null = null;
      const revealCity = () => {
        if (instance.getZoom() < current.current.cityZoom) {
          previousCity = null;
          return;
        }
        const center = instance.getCenter();
        const bounds = instance.getBounds();
        let closest: Site | undefined;
        let distance = Infinity;
        for (const site of current.current.sites) {
          if (!site.coordinates || !bounds.contains(site.coordinates)) continue;
          const candidate = center.distanceTo(site.coordinates);
          if (candidate < distance) {
            closest = site;
            distance = candidate;
          }
        }
        const city = closest?.city ?? null;
        if (city && city !== previousCity) current.current.onCityFocus(city);
        previousCity = city;
      };
      instance.on("moveend", revealCity);
      const observer = new ResizeObserver(() => instance.invalidateSize());
      observer.observe(container.current);
      return () => {
        observer.disconnect();
        instance.remove();
        map.current = null;
        cluster.current = null;
        markers.current.clear();
      };
    }, []);

    useEffect(() => {
      const group = cluster.current;
      if (!group) return;
      group.clearLayers();
      markers.current.clear();
      for (const site of props.sites) {
        if (!site.coordinates) continue;
        const marker = L.marker(site.coordinates, {
          icon: pinIcon(site),
          title: site.name,
          alt: site.name,
        });
        // API text is inserted as text, never as tooltip HTML.
        const label = document.createElement("span");
        label.textContent = site.name;
        marker.bindTooltip(label, { direction: "top" });
        marker.on("click", () => current.current.onSelect(site));
        markers.current.set(site.id, marker);
        group.addLayer(marker);
      }
    }, [props.sites]);

    useEffect(() => {
      for (const site of props.sites) {
        const selected = site.id === props.selectedId;
        const marker = markers.current.get(site.id);
        marker
          ?.setIcon(pinIcon(site, selected))
          .setZIndexOffset(selected ? 1000 : 0);
        if (!selected) marker?.closeTooltip();
      }
    }, [props.selectedId, props.sites]);

    function reset() {
      const view = current.current.initialView;
      map.current?.setView([view.latitude, view.longitude], view.zoom);
    }

    return (
      <div className="map-panel">
        <div ref={container} className="site-map" />
        <div className="map-controls">
          <button
            type="button"
            onClick={() => map.current?.zoomIn()}
            aria-label="Zoom in"
          >
            <Plus size={19} />
          </button>
          <button
            type="button"
            onClick={() => map.current?.zoomOut()}
            aria-label="Zoom out"
          >
            <Minus size={19} />
          </button>
          <button
            type="button"
            className="reset-map"
            onClick={reset}
            aria-label="Reset map"
            title="Reset map"
          >
            <LocateFixed size={19} />
          </button>
        </div>
      </div>
    );
  },
);
