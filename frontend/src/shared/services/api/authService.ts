import type { AuthResponse } from "../../types";
import { apiRequest } from "./client";

export async function login(email: string, password: string): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export async function register(full_name: string, email: string, password: string): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ full_name, email, password })
  });
}

export async function fetchMe(token: string): Promise<AuthResponse["user"]> {
  return apiRequest<AuthResponse["user"]>("/auth/me", { token });
}

export async function changePassword(
  token: string,
  current_password: string,
  new_password: string
): Promise<AuthResponse["user"]> {
  return apiRequest<AuthResponse["user"]>("/auth/change-password", {
    method: "POST",
    token,
    body: JSON.stringify({ current_password, new_password })
  });
}
