import { useState } from "react";

export default function LoginForm({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await onLogin(email, password);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="prediction-card edp-auth" aria-labelledby="login-title">
        <p className="eyebrow">EduPredict · Secure access</p>
        <h1 id="login-title">Sign in</h1>
        <p>Use the account provided by your administrator.</p>
        <form onSubmit={submit}>
          <label className="field"><span>Email</span>
            <input type="email" autoComplete="username" value={email} required
              onChange={(e) => setEmail(e.target.value)} /></label>
          <label className="field"><span>Password</span>
            <input type="password" autoComplete="current-password" value={password} required
              onChange={(e) => setPassword(e.target.value)} /></label>
          <button type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        </form>
        {error && <p role="alert" className="edp-error">{error}</p>}
      </section>
    </main>
  );
}
