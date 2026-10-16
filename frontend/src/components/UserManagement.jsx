import { useEffect, useState } from "react";
import { json } from "../api/client";

const initial = { full_name: "", email: "", password: "", role: "teacher" };
export default function UserManagement({ api }) {
  const [users, setUsers] = useState([]);
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState(initial);
  const [studentId, setStudentId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [mode, setMode] = useState("teacher");
  const [resetUserId, setResetUserId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [userRows, studentRows] = await Promise.all([
      api("/admin/users"), api("/students?limit=100"),
    ]);
    setUsers(userRows);
    setStudents(studentRows);
  }

  useEffect(() => {
    refresh().catch((cause) => setError(cause.message));
  }, [api]);

  async function perform(action, success) {
    setBusy(true); setError(""); setMessage("");
    try { await action(); setMessage(success); await refresh(); }
    catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  }

  const selected = users.filter((u) => u.role === mode && u.is_active);
  return <section className="edp-manage" aria-label="Manage access">
    <h2>Users and student assignments</h2>
    <p>Only administrators can create accounts and control access.</p>
    <fieldset disabled={busy}>
      <legend>1. Create user account</legend>
      <form onSubmit={(e) => { e.preventDefault(); perform(
        async () => { await api("/admin/users", json("POST", form)); setForm(initial); },
        "User account created. Share the initial password securely."
      ); }}>
        <div className="field-grid">
          <label className="field"><span>Full name</span><input required value={form.full_name}
            onChange={(e) => setForm((v) => ({ ...v, full_name: e.target.value }))}/></label>
          <label className="field"><span>Email</span><input type="email" required value={form.email}
            onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))}/></label>
          <label className="field"><span>Initial password (12+ characters)</span><input type="password" required minLength={12} autoComplete="new-password" value={form.password}
            onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))}/></label>
          <label className="field"><span>Role</span><select value={form.role}
            onChange={(e) => setForm((v) => ({ ...v, role: e.target.value }))}>
              {["teacher", "student", "analyst", "admin"].map((r) => <option key={r} value={r}>{r}</option>)}
            </select></label>
        </div>
        <button type="submit">Create account</button>
      </form>
    </fieldset>
    <fieldset disabled={busy}>
      <legend>2. Link student account / assign teacher</legend>
      <div className="field-grid">
        <label className="field"><span>Action</span><select value={mode} onChange={(e) => { setMode(e.target.value); setSelectedUserId(""); }}>
          <option value="teacher">Assign a teacher</option><option value="student">Link student login</option>
        </select></label>
        <label className="field"><span>Student record</span><select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
          <option value="">Select student</option>
          {students.map((s) => <option key={s.id} value={s.id}>{s.student_code} — {s.full_name}</option>)}
        </select></label>
        <label className="field"><span>{mode === "teacher" ? "Teacher account" : "Student account"}</span>
          <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
            <option value="">Select account</option>
            {selected.map((u) => <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>)}
          </select></label>
      </div>
      <button type="button" disabled={!studentId || !selectedUserId} onClick={() => perform(
        () => api(`/admin/students/${studentId}/${mode === "teacher" ? "assign-teacher" : "link-user"}`,
          json("POST", mode === "teacher" ? { teacher_id: Number(selectedUserId) } : { user_id: Number(selectedUserId) })),
        mode === "teacher" ? "Teacher assigned." : "Student login linked."
      )}>Save assignment</button>
      <p><small>Student selector shows up to 100 records; more advanced search comes later.</small></p>
    </fieldset>
    <fieldset disabled={busy}>
      <legend>3. Reset account password</legend>
      <form onSubmit={(e) => { e.preventDefault(); perform(async () => {
        await api(`/admin/users/${resetUserId}/password`, json("PATCH", { password: newPassword }));
        setNewPassword("");
        setResetUserId("");
      }, "Password reset. Previous sessions for that account are invalidated."); }}>
        <div className="field-grid">
          <label className="field"><span>Account</span><select required value={resetUserId} onChange={(e) => setResetUserId(e.target.value)}>
            <option value="">Select account</option>
            {users.map((u) => <option value={u.id} key={u.id}>{u.email}</option>)}
          </select></label>
          <label className="field"><span>New password</span><input type="password" required minLength={12} maxLength={128}
            autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}/></label>
        </div>
        <button type="submit">Reset password</button>
      </form>
    </fieldset>
    <h3>Accounts</h3>
    <div className="edp-table-scroll"><table className="edp-table">
      <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Action</th></tr></thead>
      <tbody>{users.map((u) => <tr key={u.id}>
        <td>{u.full_name}</td><td>{u.email}</td><td>{u.role}</td><td>{u.is_active ? "Active" : "Disabled"}</td>
        <td><button type="button" disabled={busy} onClick={() => perform(
          () => api(`/admin/users/${u.id}/active`, json("PATCH", { is_active: !u.is_active })),
          "Account status updated."
        )}>{u.is_active ? "Disable" : "Enable"}</button></td>
      </tr>)}</tbody>
    </table></div>
    {error && <p role="alert" className="edp-error">{error}</p>}
    {message && <p role="status">{message}</p>}
  </section>;
}
