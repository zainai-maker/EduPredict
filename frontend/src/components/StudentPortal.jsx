import { useEffect, useState } from "react";

const hideKeys = new Set(["Debtor", "Tuition fees up to date"]);
export default function StudentPortal({ api }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [options, setOptions] = useState([]);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      api("/me/student", { signal: controller.signal }),
      api("/form-options", { signal: controller.signal }),
    ])
      .then(([body, meta]) => {
        if (!controller.signal.aborted) { setData(body); setOptions(meta); }
      })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause.message); });
    return () => controller.abort();
  }, [api]);

  function labelFor(key, raw) {
    const meta = options.find((field) => field.name === key);
    if (meta?.type === "select") {
      return meta.options.find((opt) => opt.value === Number(raw))?.label ?? String(raw);
    }
    return String(raw);
  }

  return (
    <section aria-label="My academic information">
      <h2>My academic information</h2>
      <p>These are your saved academic details. For support or questions, contact your teacher.</p>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p>Loading your information…</p>}
      {data && !data.student && <p>Your account has not been linked to a student record yet. Ask your administrator.</p>}
      {data?.student && <>
        <p><strong>Student:</strong> {data.student.full_name} · {data.student.student_code}</p>
        {!data.academic_record ? <p>No academic data has been recorded yet.</p> : (
          <dl className="edp-academic-list">
            {Object.entries(data.academic_record).filter(([key]) => !hideKeys.has(key)).map(([key, value]) => (
              <div key={key}><dt>{key}</dt><dd>{labelFor(key, value)}</dd></div>
            ))}
          </dl>
        )}
      </>}
    </section>
  );
}
