import { describe, expect, it } from "vitest";
import { hasAuthFieldErrors, normalizeEmail, validateLoginForm, validateRegisterForm } from "./authValidation";

describe("auth validation", () => {
  it("normalizes email before submit", () => {
    expect(normalizeEmail(" Cliente@Example.COM ")).toBe("cliente@example.com");
  });

  it("rejects login emails that are not syntactically valid", () => {
    expect(validateLoginForm({ email: "cliente@", password: "secret123" }).email).toBe("Ingresa un email valido.");
  });

  it("requires matching register passwords", () => {
    const errors = validateRegisterForm({
      fullName: "Cliente Demo",
      email: "cliente@test.com",
      password: "secret123",
      confirmPassword: "secret124"
    });

    expect(errors.confirmPassword).toBe("Las contrasenas no coinciden.");
    expect(hasAuthFieldErrors(errors)).toBe(true);
  });

  it("accepts a complete register form", () => {
    const errors = validateRegisterForm({
      fullName: "Cliente Demo",
      email: "cliente@test.com",
      password: "secret123",
      confirmPassword: "secret123"
    });

    expect(hasAuthFieldErrors(errors)).toBe(false);
  });
});
