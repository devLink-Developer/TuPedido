import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from "react";
import { KE_BRAND_NAME, KE_FAVICON_URL, KE_WORDMARK_POSTER_URL } from "../config/brand";
import { fetchPlatformBranding } from "../services/api";
import type { PlatformBranding } from "../types";

const DEFAULT_BRAND_NAME = KE_BRAND_NAME;
const DEFAULT_LOGO_URL = KE_WORDMARK_POSTER_URL;
const DEFAULT_FAVICON_URL = KE_FAVICON_URL;

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
  const logoUrl = branding?.platform_logo_url || DEFAULT_LOGO_URL;
  const wordmarkUrl = branding?.platform_wordmark_url || logoUrl;
  const faviconUrl = branding?.resolved_favicon_url || DEFAULT_FAVICON_URL;

  useEffect(() => {
    let cancelled = false;

    function loadBranding() {
      fetchPlatformBranding()
        .then((result) => {
          if (!cancelled) setBranding(result);
        })
        .catch(() => {
          if (!cancelled) setBranding(null);
        });
    }

    loadBranding();
    window.addEventListener("platform-branding-updated", loadBranding);
    return () => {
      cancelled = true;
      window.removeEventListener("platform-branding-updated", loadBranding);
    };
  }, []);

  useEffect(() => {
    const iconLink = ensureFaviconLink("icon");
    iconLink.href = faviconUrl;
    iconLink.type = faviconUrl.endsWith(".svg") ? "image/svg+xml" : "image/png";

    const shortcutLink = ensureFaviconLink("shortcut icon");
    shortcutLink.href = faviconUrl;
    shortcutLink.type = iconLink.type;
  }, [faviconUrl]);

  useEffect(() => {
    document.title = DEFAULT_BRAND_NAME;
  }, []);

  const value = useMemo<PlatformBrandingContextValue>(
    () => ({
      branding,
      brandName: DEFAULT_BRAND_NAME,
      logoUrl,
      wordmarkUrl,
      faviconUrl
    }),
    [branding, faviconUrl, logoUrl, wordmarkUrl]
  );

  return <PlatformBrandingContext.Provider value={value}>{children}</PlatformBrandingContext.Provider>;
}

export function usePlatformBranding() {
  return useContext(PlatformBrandingContext);
}
