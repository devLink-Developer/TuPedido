import { LandingLayout } from "../../app/layouts/LandingLayout";
import { LandingPage } from "./pages/LandingPage";

export function LandingRoute() {
  return (
    <LandingLayout>
      <LandingPage />
    </LandingLayout>
  );
}
