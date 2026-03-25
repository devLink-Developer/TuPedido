import type { StyleSpecification } from "maplibre-gl";

function buildFallbackMapStyle(): StyleSpecification {
  return {
    version: 8,
    name: "TuPedido Map",
    sources: {
      osm: {
        type: "raster",
        tiles: [
          "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
          "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
          "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
        ],
        tileSize: 256,
        attribution: "© OpenStreetMap contributors",
      },
    },
    layers: [
      {
        id: "osm",
        type: "raster",
        source: "osm",
      },
    ],
  };
}

export function resolveMapStyle(): string | StyleSpecification {
  const configuredStyle = import.meta.env.VITE_MAP_STYLE_URL?.trim();
  return configuredStyle || buildFallbackMapStyle();
}
