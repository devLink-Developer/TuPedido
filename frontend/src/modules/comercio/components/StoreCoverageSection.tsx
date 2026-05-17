import { useEffect, useMemo, useRef } from "react";
import { MapPin, Trash2, Undo2 } from "lucide-react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { CoveragePoint, MerchantStore, StoreDeliverySettings } from "../../../shared/types";
import { Button } from "../../../shared/ui/Button";
import { resolveMapStyle } from "../../../shared/utils/mapStyle";

const DEFAULT_CENTER = { latitude: -34.5627, longitude: -58.4565 };

function isValidPoint(point: CoveragePoint | null | undefined) {
  return (
    point !== null &&
    point !== undefined &&
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    point.latitude >= -90 &&
    point.latitude <= 90 &&
    point.longitude >= -180 &&
    point.longitude <= 180
  );
}

function normalizePoints(points: CoveragePoint[] | null | undefined) {
  return (points ?? []).filter(isValidPoint).map((point) => ({
    latitude: Number(point.latitude.toFixed(7)),
    longitude: Number(point.longitude.toFixed(7)),
  }));
}

export function hasCoveragePolygon(points: CoveragePoint[] | null | undefined) {
  return normalizePoints(points ?? []).length >= 3;
}

export function hasAnyCoverageArea(settings: StoreDeliverySettings) {
  const hasDeliveryArea = settings.delivery_enabled && hasCoveragePolygon(settings.delivery_area_polygon);
  const pickupPolygon = settings.pickup_area_uses_delivery_area
    ? settings.delivery_area_polygon
    : settings.pickup_area_polygon;
  const hasPickupArea = settings.pickup_enabled && hasCoveragePolygon(pickupPolygon);
  return hasDeliveryArea || hasPickupArea;
}

function buildPolygonFeature(points: CoveragePoint[]) {
  const normalized = normalizePoints(points);
  const coordinates =
    normalized.length >= 3
      ? [[...normalized.map((point) => [point.longitude, point.latitude]), [normalized[0].longitude, normalized[0].latitude]]]
      : [];

  return {
    type: "FeatureCollection" as const,
    features: coordinates.length
      ? [
          {
            type: "Feature" as const,
            properties: {},
            geometry: {
              type: "Polygon" as const,
              coordinates,
            },
          },
        ]
      : [],
  };
}

function resolveInitialCenter(points: CoveragePoint[], fallback: CoveragePoint | null): CoveragePoint {
  const normalized = normalizePoints(points);
  if (normalized.length) {
    const sum = normalized.reduce(
      (current, point) => ({
        latitude: current.latitude + point.latitude,
        longitude: current.longitude + point.longitude,
      }),
      { latitude: 0, longitude: 0 }
    );
    return {
      latitude: sum.latitude / normalized.length,
      longitude: sum.longitude / normalized.length,
    };
  }
  return fallback && isValidPoint(fallback) ? fallback : DEFAULT_CENTER;
}

