const encodedDefaultApiBase = "aHR0cHM6Ly9waXBpY2F0Lnhpbg==";

export function apiEndpoint(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${apiBaseUrl()}${normalizedPath}`;
}

function apiBaseUrl() {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim() || decodeDefaultApiBase();
  return configured.replace(/\/+$/, "");
}

function decodeDefaultApiBase() {
  try {
    return atob(encodedDefaultApiBase);
  } catch {
    return "";
  }
}
