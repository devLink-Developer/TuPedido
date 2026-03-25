import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Button } from "../../ui/Button";

const DEFAULT_CENTER = {
  latitude: -34.6037,
  longitude: -58.3816,
};

type Coordinates = {
  latitude: number;
  longitude: number;
};

export function AddressLocationPicker({
  latitude,
  longitude,
  onChange,
}: {
  latitude: number | null;
  longitude: number | null;
  onChange: (coordinates: Coordinates) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialLongitude = longitude ?? DEFAULT_CENTER.longitude;
    const initialLatitude = latitude ?? DEFAULT_CENTER.latitude;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: import.meta.env.VITE_MAP_STYLE_URL ?? "https://demotiles.maplibre.org/style.json",
      center: [initialLongitude, initialLatitude],
      zoom: latitude !== null && longitude !== null ? 15 : 12,
      interactive: true,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
    map.on("click", (event) => {
      setError(null);
      onChangeRef.current({
        latitude: event.lngLat.lat,
        longitude: event.lngLat.lng,
      });
    });

    mapRef.current = map;

    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [latitude, longitude]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (latitude === null || longitude === null) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    if (!markerRef.current) {
      const element = document.createElement("div");
      element.className = "h-5 w-5 rounded-full border-4 border-white bg-brand-500 shadow-float";
      markerRef.current = new maplibregl.Marker({ element }).setLngLat([longitude, latitude]).addTo(map);
    } else {
      markerRef.current.setLngLat([longitude, latitude]);
    }

    map.easeTo({
      center: [longitude, latitude],
      zoom: Math.max(map.getZoom(), 15),
      duration: 350,
      essential: true,
    });
  }, [latitude, longitude]);

  function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      setError("Tu dispositivo no permite obtener la ubicacion actual.");
      return;
    }

    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        onChangeRef.current({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        setLocating(false);
        setError("No se pudo obtener tu ubicacion actual. Seleccionala manualmente en el mapa.");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }

  return (
    <div className="space-y-3 md:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">Ubicacion en mapa</p>
          <p className="text-sm text-zinc-500">Selecciona el punto exacto o usa tu ubicacion actual. Es obligatoria para guardar la direccion.</p>
        </div>
        <Button type="button" onClick={handleUseCurrentLocation} disabled={locating} className="px-3 py-2 text-xs">
          {locating ? "Ubicando..." : "Usar mi ubicacion"}
        </Button>
      </div>

      <div ref={containerRef} className="h-72 overflow-hidden rounded-[24px] border border-black/5" />

      <div className="grid gap-3 rounded-[24px] bg-zinc-50 p-4 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Latitud</p>
          <p className="mt-2 text-sm font-semibold text-ink">{latitude?.toFixed(7) ?? "Sin seleccionar"}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Longitud</p>
          <p className="mt-2 text-sm font-semibold text-ink">{longitude?.toFixed(7) ?? "Sin seleccionar"}</p>
        </div>
      </div>

      {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