function CoveragePolygonEditor({
  title,
  description,
  points,
  fallbackCenter,
  disabled = false,
  onChange,
}: {
  title: string;
  description: string;
  points: CoveragePoint[];
  fallbackCenter: CoveragePoint | null;
  disabled?: boolean;
  onChange: (points: CoveragePoint[]) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const pointsRef = useRef(points);
  const onChangeRef = useRef(onChange);
  const disabledRef = useRef(disabled);
  const pointerStartRef = useRef<{ x: number; y: number; ignored: boolean } | null>(null);
  const initialCenterRef = useRef(resolveInitialCenter(points, fallbackCenter));
  const sourceId = useMemo(() => `coverage-${title.toLowerCase().replace(/\W+/g, "-")}`, [title]);
  const normalizedPoints = useMemo(() => normalizePoints(points), [points]);

  pointsRef.current = points;
  onChangeRef.current = onChange;
  disabledRef.current = disabled;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const container = containerRef.current;
    const center = initialCenterRef.current;
    const map = new maplibregl.Map({
      container,
      style: resolveMapStyle(),
      center: [center.longitude, center.latitude],
      zoom: 13,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");

    function isIgnoredPointerTarget(target: EventTarget | null) {
      if (!(target instanceof Element)) return false;
      return Boolean(target.closest(".maplibregl-ctrl") || target.closest("[data-coverage-marker='true']"));
    }

    function addPointFromClientPosition(clientX: number, clientY: number) {
      if (disabledRef.current) return;
      const bounds = container.getBoundingClientRect();
      const lngLat = map.unproject([clientX - bounds.left, clientY - bounds.top]);
      onChangeRef.current([
        ...normalizePoints(pointsRef.current),
        {
          latitude: Number(lngLat.lat.toFixed(7)),
          longitude: Number(lngLat.lng.toFixed(7)),
        },
      ]);
    }

    function handlePointerDown(event: PointerEvent) {
      pointerStartRef.current = {
        x: event.clientX,
        y: event.clientY,
        ignored: isIgnoredPointerTarget(event.target),
      };
    }

    function handlePointerUp(event: PointerEvent) {
      const start = pointerStartRef.current;
      pointerStartRef.current = null;
      if (!start || start.ignored || isIgnoredPointerTarget(event.target)) return;
      const movement = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      if (movement > 6) return;
      addPointFromClientPosition(event.clientX, event.clientY);
    }

    container.addEventListener("pointerdown", handlePointerDown);
    container.addEventListener("pointerup", handlePointerUp);
    mapRef.current = map;
    return () => {
      container.removeEventListener("pointerdown", handlePointerDown);
      container.removeEventListener("pointerup", handlePointerUp);
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const currentMap = map;

    function drawPolygon() {
      const data = buildPolygonFeature(points);
      const source = currentMap.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
      if (source) {
        source.setData(data);
      } else {
        currentMap.addSource(sourceId, { type: "geojson", data });
        currentMap.addLayer({
          id: `${sourceId}-fill`,
          type: "fill",
          source: sourceId,
          paint: {
            "fill-color": "#10b981",
            "fill-opacity": 0.18,
          },
        });
        currentMap.addLayer({
          id: `${sourceId}-line`,
          type: "line",
          source: sourceId,
          paint: {
            "line-color": "#047857",
            "line-width": 2,
          },
        });
      }
    }

    if (currentMap.loaded()) {
      drawPolygon();
    } else {
      currentMap.once("load", drawPolygon);
    }
  }, [points, sourceId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = normalizedPoints.map((point, index) => {
      const element = document.createElement("button");
      element.type = "button";
      element.dataset.coverageMarker = "true";
      element.className =
        "flex h-7 w-7 cursor-grab items-center justify-center rounded-full border-2 border-white bg-emerald-600 text-[11px] font-bold text-white shadow-lg active:cursor-grabbing";
      element.textContent = String(index + 1);
      const marker = new maplibregl.Marker({ element, draggable: !disabled })
        .setLngLat([point.longitude, point.latitude])
        .addTo(map);
      marker.on("dragend", () => {
        const lngLat = marker.getLngLat();
        const nextPoints = [...pointsRef.current];
        nextPoints[index] = {
          latitude: Number(lngLat.lat.toFixed(7)),
          longitude: Number(lngLat.lng.toFixed(7)),
        };
        onChangeRef.current(nextPoints);
      });
      return marker;
    });
  }, [disabled, normalizedPoints]);

  return (
    <div className="space-y-3 rounded border border-black/10 bg-zinc-50 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold text-ink">
            <MapPin className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            {title}
          </p>
          <p className="mt-1 text-sm text-zinc-600">{description}</p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            aria-label={`Deshacer ultimo vertice de ${title}`}
            className="px-3 py-2 text-xs"
            disabled={disabled || !points.length}
            onClick={() => onChange(points.slice(0, -1))}
          >
            <Undo2 className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            aria-label={`Limpiar ${title}`}
            className="bg-rose-600 px-3 py-2 text-xs shadow-none"
            disabled={disabled || !points.length}
            onClick={() => onChange([])}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
      <div ref={containerRef} className="h-56 overflow-hidden rounded border border-black/10 bg-white lg:h-64" />
      <p className={hasCoveragePolygon(points) ? "text-sm text-emerald-700" : "text-sm text-amber-700"}>
        {hasCoveragePolygon(points)
          ? `${normalizedPoints.length} vertices definidos.`
          : "Marca al menos 3 vertices para habilitar esta zona."}
      </p>
    </div>
  );
}

export function StoreCoverageSection({
  store,
  onChange,
}: {
  store: MerchantStore;
  onChange: (settings: StoreDeliverySettings) => void;
}) {
  const settings = store.delivery_settings;
  const fallbackCenter =
    store.latitude !== null && store.longitude !== null
      ? { latitude: store.latitude, longitude: store.longitude }
      : null;

  function updateSettings(next: Partial<StoreDeliverySettings>) {
    onChange({ ...settings, ...next });
  }

  return (
    <section className="space-y-3 rounded border border-black/5 bg-white p-3 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">Zonas de alcance</p>
        <h2 className="mt-1.5 text-lg font-bold text-ink">Poligonos de venta</h2>
        <p className="mt-1.5 text-sm text-zinc-600">
          Define las zonas donde aceptas pedidos. Sin una zona valida para una modalidad habilitada, el local no podra recibir pedidos.
        </p>
      </div>

      <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
        <p className="font-semibold">Como marcar los poligonos</p>
        <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <p>Haz clic sobre el mapa para agregar vertices alrededor de tu zona.</p>
          <p>Marca al menos 3 puntos; el area se cierra sola entre el ultimo y el primero.</p>
          <p>Arrastra cualquier punto numerado para corregir el borde del alcance.</p>
          <p>Usa deshacer o limpiar si necesitas volver a dibujar, y luego guarda los cambios.</p>
        </div>
      </div>

      <CoveragePolygonEditor
        title="Zona de envio"
        description="Haz clic en el mapa para agregar vertices; arrastra un punto para corregirlo."
        points={settings.delivery_area_polygon}
        fallbackCenter={fallbackCenter}
        onChange={(points) => updateSettings({ delivery_area_polygon: normalizePoints(points) })}
      />

      <label className="flex items-start gap-3 rounded border border-black/10 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
        <input
          type="checkbox"
          checked={settings.pickup_area_uses_delivery_area}
          onChange={(event) => updateSettings({ pickup_area_uses_delivery_area: event.target.checked })}
          className="mt-1 h-4 w-4"
        />
        <span>
          <span className="block font-semibold text-ink">Usar la misma zona de envio para retiro</span>
          <span className="mt-1 block text-zinc-600">El retiro quedara disponible solo para clientes dentro de la zona de envio.</span>
        </span>
      </label>

      {!settings.pickup_area_uses_delivery_area ? (
        <CoveragePolygonEditor
          title="Zona de retiro"
          description="Define desde donde permites que un cliente genere pedidos para retirar."
          points={settings.pickup_area_polygon}
          fallbackCenter={fallbackCenter}
          onChange={(points) => updateSettings({ pickup_area_polygon: normalizePoints(points) })}
        />
      ) : null}
    </section>
  );
}
