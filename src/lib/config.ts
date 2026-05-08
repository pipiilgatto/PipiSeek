export function apiEndpoint(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  return configured ? `${configured.replace(/\/+$/, "")}${normalizedPath}` : normalizedPath;
}
