export type AuthFieldErrors = {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

export function validateLoginForm({ email, password }: { email: string; password: string }): AuthFieldErrors {
  const errors: AuthFieldErrors = {};
  if (!email.trim()) {
    errors.email = "Ingresa tu email.";
  } else if (!isValidEmail(email)) {
    errors.email = "Ingresa un email valido.";
  }
  if (!password) {
    errors.password = "Ingresa tu contrasena.";
  }
  return errors;
}

export function validateRegisterForm({
  fullName,
  email,
  password,
  confirmPassword
}: {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}): AuthFieldErrors {
  const errors: AuthFieldErrors = {};
  if (!fullName.trim()) {
    errors.fullName = "Ingresa tu nombre completo.";
  }
  if (!email.trim()) {
    errors.email = "Ingresa tu email.";
  } else if (!isValidEmail(email)) {
    errors.email = "Ingresa un email valido.";
  }
  if (password.length < 6) {
    errors.password = "La contrasena debe tener al menos 6 caracteres.";
  }
  if (!confirmPassword) {
    errors.confirmPassword = "Repite la contrasena.";
  } else if (password !== confirmPassword) {
    errors.confirmPassword = "Las contrasenas no coinciden.";
  }
  return errors;
}

export function hasAuthFieldErrors(errors: AuthFieldErrors): boolean {
  return Object.values(errors).some(Boolean);
}
