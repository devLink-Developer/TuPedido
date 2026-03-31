import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { PlatformBrandingProvider } from "../shared/providers/PlatformBrandingProvider";

export default function App() {
  return (
    <PlatformBrandingProvider>
      <RouterProvider router={router} />
    </PlatformBrandingProvider>
  );
}
