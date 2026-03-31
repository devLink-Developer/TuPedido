import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from "react";
import { fetchPlatformBranding } from "../services/api";
import type { PlatformBranding } from "../types";

const DEFAULT_BRAND_NAME = "Kepedimos";
const DEFAULT_LOGO_URL = "/icons/icon-192.svg";
const DEFAULT_FAVICON_URL = "/favicon.svg";

type PlatformBrandingContextValue = {
  branding: PlatformBranding | null;
  brandName: string;
  logoUrl: string;
  wordmarkUrl: string | null;
  faviconUrl: string;
};

const PlatformBrandingContext = createContext<PlatformBrandingContextValue>({
  branding: null,
  brandName: DEFAULT_BRAND_NAME,
  logoUrl: DEFAULT_LOGO_URL,
  wordmarkUrl: null,
  faviconUrl: DEFAULT_FAVICON_URL
});

function ensureFaviconLink(rel: string) {
  const selector = `link[rel='${rel}']`;
  let link = document.head.querySelector<HTMLLinkElement>(selector);
  if (!link) {
    link = document.createElement("link");
    link.rel = rel;
    document.head.appendChild(link);
  }
  return link;
}

export function PlatformBrandingProvider({ children }: PropsWithChildren) {
  const [branding, setBranding] = useState<PlatformBranding | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPlatformBranding()
      .then((result) => {
        if (!cancelled) {
          setBranding(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBranding(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const faviconUrl = branding?.resolved_favicon_url || DEFAULT_FAVICON_URL;

  useEffect(() => {
    const iconLink = ensureFaviconLink("icon");
    iconLink.href = faviconUrl;
    iconLink.type = faviconUrl.endsWith(".svg") ? "image/svg+xml" : "image/png";

    const shortcutLink = ensureFaviconLink("shortcut icon");
    shortcutLink.href = faviconUrl;
    shortcutLink.type = iconLink.type;
  }, [faviconUrl]);

  const value = useMemo<PlatformBrandingContextValue>(
    () => ({
      branding,
      brandName: DEFAULT_BRAND_NAME,
      logoUrl: branding?.platform_logo_url || DEFAULT_LOGO_URL,
      wordmarkUrl: branding?.platform_wordmark_url || null,
      faviconUrl
    }),
    [branding, faviconUrl]
  );

  return <PlatformBrandingContext.Provider value={value}>{children}</PlatformBrandingContext.Provider>;
}

export function usePlatformBranding() {
  return useContext(PlatformBrandingContext);
}
