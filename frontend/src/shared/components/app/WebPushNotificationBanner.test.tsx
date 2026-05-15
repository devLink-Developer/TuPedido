import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WebPushNotificationBanner } from "./WebPushNotificationBanner";

const webPushMock = vi.hoisted(() => ({
  subscribe: vi.fn(),
  state: {
    available: true,
    error: null as string | null,
    loading: false,
    permission: "default" as NotificationPermission | "unsupported",
    subscribe: vi.fn(),
    subscribed: false,
    supported: true
  }
}));

vi.mock("../../hooks", () => ({
  useWebPushSubscription: () => webPushMock.state
}));

describe("WebPushNotificationBanner", () => {
  beforeEach(() => {
    webPushMock.subscribe.mockReset();
    webPushMock.state = {
      available: true,
      error: null,
      loading: false,
      permission: "default",
      subscribe: webPushMock.subscribe,
      subscribed: false,
      supported: true
    };
  });

  it("muestra el banner autenticado y activa notificaciones solo con accion explicita", async () => {
    render(<WebPushNotificationBanner token="token" userId={7} />);

    expect(screen.getByText("Notificaciones")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /activar avisos/i }));

    expect(webPushMock.subscribe).toHaveBeenCalledTimes(1);
  });

  it("oculta el banner si el permiso esta denegado", () => {
    webPushMock.state.permission = "denied";

    render(<WebPushNotificationBanner token="token" userId={7} />);

    expect(screen.queryByText("Notificaciones")).not.toBeInTheDocument();
  });

  it("recuerda el descarte por usuario", async () => {
    render(<WebPushNotificationBanner token="token" userId={7} />);

    await userEvent.click(screen.getByRole("button", { name: /mas tarde/i }));

    expect(screen.queryByText("Notificaciones")).not.toBeInTheDocument();
    expect(window.localStorage.getItem("kepedimos.web-push-banner.dismissed.7")).toBe("true");
  });
});
