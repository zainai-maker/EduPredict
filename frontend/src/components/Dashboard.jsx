import { useEffect, useState } from "react";

const formatDate = (value) => {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime()) ? date.toLocaleString() : "—";
};
const formatPercent = (value) => value == null ? "—" : `${Number(value).toFixed(1)}%`;

function Icon({ type }) {
  const paths = {
    students: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    prediction: <path d="m5 12 4 4L19 6" />,
    risk: <><path d="M12 3 3 7.5V12c0 5 3.5 8 9 9 5.5-1 9-4 9-9V7.5L12 3Z" /><path d="M12 8v4" /><path d="M12 16h.01" /></>,
    pending: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  };
  return <span className="grid size-8 place-items-center rounded-md bg-[#EAF0E9] text-[#146C43]"><svg className="size-[1.1rem] fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]" viewBox="0 0 24 24" aria-hidden="true">{paths[type]}</svg></span>;
}

export default function Dashboard({ api, onManageStudents, showRecent, userName }) {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    api("/dashboard/summary", { signal: controller.signal })
      .then((data) => !controller.signal.aborted && setSummary(data))
      .catch((cause) => !controller.signal.aborted && setError(`Unable to load dashboard: ${cause.message}`))
      .finally(() => !controller.signal.aborted && setLoading(false));
    return () => controller.abort();
  }, [refresh, api]);

  const firstName = userName?.trim().split(/\s+/)[0] || "there";
  const metrics = summary ? [
    ["students", "Registered students", summary.total_students, "All student records"],
    ["prediction", "Students with predictions", summary.students_with_predictions, "Latest saved prediction"],
    ["risk", "Predicted dropout", summary.predicted_dropout, "Based on latest prediction"],
    ["pending", "Awaiting prediction", summary.awaiting_prediction, "No saved prediction yet"],
  ] : [];
  const breakdown = summary ? [
    ["Predicted dropout", summary.predicted_dropout, "bg-[#8B1E25]"],
    ["Predicted graduate", summary.predicted_graduate, "bg-[#146C43]"],
    ["Not predicted yet", summary.awaiting_prediction, "bg-[#9BA79E]"],
  ] : [];

  return <section aria-labelledby="dashboard-heading" className="text-[#1F2925]">
    <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="mb-1 text-[.68rem] font-extrabold uppercase tracking-[.08em] text-[#146C43]">Overview</p><h2 id="dashboard-heading" className="m-0 text-2xl font-bold tracking-[-.035em] text-[#123D2C] sm:text-[2rem]">Welcome back, {firstName}</h2><p className="mt-1 text-sm leading-6 text-[#637068]">Here is the latest picture of your student records and prediction activity.</p></div>
      <button type="button" disabled={loading} onClick={() => setRefresh((n) => n + 1)} className="rounded-lg border border-[#bdcabc] bg-white px-3 py-2 text-sm font-bold text-[#123D2C] transition hover:bg-[#EAF0E9] disabled:cursor-wait disabled:opacity-60">{loading ? "Loading…" : "Refresh data"}</button>
    </div>
    {error && <p role="alert" className="font-semibold text-[#8B1E25]">{error}</p>}
    {loading && !summary && <p role="status" className="text-[#637068]">Loading dashboard…</p>}
    {summary && <>
      <section aria-label="Student success summary" className="relative mb-4 flex min-h-[190px] flex-col justify-between gap-6 overflow-hidden rounded-[14px] bg-[#123D2C] p-5 text-white isolate sm:flex-row sm:items-end sm:p-8 before:absolute before:-right-12 before:-top-72 before:-z-10 before:size-[430px] before:rounded-full before:border before:border-[#EAF0E9]/25 after:absolute after:-bottom-[440px] after:-right-[300px] after:-z-10 after:size-[570px] after:rounded-full after:border after:border-[#EAF0E9]/25">
        <div><span className="inline-flex rounded-full border border-[#d6ecdd]/25 bg-white/10 px-2 py-1 text-[.7rem] font-bold text-[#d6ecdd]">Live student insights</span><h3 className="my-2 text-xl font-bold tracking-[-.03em] text-white sm:text-3xl">Keep every student in view.</h3><p className="max-w-[520px] text-sm leading-6 text-[#d6e2da]">Review current records, run predictions, and identify students who may need timely support.</p>{showRecent && <button type="button" onClick={onManageStudents} className="mt-4 rounded-md border border-white/30 bg-[#146C43] px-3 py-2 text-xs font-bold text-white hover:bg-[#0f5a37]">Manage student records <span aria-hidden="true">→</span></button>}</div>
        <div className="grid min-w-[135px] rounded-lg border border-white/15 bg-white/10 p-3 backdrop-blur-sm"><span className="text-[.7rem] text-[#d6e2da]">Total students</span><strong className="my-1 text-2xl leading-none tabular-nums">{summary.total_students.toLocaleString()}</strong><small className="text-[.7rem] text-[#d6e2da]">Registered records</small></div>
      </section>
      <div aria-label="Student prediction statistics" className="my-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([type, label, value, helper]) => <article key={label} className="flex min-w-0 flex-col gap-1.5 rounded-xl border border-[#D8DED6] bg-white p-4 shadow-[0_3px_10px_rgb(18_61_44_/_3%)]"><Icon type={type} /><span className="mt-1 overflow-hidden text-sm text-ellipsis whitespace-nowrap text-[#637068]">{label}</span><strong className="text-[1.8rem] leading-none tracking-[-.045em] tabular-nums">{value.toLocaleString()}</strong><small className="text-[.69rem] text-[#79857d]">{helper}</small></article>)}</div>
      <div className="my-4 grid gap-3 lg:grid-cols-[minmax(0,1.55fr)_minmax(250px,.8fr)]">
        <article className="min-w-0 rounded-xl border border-[#D8DED6] bg-white p-[1.15rem]"><div className="mb-5 flex items-center justify-between gap-4"><div><p className="mb-1 text-[.68rem] font-extrabold uppercase tracking-[.08em] text-[#146C43]">Prediction activity</p><h3 className="m-0 text-base font-bold text-[#123D2C]">Prediction breakdown</h3></div><span className="text-xs font-semibold text-[#728078]">{summary.total_students.toLocaleString()} students</span></div>{summary.total_students === 0 ? <p className="rounded-md bg-[#f4f7f3] px-4 py-3 text-sm text-[#68756d]">No students registered yet.</p> : <div className="flex flex-col gap-4">{breakdown.map(([label, value, color]) => <div key={label}><div className="mb-2 flex justify-between gap-4 text-sm text-[#4f5d55]"><span>{label}</span><strong className="text-[#1F2925] tabular-nums">{value}</strong></div><div role="img" aria-label={`${label}: ${value} out of ${summary.total_students} students`} className="h-2.5 w-full overflow-hidden rounded-full bg-[#e8ede7]"><div className={`h-full rounded-full ${color}`} style={{ width: `${(100 * value) / summary.total_students}%` }} /></div></div>)}</div>}</article>
        <article className="flex flex-col items-start rounded-xl border border-[#D8DED6] bg-white p-[1.15rem]"><p className="mb-1 text-[.68rem] font-extrabold uppercase tracking-[.08em] text-[#146C43]">Risk indicator</p><h3 className="m-0 text-base font-bold text-[#123D2C]">Predicted dropout share</h3><strong className="my-3 text-[2.5rem] leading-none tracking-[-.055em] text-[#8B1E25] tabular-nums">{formatPercent(summary.dropout_share_percent)}</strong><p className="m-0 text-sm leading-6 text-[#637068]">Of students with a saved prediction, this percentage was classified as Dropout by the model.</p><div className="my-4 w-full border-t border-[#e3e8e1]" /><div className="flex w-full justify-between gap-4 text-xs text-[#59665e]"><span>Total prediction runs</span><strong className="text-[#1F2925] tabular-nums">{summary.total_predictions.toLocaleString()}</strong></div><p className="mt-3 text-xs leading-5 text-[#7c877f]">Predictions are estimated risk indicators, not confirmed student outcomes.</p></article>
      </div>
      {showRecent && <article className="mt-3 rounded-xl border border-[#D8DED6] bg-white p-[1.15rem]"><div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="mb-1 text-[.68rem] font-extrabold uppercase tracking-[.08em] text-[#146C43]">Recent activity</p><h3 className="m-0 text-base font-bold text-[#123D2C]">Recent predictions</h3><p className="mt-1 text-sm text-[#637068]">Last 10 saved predictions, newest first.</p></div><button type="button" onClick={onManageStudents} className="rounded-lg border border-[#bdcabc] bg-white px-3 py-2 text-sm font-bold text-[#123D2C] hover:bg-[#EAF0E9]">View student records <span aria-hidden="true">→</span></button></div>{summary.recent_predictions.length === 0 ? <p className="rounded-md bg-[#f4f7f3] px-4 py-3 text-sm text-[#68756d]">No saved predictions yet. Register a student and run a prediction.</p> : <div className="w-full overflow-x-auto"><table className="w-full min-w-[580px] border-collapse text-left text-sm"><thead><tr className="border-b border-[#e5e9e3] text-xs font-bold uppercase tracking-[.03em] text-[#647068]"><th className="p-3">Student</th><th className="p-3">Prediction</th><th className="p-3">Estimated dropout risk</th><th className="p-3">Date</th></tr></thead><tbody>{summary.recent_predictions.map((item) => <tr key={item.id} className="border-b border-[#e5e9e3] last:border-0 hover:bg-[#f6f8f4]"><td className="p-3"><strong>{item.full_name}</strong><span className="mt-0.5 block text-xs text-[#7d8981]">{item.student_code}</span></td><td className="p-3"><span className={`inline-block rounded-full px-2 py-1 text-xs font-bold ${item.prediction === "Dropout" ? "bg-[#f7e8e9] text-[#7b1820]" : "bg-[#e3f1e8] text-[#0d5a35]"}`}>{item.prediction}</span></td><td className="p-3 tabular-nums">{formatPercent(item.dropout_risk_percent)}</td><td className="p-3 tabular-nums">{formatDate(item.created_at)}</td></tr>)}</tbody></table></div>}</article>}
    </>}
  </section>;
}
