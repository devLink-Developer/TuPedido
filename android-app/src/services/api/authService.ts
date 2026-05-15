import type { AuthResponse } from "../../types/api";
import { apiRequest } from "./client";

export function login(email: string, password: string): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export function register(full_name: string, email: string, password: string, accepted_terms: boolean): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ full_name, email, password, accepted_terms })
  });
}

export function fetchMe(token: string): Promise<AuthResponse["user"]> {
  return apiRequest<AuthResponse["user"]>("/auth/me", { token });
}

export function changePassword(token: string, current_password: string, new_password: string): Promise<AuthResponse["user"]> {
  return apiRequest<AuthResponse["user"]>("/auth/change-password", {
    method: "POST",
    token,
    body: JSON.stringify({ current_password, new_password })
  });
}

export function deleteAccount(token: string): Promise<void> {
  return apiRequest<void>("/auth/me", {
    method: "DELETE",
    token
  });
}
