import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Button } from "../../ui/Button";
import { resolveMapStyle } from "../../utils/mapStyle";
import { DEFAULT_ADDRESS_COORDINATES } from "../../utils/defaultAddressCoordinates";

type Coordinates = {
  latitude: number;
  longitude: number;
};

export type AddressLocationChangeSource = "map" | "current_location";

export function AddressLocationPicker({
  latitude,
  longitude,
  fallbackLatitude,
  fallbackLongitude,
  onChange,
}: {
  latitude: number | null;
  longitude: number | null;
  fallbackLatitude?: number | null;
  fallbackLongitude?: number | null;
  onChange: (coordinates: Coordinates, source: AddressLocationChangeSource) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canUseCurrentLocation =
    typeof window !== "undefined" && window.isSecureContext && typeof navigator !== "undefined" && Boolean(navigator.geolocation);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialLongitude = longitude ?? fallbackLongitude ?? DEFAULT_ADDRESS_COORDINATES.longitude;
    const initialLatitude = latitude ?? fallbackLatitude ?? DEFAULT_ADDRESS_COORDINATES.latitude;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: resolveMapStyle(),
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
      }, "map");
    });

    mapRef.current = map;

    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [fallbackLatitude, fallbackLongitude, latitude, longitude]);

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

  useEffect(() => {
    const map = mapRef.current;
    if (!map || latitude !== null || longitude !== null) return;

    const nextLongitude = fallbackLongitude ?? DEFAULT_ADDRESS_COORDINATES.longitude;
    const nextLatitude = fallbackLatitude ?? DEFAULT_ADDRESS_COORDINATES.latitude;
    map.easeTo({
      center: [nextLongitude, nextLatitude],
      zoom: fallbackLatitude != null && fallbackLongitude != null ? 13 : 12,
      duration: 350,
      essential: true,
    });
  }, [fallbackLatitude, fallbackLongitude, latitude, longitude]);

  function handleUseCurrentLocation() {
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setError("Tu navegador solo permite usar la ubicacion actual desde HTTPS o localhost. Usa el mapa o geolocaliza por direccion.");
      return;
    }

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
        }, "current_location");
      },
      (locationError) => {
        setLocating(false);
        if (locationError.code === locationError.PERMISSION_DENIED) {
          setError("El navegador bloqueo tu ubicacion actual. Habilitala o usa CP, localidad, calle y altura para ubicarte en el mapa.");
          return;
        }
        if (locationError.code === locationError.TIMEOUT) {
          setError("La ubicacion actual tardo demasiado. Reintenta o marca el punto manualmente en el mapa.");
          return;
        }
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
        <Button type="button" onClick={handleUseCurrentLocation} disabled={locating || !canUseCurrentLocation} className="px-3 py-2 text-xs">
          {locating ? "Ubicando..." : "Usar mi ubicacion"}
        </Button>
      </div>

      {!canUseCurrentLocation ? (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          La ubicacion actual requiere HTTPS o localhost. Mientras tanto usa el CP, la localidad, calle y altura para ubicar la direccion.
        </p>
      ) : null}

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
