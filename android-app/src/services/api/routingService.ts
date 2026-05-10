import type { DirectionsRead, DirectionsRequest } from "../../types/api";
import { apiRequest } from "./client";

export function fetchDirections(token: string, payload: DirectionsRequest): Promise<DirectionsRead> {
  return apiRequest<DirectionsRead>("/routing/directions", {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}
