import type { Role } from "./common";

export type AuthUser = {
  id: number;
  full_name: string;
  email: string;
  role: Role;
  is_active: boolean;
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  user: AuthUser;
};
