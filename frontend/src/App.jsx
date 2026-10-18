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

const routeRoles = {
  "/dashboard": ["admin", "teacher", "analyst"],
  "/students": ["admin", "teacher"],
  "/admin/users": ["admin"],
  "/admin/datasets": ["admin"],
  "/my-academics": ["student"],
};
const homeFor = (role) => role === "student" ? "/my-academics" : "/dashboard";

function NavigationIcon({ name }) {
  const paths = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    students: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><path d="M17 11l2 2 4-4M17 18h6" /></>,
    datasets: <><path d="M12 3v12" /><path d="m7 8 5-5 5 5" /><path d="M5 21h14a2 2 0 0 0 2-2v-3" /><path d="M3 16v3a2 2 0 0 0 2 2" /></>,
    academic: <><path d="m3 6 9-3 9 3-9 3-9-3Z" /><path d="M7 8.5v4.2c0 1.4 2.2 2.7 5 2.7s5-1.3 5-2.7V8.5" /><path d="M21 7v6" /></>,
    logout: <><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /><path d="M21 19V5a2 2 0 0 0-2-2h-6" /></>,
  };
  return <svg className="size-[1.08rem] shrink-0 fill-none stroke-current stroke-[1.75] [stroke-linecap:round] [stroke-linejoin:round]" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function EduPredictApp() {
  const [session, setSession] = useState(null);
  const [restoring, setRestoring] = useState(true);
  const [logoutError, setLogoutError] = useState("");
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
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
    setShowLogoutDialog(false);
    setSession({ user });
    const requested = location.pathname;
    const destination = routeRoles[requested]?.includes(user.role) ? requested : homeFor(user.role);
    navigate(destination, { replace: true });
  }

  async function logout() {
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    setShowLogoutDialog(false);
    setLogoutError("");
    try {
      await api("/auth/logout", { method: "POST" });
      setShowLogoutDialog(false);
      setSession(null);
      navigate("/login", { replace: true });
    } catch (error) {
      setLogoutError(`Could not sign out: ${error.message}`);
      setShowLogoutDialog(false);
    } finally {
      setIsLoggingOut(false);
    }
  }

  useEffect(() => {
    if (!showLogoutDialog || isLoggingOut) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setShowLogoutDialog(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showLogoutDialog, isLoggingOut]);

  if (restoring) return <main className="page-shell"><p role="status">Restoring your session…</p></main>;
  if (!session) return <LoginForm onLogin={login} />;

  const role = session.user.role;
  const canManageStudents = role === "admin" || role === "teacher";
  const navClass = ({ isActive }) => `flex min-h-10 shrink-0 items-center gap-3 rounded-[7px] px-3 py-2 text-sm font-semibold no-underline transition md:shrink ${isActive ? "bg-[#d8e9df] text-[#123D2C]" : "text-[#536159] hover:bg-[#EAF0E9] hover:text-[#123D2C]"}`;
  const allowed = (path, content) => routeRoles[path].includes(role)
    ? content : <Navigate to={homeFor(role)} replace />;

  return (
    <main className="flex min-h-screen flex-col bg-[#FBF9F3] md:flex-row">
      <aside className="sticky top-0 flex min-h-0 shrink-0 flex-col border-b border-[#D8DED6] bg-white p-2 md:min-h-screen md:basis-[250px] md:border-r md:border-b-0 md:p-3.5" aria-label="Application navigation">
        <div className="hidden items-center gap-2 px-2 pb-7 pt-1 text-[1.05rem] font-extrabold tracking-[-.02em] text-[#123D2C] md:flex">
          <span className="grid size-7 place-items-center rounded-md bg-[#123D2C] text-sm text-white shadow-[inset_0_0_0_1px_rgb(255_255_255_/_20%)]">E</span>
          <span>EduPredict</span>
        </div>

        <p className="mb-2 hidden px-2 text-[.67rem] font-extrabold uppercase tracking-[.07em] text-[#768078] md:block">Main menu</p>
        <nav className="flex gap-1 overflow-x-auto pb-px md:grid md:overflow-visible" aria-label="Sections">
          {role !== "student" && <NavLink className={navClass} to="/dashboard"><NavigationIcon name="dashboard" />Dashboard</NavLink>}
          {canManageStudents && <NavLink className={navClass} to="/students"><NavigationIcon name="students" />Student records</NavLink>}
          {role === "admin" && <NavLink className={navClass} to="/admin/users"><NavigationIcon name="users" />Users &amp; assignments</NavLink>}
          {role === "admin" && <NavLink className={navClass} to="/admin/datasets"><NavigationIcon name="datasets" />Dataset imports</NavLink>}
          {role === "student" && <NavLink className={navClass} to="/my-academics"><NavigationIcon name="academic" />My academics</NavLink>}
        </nav>

        <div className="mt-auto hidden items-center gap-2 border-t border-[#e7ebe5] px-2 pb-0 pt-3 md:flex">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#8B1E25] text-xs font-extrabold text-white" aria-hidden="true">{session.user.full_name.charAt(0).toUpperCase()}</span>
          <div className="grid min-w-0 gap-px"><strong className="overflow-hidden text-sm text-ellipsis whitespace-nowrap text-[#24342c]">{session.user.full_name}</strong><span className="text-xs capitalize text-[#778178]">{role}</span></div>
        </div>
      </aside>

      <section className="min-w-0 flex-1">
        <header className="flex min-h-16 items-center border-b border-[#D8DED6] bg-white/80 px-4 md:px-10">
          <div className="flex items-center gap-2 text-[.95rem] font-extrabold tracking-[-.02em] text-[#123D2C] md:hidden"><span className="grid size-6 place-items-center rounded-md bg-[#123D2C] text-xs text-white">E</span> EduPredict</div>
          <p className="m-0 hidden text-sm text-[#66736b] md:block">Student success workspace</p>
          <button type="button" className="ml-auto inline-flex items-center gap-2 rounded-[7px] border-0 bg-transparent px-2.5 py-2 text-xs font-bold text-[#536159] hover:bg-[#f9eeee] hover:text-[#8B1E25]" onClick={() => setShowLogoutDialog(true)}><NavigationIcon name="logout" /> <span>Sign out</span></button>
        </header>

        <div className="mx-auto w-full max-w-[1380px] p-4 md:p-8 lg:p-10">
          {logoutError && <p role="alert" className="edp-error">{logoutError}</p>}
          <Routes>
            <Route path="/" element={<Navigate to={homeFor(role)} replace />} />
            <Route path="/login" element={<Navigate to={homeFor(role)} replace />} />
            <Route path="/dashboard" element={allowed("/dashboard", <Dashboard api={api} showRecent={canManageStudents}
              userName={session.user.full_name} onManageStudents={() => navigate("/students")} />)} />
            <Route path="/students" element={allowed("/students", <StudentWorkspace api={api} role={role}/>)} />
            <Route path="/admin/users" element={allowed("/admin/users", <UserManagement api={api} />)} />
            <Route path="/admin/datasets" element={allowed("/admin/datasets", <DatasetImports api={api} />)} />
            <Route path="/my-academics" element={allowed("/my-academics", <StudentPortal api={api} />)} />
            <Route path="*" element={<p role="alert">Page not found.</p>} />
          </Routes>
        </div>
      </section>

      {showLogoutDialog && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#123D2C]/35 p-4" role="presentation">
          <div className="w-full max-w-md rounded-xl border border-[#D8DED6] bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="logout-dialog-title" aria-describedby="logout-dialog-description">
            <h2 id="logout-dialog-title" className="m-0 text-xl font-extrabold text-[#123D2C]">Log out?</h2>
            <p id="logout-dialog-description" className="mb-6 mt-2 text-sm leading-6 text-[#58645e]">Are you sure you want to log out?</p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" className="min-h-10 rounded-lg border border-[#C5CEC5] bg-white px-4 text-sm font-bold text-[#314039] hover:bg-[#F6F8F4] disabled:cursor-wait" onClick={() => setShowLogoutDialog(false)} disabled={isLoggingOut} autoFocus>Cancel</button>
              <button type="button" className="min-h-10 rounded-lg border border-[#8B1E25] bg-[#8B1E25] px-4 text-sm font-bold text-white hover:bg-[#72181e] disabled:cursor-wait" onClick={logout} disabled={isLoggingOut} aria-busy={isLoggingOut}>{isLoggingOut ? "Logging out…" : "Log out"}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function App() {
  return <BrowserRouter><EduPredictApp /></BrowserRouter>;
}
