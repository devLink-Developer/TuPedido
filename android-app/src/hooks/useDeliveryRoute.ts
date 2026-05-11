import { useEffect, useMemo, useState } from "react";
import { fetchDirections } from "../services/api";
import type { DirectionsRead, Order, OrderTracking } from "../types/api";
import {
  deliveryRouteDestinationLabel,
  deliveryRouteTitle,
  getDeliveryRoutePoints,
  getRouteDestination,
  getRouteOrigin,
  routeProfileForVehicle
} from "../utils/deliveryRoute";

export function useDeliveryRoute(token: string | null, order: Order | null, tracking: OrderTracking | null) {
  const [directions, setDirections] = useState<DirectionsRead | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);

  const origin = useMemo(() => (order ? getRouteOrigin(order, tracking) : null), [order, tracking]);
  const destination = useMemo(() => (order ? getRouteDestination(order) : null), [order]);
  const points = useMemo(() => (order ? getDeliveryRoutePoints(order, tracking) : []), [order, tracking]);
  const title = order ? deliveryRouteTitle(order) : "Ruta";
  const destinationLabel = order ? deliveryRouteDestinationLabel(order) : "Destino";
  const vehicle = tracking?.assigned_rider_vehicle_type ?? order?.assigned_rider_vehicle_type;

  useEffect(() => {
    if (!token || !order || !origin || !destination) {
      setDirections(null);
      setRouteError(null);
      return;
    }

    let active = true;
    void fetchDirections(token, {
      profile: routeProfileForVehicle(vehicle),
      coordinates: [origin, destination]
    })
      .then((nextDirections) => {
        if (!active) return;
        setDirections(nextDirections);
        setRouteError(null);
      })
      .catch(() => {
        if (!active) return;
        setDirections(null);
        setRouteError("No se pudo calcular la ruta.");
      });

    return () => {
      active = false;
    };
  }, [
    destination?.latitude,
    destination?.longitude,
    order,
    origin?.latitude,
    origin?.longitude,
    token,
    vehicle
  ]);

  return { directions, routeError, points, origin, destination, title, destinationLabel };
}
