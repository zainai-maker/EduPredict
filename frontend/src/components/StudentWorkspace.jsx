import { useEffect, useState } from "react";
import PredictionForm from "./PredictionForm";
import PredictionResult from "./PredictionResult";
import { emptyValues, fields } from "../data/fields";

function formatTime(date) {
  return date ? new Date(date).toLocaleString() : "Date unavailable";
}

export default function StudentWorkspace({ api , role}) {
  const [formOptions, setFormOptions] = useState([]);
  const [optionsError, setOptionsError] = useState("");
  const [students, setStudents] = useState([]);
  const [studentListError, setStudentListError] = useState("");
  const [studentId, setStudentId] = useState("");
  const [registration, setRegistration] = useState({ student_code: "", full_name: "", email: "" });
  const [registrationError, setRegistrationError] = useState("");
  const [message, setMessage] = useState("");
  const [values, setValues] = useState(emptyValues);
  const [history, setHistory] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoadingRecord, setIsLoadingRecord] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);
  const isBusy = isRegistering || isLoadingRecord || isPredicting;

  // Fetch form labels and category codes from FastAPI instead of duplicating them in React.
  useEffect(() => {
    const controller = new AbortController();
    api("/form-options", { signal: controller.signal })
      .then((options) => {
        if (!Array.isArray(options) || fields.some((field) => !options.some((opt) => opt.name === field.key))) {
          throw new Error("The form options API does not contain all 13 model features.");
        }
        setFormOptions(options);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setOptionsError(`Could not load form options: ${cause.message}`);
      });

    api("/students?limit=100", { signal: controller.signal })
      .then(setStudents)
      .catch((cause) => {
        if (!controller.signal.aborted) setStudentListError(`Could not load students: ${cause.message}`);
      });
    return () => controller.abort();
  }, [api]);

  // When a student is chosen, load their own latest saved inputs and prediction history.
  useEffect(() => {
    setValues(emptyValues);
    setHistory([]);
    setResult(null);
    setError("");
    if (!studentId) return;

    const controller = new AbortController();
    setIsLoadingRecord(true);
    (async () => {
      try {
        try {
          const record = await api(`/students/${studentId}/record`, { signal: controller.signal });
          if (!controller.signal.aborted) setValues(Object.fromEntries(
            fields.map(({ key }) => [key, String(record[key] ?? "")])
          ));
        } catch (cause) {
          if (cause.status !== 404) throw cause;
        }
        const predictions = await api(`/students/${studentId}/predictions`, {
          signal: controller.signal,
        });
        if (!controller.signal.aborted) setHistory(predictions);
      } catch (cause) {
        if (!controller.signal.aborted) setError(`Could not load student records: ${cause.message}`);
      } finally {
        if (!controller.signal.aborted) setIsLoadingRecord(false);
      }
    })();
    return () => controller.abort();
  }, [studentId, api]);

  function updateValue(key, value) {
    setValues((current) => ({ ...current, [key]: value }));
    setResult(null); // No longer show a result for inputs that have been changed.
  }

  async function registerStudent(event) {
    event.preventDefault();
    setRegistrationError("");
    setMessage("");
    setIsRegistering(true);
    try {
      const student = await api("/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_code: registration.student_code.trim(),
          full_name: registration.full_name.trim(),
          email: registration.email.trim() || null,
        }),
      });
      setStudents((current) => [...current.filter((item) => item.id !== student.id), student]);
      setStudentListError("");
      setRegistration({ student_code: "", full_name: "", email: "" });
      setStudentId(String(student.id));
      // Selection loads the new student's (initially empty) academic record.
      setMessage(`Registered ${student.full_name}. Enter their academic information below.`);
    } catch (cause) {
      setRegistrationError(cause.message);
    } finally {
      setIsRegistering(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setResult(null);
    if (!studentId) {
      setError("Register or select a student first.");
      return;
    }
    if (formOptions.length !== fields.length) {
      setError("Form options are not ready. Check your API connection.");
      return;
    }

    // HTML inputs contain strings; the model must receive the original numeric codes.
    const payload = {};
    for (const field of fields) {
      const raw = String(values[field.key] ?? "").trim();
      const meta = formOptions.find((option) => option.name === field.key);
      const number = Number(raw);
      if (raw === "" || !Number.isFinite(number)) {
        setError(`Enter a valid value for ${field.label}.`);
        return;
      }
      if (meta.type === "select" && !meta.options.some((option) => option.value === number)) {
        setError(`Select a listed option for ${field.label}.`);
        return;
      }
      if (meta.type === "number" && (
        (meta.min !== undefined && number < meta.min) ||
        (meta.max !== undefined && number > meta.max) ||
        (meta.step === 1 && !Number.isInteger(number))
      )) {
        setError(`Enter a valid number within the allowed range for ${field.label}.`);
        return;
      }
      payload[field.key] = number;
    }

    setIsPredicting(true);
    let recordSaved = false;
    try {
      await api(`/students/${studentId}/record`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      recordSaved = true;
      const prediction = await api(`/students/${studentId}/predict`, { method: "POST" });
      setResult(prediction); // Compatible with the existing PredictionResult component.
      setHistory((current) => [prediction, ...current].slice(0, 100));
      setMessage("Academic record and prediction saved successfully.");
    } catch (cause) {
      setError(recordSaved
        ? `Academic record was saved, but prediction failed: ${cause.message}`
        : `Could not save the academic record: ${cause.message}`);
    } finally {
      setIsPredicting(false);
    }
  }

  return (
    <section aria-label="Student records and predictions" className="max-w-[1100px] space-y-5">
      <div>
        <p className="mb-1 text-[.7rem] font-extrabold uppercase tracking-[.08em] text-[#146C43]">Student workspace</p>
        <h2 className="m-0 text-2xl font-bold tracking-[-.03em] text-[#123D2C]">Student records &amp; predictions</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#637068]">Create or select a student record, then save academic information to generate a prediction.</p>
      </div>
 {role === "admin" &&(
        <fieldset disabled={isBusy} className="m-0 rounded-xl border border-[#D8DED6] bg-white p-5 shadow-[0_3px_10px_rgb(18_61_44_/_3%)]">
          <legend>1. Register a student</legend>
          <form onSubmit={registerStudent} className="mt-3">
            <p className="mb-4 text-sm text-[#637068]">Add a new student before recording academic information.</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="field md:col-span-2">
                <span>Student ID / code</span>
                <input required maxLength={50} value={registration.student_code}
                  onChange={(event) => setRegistration((old) => ({ ...old, student_code: event.target.value }))} />
              </label>
              <label className="field">
                <span>Full name</span>
                <input required maxLength={150} value={registration.full_name}
                  onChange={(event) => setRegistration((old) => ({ ...old, full_name: event.target.value }))} />
              </label>
              <label className="field">
                <span>Email (optional)</span>
                <input type="email" maxLength={254} value={registration.email}
                  onChange={(event) => setRegistration((old) => ({ ...old, email: event.target.value }))} />
              </label>
            </div>
            <div className="mt-5 flex justify-end border-t border-[#e5e9e3] pt-4"><button type="submit" className="min-h-10 rounded-lg bg-[#123D2C] px-4 py-2 text-sm font-bold text-white hover:bg-[#0d3022]">{isRegistering ? "Registering…" : "Register student"}</button></div>
          </form>
        </fieldset>
        )}
        {registrationError && <p role="alert" className="rounded-lg border border-[#eac8ca] bg-[#fdf3f3] px-4 py-3 text-sm font-semibold text-[#8B1E25]">{registrationError}</p>}
       
        <fieldset disabled={isBusy} className="m-0 rounded-xl border border-[#D8DED6] bg-white p-5 shadow-[0_3px_10px_rgb(18_61_44_/_3%)]">
          <legend>2. Select a student</legend>
          <p className="mb-4 text-sm text-[#637068]">Choose an existing student to view or update their academic record.</p>
          <label className="field max-w-xl">
            <span>Registered student</span>
            <select value={studentId} onChange={(event) => { setMessage(""); setStudentId(event.target.value); }}>
              <option value="">Choose a student</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.student_code} — {student.full_name}
                </option>
              ))}
            </select>
          </label>
          {students.length === 100 && <p className="mt-3 text-xs text-[#748078]">Showing up to 100 students. Student search can be added later.</p>}
          {studentListError && <p role="alert" className="mt-3 text-sm font-semibold text-[#8B1E25]">{studentListError}</p>}
        </fieldset>

        <section aria-label="Academic information" className="overflow-hidden rounded-xl border border-[#D8DED6] bg-white shadow-[0_3px_10px_rgb(18_61_44_/_3%)]">
          <div className="border-b border-[#D8DED6] bg-[#EAF0E9] px-5 py-4"><div className="flex items-start gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#123D2C] text-sm font-extrabold text-white">3</span><div><h2 className="m-0 text-lg font-bold text-[#123D2C]">Academic information &amp; prediction</h2><p className="mt-1 text-sm leading-5 text-[#526158]">Complete the academic details for the selected student, then save the record and run a prediction.</p></div></div></div>
          <div className="p-5">
          {optionsError && <p role="alert" className="rounded-lg border border-[#eac8ca] bg-[#fdf3f3] px-4 py-3 text-sm font-semibold text-[#8B1E25]">{optionsError} Start your FastAPI server and reload.</p>}
          {formOptions.length === 0 && !optionsError && <p className="rounded-lg bg-[#f4f7f3] px-4 py-3 text-sm text-[#637068]">Loading form choices…</p>}
          {!studentId && <div className="grid min-h-40 place-items-center rounded-lg border border-dashed border-[#b9cbbb] bg-[#f8faf7] px-6 py-8 text-center"><div><span className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-[#EAF0E9] text-lg text-[#146C43]" aria-hidden="true">↗</span><h3 className="m-0 text-base font-bold text-[#123D2C]">Choose a student to begin</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#637068]">Register a new student above or select an existing record to unlock the academic form and prediction tools.</p></div></div>}
          {isLoadingRecord && <p className="rounded-lg bg-[#f4f7f3] px-4 py-3 text-sm text-[#637068]">Loading academic record…</p>}
          {studentId && formOptions.length === fields.length && (
            <PredictionForm
              values={values}
              formOptions={formOptions}
              isLoading={isBusy}
              onValueChange={updateValue}
              onSubmit={handleSubmit}
            />
          )}
          {message && <p role="status" className="mt-4 rounded-lg border border-[#bfdbc9] bg-[#edf7f0] px-4 py-3 text-sm font-semibold text-[#146C43]">{message}</p>}
          <PredictionResult error={error} result={result} />
          </div>
        </section>

        {studentId && (
          <section aria-label="Prediction history" className="rounded-xl border border-[#D8DED6] bg-white p-5 shadow-[0_3px_10px_rgb(18_61_44_/_3%)]">
            <div className="mb-4 flex items-center gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#123D2C] text-sm font-extrabold text-white">4</span><div><h2 className="m-0 text-lg font-bold text-[#123D2C]">Prediction history</h2><p className="mt-1 text-sm text-[#637068]">Latest saved predictions for this student.</p></div></div>
            {history.length === 0 ? (
              <p className="rounded-lg bg-[#f4f7f3] px-4 py-3 text-sm text-[#637068]">No saved predictions for this student yet.</p>
            ) : (
              <ul className="m-0 space-y-2 p-0">
                {history.slice(0, 10).map((item) => (
                  <li key={item.id} className="list-none rounded-lg border border-[#e5e9e3] px-4 py-3 text-sm text-[#536159]">
                    <strong>{item.prediction}</strong>
                    {item.dropout_risk_percent != null && ` — estimated dropout risk: ${item.dropout_risk_percent}%`}
                    {` — ${formatTime(item.created_at)}`}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

    </section>
  );
}
