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
  return <section className="edp-manage max-w-[1100px] space-y-5" aria-label="Manage access">
    <div>
      <p className="mb-1 text-[.7rem] font-extrabold uppercase tracking-[.08em] text-[#146C43]">Administration</p>
      <h2 className="m-0 text-2xl font-bold tracking-[-.03em] text-[#123D2C]">Users &amp; assignments</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#637068]">Create accounts, connect students to teachers or logins, and manage account access.</p>
    </div>
    <fieldset disabled={busy} className="m-0 rounded-xl border border-[#D8DED6] bg-white p-5 shadow-[0_3px_10px_rgb(18_61_44_/_3%)]">
      <legend>1. Create user account</legend>
      <form className="mt-3" onSubmit={(e) => { e.preventDefault(); perform(
        async () => { await api("/admin/users", json("POST", form)); setForm(initial); },
        "User account created. Share the initial password securely."
      ); }}>
        <p className="mb-4 text-sm text-[#637068]">Create a role-based account. Share the initial password through a secure channel.</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
        <div className="mt-5 flex justify-end border-t border-[#e5e9e3] pt-4"><button type="submit" className="min-h-10 rounded-lg bg-[#123D2C] px-4 py-2 text-sm font-bold text-white hover:bg-[#0d3022]">Create account</button></div>
      </form>
    </fieldset>
    <fieldset disabled={busy} className="m-0 rounded-xl border border-[#D8DED6] bg-white p-5 shadow-[0_3px_10px_rgb(18_61_44_/_3%)]">
      <legend>2. Link student account / assign teacher</legend>
      <p className="mb-4 text-sm text-[#637068]">Connect a student record with a teacher or student login account.</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="field"><span>Action</span><select value={mode} onChange={(e) => { setMode(e.target.value); setSelectedUserId(""); }}>
          <option value="teacher">Assign a teacher</option><option value="student">Link student login</option>
        </select></label>
        <label className="field"><span>Student record</span><select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
          <option value="">Select student</option>
          {students.map((s) => <option key={s.id} value={s.id}>{s.student_code} — {s.full_name}</option>)}
        </select></label>
        <label className="field md:col-span-2"><span>{mode === "teacher" ? "Teacher account" : "Student account"}</span>
          <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
            <option value="">Select account</option>
            {selected.map((u) => <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>)}
          </select></label>
      </div>
      <div className="mt-5 flex flex-col-reverse gap-3 border-t border-[#e5e9e3] pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="m-0 text-xs text-[#748078]">Student selector shows up to 100 records; more advanced search comes later.</p><button type="button" disabled={!studentId || !selectedUserId} onClick={() => perform(
          () => api(`/admin/students/${studentId}/${mode === "teacher" ? "assign-teacher" : "link-user"}`,
            json("POST", mode === "teacher" ? { teacher_id: Number(selectedUserId) } : { user_id: Number(selectedUserId) })),
          mode === "teacher" ? "Teacher assigned." : "Student login linked."
        )} className="min-h-10 shrink-0 rounded-lg bg-[#123D2C] px-4 py-2 text-sm font-bold text-white hover:bg-[#0d3022] disabled:cursor-not-allowed disabled:opacity-60">Save assignment</button></div>
    </fieldset>
    <fieldset disabled={busy} className="m-0 rounded-xl border border-[#D8DED6] bg-white p-5 shadow-[0_3px_10px_rgb(18_61_44_/_3%)]">
      <legend>3. Reset account password</legend>
      <form className="mt-3" onSubmit={(e) => { e.preventDefault(); perform(async () => {
        await api(`/admin/users/${resetUserId}/password`, json("PATCH", { password: newPassword }));
        setNewPassword("");
        setResetUserId("");
      }, "Password reset. Previous sessions for that account are invalidated."); }}>
        <p className="mb-4 text-sm text-[#637068]">Set a new password for an account. Existing sessions for that user will be invalidated.</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="field"><span>Account</span><select required value={resetUserId} onChange={(e) => setResetUserId(e.target.value)}>
            <option value="">Select account</option>
            {users.map((u) => <option value={u.id} key={u.id}>{u.email}</option>)}
          </select></label>
          <label className="field"><span>New password</span><input type="password" required minLength={12} maxLength={128}
            autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}/></label>
        </div>
        <div className="mt-5 flex justify-end border-t border-[#e5e9e3] pt-4"><button type="submit" className="min-h-10 rounded-lg bg-[#8B1E25] px-4 py-2 text-sm font-bold text-white hover:bg-[#72171d]">Reset password</button></div>
      </form>
    </fieldset>
    <section className="overflow-hidden rounded-xl border border-[#D8DED6] bg-white shadow-[0_3px_10px_rgb(18_61_44_/_3%)]" aria-labelledby="accounts-heading">
    <div className="border-b border-[#D8DED6] bg-[#EAF0E9] px-5 py-4"><h3 id="accounts-heading" className="m-0 text-lg font-bold text-[#123D2C]">Accounts</h3><p className="mt-1 text-sm text-[#526158]">Review account roles and enable or disable access.</p></div>
    <div className="edp-table-scroll p-2 sm:p-4"><table className="edp-table">
      <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Action</th></tr></thead>
      <tbody>{users.map((u) => <tr key={u.id}>
        <td>{u.full_name}</td><td>{u.email}</td><td>{u.role}</td><td>{u.is_active ? "Active" : "Disabled"}</td>
        <td><button type="button" disabled={busy} onClick={() => perform(
          () => api(`/admin/users/${u.id}/active`, json("PATCH", { is_active: !u.is_active })),
          "Account status updated."
        )}>{u.is_active ? "Disable" : "Enable"}</button></td>
      </tr>)}</tbody>
    </table></div>
    </section>
    {error && <p role="alert" className="rounded-lg border border-[#eac8ca] bg-[#fdf3f3] px-4 py-3 text-sm font-semibold text-[#8B1E25]">{error}</p>}
    {message && <p role="status" className="rounded-lg border border-[#bfdbc9] bg-[#edf7f0] px-4 py-3 text-sm font-semibold text-[#146C43]">{message}</p>}
  </section>;
}
