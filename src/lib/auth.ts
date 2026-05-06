const API_BASE_URL = "https://pipicat.xin";
const AUTH_STORAGE_KEY = "miaoyu-assistant-auth-v1";
const expectedUsername = "pipi";
const expectedLocalHash = "eefda96c0e9132ad8d11813904ec53513d0d2acfb43393f67ffb53fa193798ca";
const fallbackSessionDays = 30;

export interface AuthSession {
  username: string;
  token: string;
  expiresAt: number;
  source: "server" | "local";
}

export async function login(username: string, password: string): Promise<AuthSession> {
  const normalizedUsername = username.trim();
  const serverSession = await tryServerLogin(normalizedUsername, password);
  if (serverSession) {
    saveAuthSession(serverSession);
    return serverSession;
  }

  const localHash = await credentialHash(normalizedUsername, password);
  if (normalizedUsername !== expectedUsername || localHash !== expectedLocalHash) {
    throw new Error("用户名或密码不正确");
  }

  const session: AuthSession = {
    username: normalizedUsername,
    token: `local:${localHash}`,
    expiresAt: Date.now() + fallbackSessionDays * 24 * 60 * 60 * 1000,
    source: "local"
  };
  saveAuthSession(session);
  return session;
}

export function loadAuthSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Partial<AuthSession>;
    if (!session.username || !session.token || !session.expiresAt || session.expiresAt <= Date.now()) {
      clearAuthSession();
      return null;
    }
    return session as AuthSession;
  } catch {
    clearAuthSession();
    return null;
  }
}

export function saveAuthSession(session: AuthSession) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function clearAuthSession() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

async function tryServerLogin(username: string, password: string): Promise<AuthSession | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ username, password })
    });

    if (response.status === 404 || response.status === 503) return null;
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || "登录失败");
    }

    if (!payload.token || !payload.expiresAt) return null;
    return {
      username,
      token: payload.token,
      expiresAt: Number(payload.expiresAt),
      source: "server"
    };
  } catch (error) {
    if (error instanceof TypeError) return null;
    throw error;
  }
}

async function credentialHash(username: string, password: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${username}:${password}`));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
