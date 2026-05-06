import { useState, type FormEvent } from "react";
import { appIcon192 } from "../lib/assets";
import { login, type AuthSession } from "../lib/auth";

interface LoginScreenProps {
  onLogin: (session: AuthSession) => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [username, setUsername] = useState("pipi");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <main className="login-shell">
      <section className="login-panel" aria-label="登录喵语助手">
        <img src={appIcon192} alt="" />
        <h1>喵语助手</h1>
        <p>请输入访问口令。</p>

        <form onSubmit={handleSubmit}>
          <label>
            <span>用户名</span>
            <input value={username} autoComplete="username" onChange={(event) => setUsername(event.target.value)} />
          </label>
          <label>
            <span>密码</span>
            <input
              value={password}
              type="password"
              autoComplete="current-password"
              autoFocus
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error ? <div className="login-error">{error}</div> : null}
          <button type="submit" disabled={isSubmitting || !username.trim() || !password}>
            {isSubmitting ? "登录中..." : "进入"}
          </button>
        </form>
      </section>
    </main>
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      onLogin(await login(username, password));
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "登录失败");
    } finally {
      setIsSubmitting(false);
    }
  }
}
