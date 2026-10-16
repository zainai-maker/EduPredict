import { useCallback, useEffect, useState } from "react";
import { BrowserRouter, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { request } from "./api/client";
import Dashboard from "./components/Dashboard";
import DatasetImports from "./components/DatasetImports";
import LoginForm from "./components/LoginForm";
import StudentPortal from "./components/StudentPortal";
import StudentWorkspace from "./components/StudentWorkspace";
import UserManagement from "./components/UserManagement";
import "./components/Auth.css";
import "./components/RouteLinks.css";

const routeRoles = {
  "/dashboard": ["admin", "teacher", "analyst"],
  "/students": ["admin", "teacher"],
  "/admin/users": ["admin"],
  "/admin/datasets": ["admin"],
  "/my-academics": ["student"],
};
const homeFor = (role) => role === "student" ? "/my-academics" : "/dashboard";

function EduPredictApp() {
  const [session, setSession] = useState(null);
  const [restoring, setRestoring] = useState(true);
  const [logoutError, setLogoutError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  // Restore the user from the server-validated HttpOnly cookie after a reload.
  useEffect(() => {
    let mounted = true;
    request("/auth/me")
      .then((user) => { if (mounted) setSession({ user }); })
      .catch(() => { if (mounted) setSession(null); })
      .finally(() => { if (mounted) setRestoring(false); });
    return () => { mounted = false; };
  }, []);

  const api = useCallback(async (path, init) => {
    try {
      return await request(path, null, init);
    } catch (error) {
      if (error.status === 401) setSession(null);
      throw error;
    }
  }, []);

  async function login(email, password) {
    await request("/auth/login", null, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const user = await request("/auth/me");
    setSession({ user });
    const requested = location.pathname;
    const destination = routeRoles[requested]?.includes(user.role) ? requested : homeFor(user.role);
    navigate(destination, { replace: true });
  }

  async function logout() {
    setLogoutError("");
    try {
      await api("/auth/logout", { method: "POST" });
      setSession(null);
      navigate("/login", { replace: true });
    } catch (error) {
      setLogoutError(`Could not sign out: ${error.message}`);
    }
  }

  if (restoring) return <main className="page-shell"><p role="status">Restoring your session…</p></main>;
  if (!session) return <LoginForm onLogin={login} />;

  const role = session.user.role;
  const canManageStudents = role === "admin" || role === "teacher";
  const navClass = ({ isActive }) => `edp-nav-btn ${isActive ? "is-active" : ""}`;
  const allowed = (path, content) => routeRoles[path].includes(role)
    ? content : <Navigate to={homeFor(role)} replace />;

  return (
    <main className="page-shell">
      <section className="prediction-card edp-app" aria-labelledby="page-title">
        <header className="edp-topbar">
          <div>
            <p className="eyebrow">Student support tool</p>
            <h1 id="page-title">EduPredict</h1>
            <p>Signed in as {session.user.full_name} · {role}</p>
          </div>
          <button type="button" onClick={logout}>Sign out</button>
        </header>

        {logoutError && <p role="alert">{logoutError}</p>}
        <nav className="edp-nav" aria-label="Sections">
          {role !== "student" && <NavLink className={navClass} to="/dashboard">Dashboard</NavLink>}
          {canManageStudents && <NavLink className={navClass} to="/students">Student records &amp; predictions</NavLink>}
          {role === "admin" && <NavLink className={navClass} to="/admin/users">Users &amp; assignments</NavLink>}
          {role === "admin" && <NavLink className={navClass} to="/admin/datasets">Dataset imports</NavLink>}
          {role === "student" && <NavLink className={navClass} to="/my-academics">My academics</NavLink>}
        </nav>

        <Routes>
          <Route path="/" element={<Navigate to={homeFor(role)} replace />} />
          <Route path="/login" element={<Navigate to={homeFor(role)} replace />} />
          <Route path="/dashboard" element={allowed("/dashboard", <Dashboard api={api} showRecent={canManageStudents}
            onManageStudents={() => navigate("/students")} />)} />
          <Route path="/students" element={allowed("/students", <StudentWorkspace api={api} />)} />
          <Route path="/admin/users" element={allowed("/admin/users", <UserManagement api={api} />)} />
          <Route path="/admin/datasets" element={allowed("/admin/datasets", <DatasetImports api={api} />)} />
          <Route path="/my-academics" element={allowed("/my-academics", <StudentPortal api={api} />)} />
          <Route path="*" element={<p role="alert">Page not found.</p>} />
        </Routes>
      </section>
    </main>
  );
}

export default function App() {
  return <BrowserRouter><EduPredictApp /></BrowserRouter>;
}
