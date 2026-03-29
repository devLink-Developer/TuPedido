export const CATALOG_STORES_CHANGED_EVENT = "catalog-stores-changed";
const CATALOG_STORES_CHANGED_STORAGE_KEY = "catalog-stores-changed-at";

export function notifyCatalogStoresChanged() {
  if (typeof window === "undefined") return;

  const nextValue = String(Date.now());
  window.dispatchEvent(new Event(CATALOG_STORES_CHANGED_EVENT));

  try {
    window.localStorage.setItem(CATALOG_STORES_CHANGED_STORAGE_KEY, nextValue);
  } catch {
    // Ignore storage quota or private mode errors. Same-tab listeners already received the event.
  }
}

export function subscribeCatalogStoresChanged(onChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleChange = () => {
    onChange();
  };
  const handleStorage = (event: StorageEvent) => {
    if (event.key === CATALOG_STORES_CHANGED_STORAGE_KEY) {
      onChange();
    }
  };

  window.addEventListener(CATALOG_STORES_CHANGED_EVENT, handleChange);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(CATALOG_STORES_CHANGED_EVENT, handleChange);
    window.removeEventListener("storage", handleStorage);
  };
}
