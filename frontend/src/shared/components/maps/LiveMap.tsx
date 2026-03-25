import { useEffect, useRef } from "react";
import maplibregl, { LngLatBounds } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { resolveMapStyle } from "../../utils/mapStyle";

type MarkerPoint = {
  id: string;
  latitude: number;
  longitude: number;
  color: string;
  label: string;
};

export function LiveMap({
  points,
  className = "",
  interactive = false
}: {
  points: MarkerPoint[];
  className?: string;
  interactive?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  useEffect(() => {
    if (!containerRef.current || !points.length) return;
    if (!mapRef.current) {
      mapRef.current = new maplibregl.Map({
        container: containerRef.current,
        style: resolveMapStyle(),
        center: [points[0].longitude, points[0].latitude],
        zoom: 13,
        interactive
      });
      mapRef.current.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
    }

    for (const marker of markersRef.current) marker.remove();
    markersRef.current = points.map((point) => {
      const element = document.createElement("div");
      element.className = "flex h-8 w-8 items-center justify-center rounded-full border-2 border-white shadow-float";
      element.style.background = point.color;
      element.title = point.label;
      element.innerHTML = `<span style="font-size:10px;font-weight:700;color:white">${point.label.slice(0, 1)}</span>`;
      return new maplibregl.Marker({ element }).setLngLat([point.longitude, point.latitude]).addTo(mapRef.current!);
    });

    if (points.length === 1) {
      mapRef.current.flyTo({ center: [points[0].longitude, points[0].latitude], zoom: 14, essential: true });
      return;
    }

    const bounds = new LngLatBounds();
    points.forEach((point) => bounds.extend([point.longitude, point.latitude]));
    mapRef.current.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 500 });
  }, [interactive, points]);

  useEffect(
    () => () => {
      for (const marker of markersRef.current) marker.remove();
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    },
    []
  );

  return <div ref={containerRef} className={["overflow-hidden rounded-[28px]", className].join(" ")} />;
}
