export function publicAsset(path: string) {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
}

export const appIcon192 = publicAsset("icon-192.png");
