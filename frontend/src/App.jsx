import { useEffect, useState } from "react";
import PredictionForm from "./components/PredictionForm";
import PredictionResult from "./components/PredictionResult";
import Dashboard from "./components/Dashboard";
import { emptyValues, fields } from "./data/fields";

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

function getErrorMessage(body) {
  if (typeof body?.detail === "string") return body.detail;
  if (Array.isArray(body?.detail)) return body.detail.map((item) => item.msg).join("; ");
  return "The request could not be completed.";
}

async function apiRequest(path, init) {
  const response = await fetch(`${apiBaseUrl}${path}`, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(getErrorMessage(body));
    error.status = response.status;
    throw error;
  }
  return body;
}

function formatTime(date) {
  return date ? new Date(date).toLocaleString() : "Date unavailable";
}

export default function App() {
  const [view, setView] = useState("dashboard");
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
    apiRequest("/form-options", { signal: controller.signal })
      .then((options) => {
        if (!Array.isArray(options) || fields.some((field) => !options.some((opt) => opt.name === field.key))) {
          throw new Error("The form options API does not contain all 13 model features.");
        }
        setFormOptions(options);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setOptionsError(`Could not load form options: ${cause.message}`);
      });

    apiRequest("/students?limit=100", { signal: controller.signal })
      .then(setStudents)
      .catch((cause) => {
        if (!controller.signal.aborted) setStudentListError(`Could not load students: ${cause.message}`);
      });
    return () => controller.abort();
  }, []);

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
        const recordResponse = await fetch(`${apiBaseUrl}/students/${studentId}/record`, {
          signal: controller.signal,
        });
        if (recordResponse.ok) {
          const record = await recordResponse.json();
          setValues(Object.fromEntries(fields.map(({ key }) => [key, String(record[key] ?? "")])));
        } else if (recordResponse.status !== 404) {
          throw new Error(getErrorMessage(await recordResponse.json().catch(() => ({}))));
        }
        const predictions = await apiRequest(`/students/${studentId}/predictions`, {
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
  }, [studentId]);

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
      const student = await apiRequest("/students", {
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
      await apiRequest(`/students/${studentId}/record`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      recordSaved = true;
      const prediction = await apiRequest(`/students/${studentId}/predict`, { method: "POST" });
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
    <main className="page-shell">
      <section className="prediction-card edp-app" aria-labelledby="page-title">
        <header>
          <p className="eyebrow">Student support tool</p>
          <h1 id="page-title">EduPredict - Student Outcome Prediction</h1>
          <p>Register a student, enter academic information, and save the dropout prediction.</p>
        </header>

        <nav className="edp-nav" aria-label="EduPredict sections">
          <button type="button" className={`edp-nav-btn ${view === "dashboard" ? "is-active" : ""}`}
            aria-current={view === "dashboard" ? "page" : undefined}
            onClick={() => setView("dashboard")}>Dashboard</button>
          <button type="button" className={`edp-nav-btn ${view === "students" ? "is-active" : ""}`}
            aria-current={view === "students" ? "page" : undefined}
            onClick={() => setView("students")}>Student records &amp; predictions</button>
        </nav>

        {view === "dashboard" ? (
          <Dashboard onManageStudents={() => setView("students")} />
        ) : (
          <>
        <fieldset disabled={isBusy}>
          <legend>1. Register a student</legend>
          <form onSubmit={registerStudent}>
            <div className="field-grid">
              <label className="field">
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
            <button type="submit">{isRegistering ? "Registering…" : "Register student"}</button>
          </form>
        </fieldset>
        {registrationError && <p role="alert">{registrationError}</p>}

        <fieldset disabled={isBusy}>
          <legend>2. Select a student</legend>
          <label className="field">
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
          {students.length === 100 && <p><small>Showing up to 100 students. Student search can be added later.</small></p>}
          {studentListError && <p role="alert">{studentListError}</p>}
        </fieldset>

        <section aria-label="Academic information">
          <h2>3. Academic information & prediction</h2>
          {optionsError && <p role="alert">{optionsError} Start your FastAPI server and reload.</p>}
          {formOptions.length === 0 && !optionsError && <p>Loading form choices…</p>}
          {!studentId && <p>Register or select a student to continue.</p>}
          {isLoadingRecord && <p>Loading academic record…</p>}
          {studentId && formOptions.length === fields.length && (
            <PredictionForm
              values={values}
              formOptions={formOptions}
              isLoading={isBusy}
              onValueChange={updateValue}
              onSubmit={handleSubmit}
            />
          )}
          {message && <p role="status">{message}</p>}
          <PredictionResult error={error} result={result} />
        </section>

        {studentId && (
          <section aria-label="Prediction history">
            <h2>4. Prediction history</h2>
            {history.length === 0 ? (
              <p>No saved predictions for this student yet.</p>
            ) : (
              <ul>
                {history.slice(0, 10).map((item) => (
                  <li key={item.id}>
                    <strong>{item.prediction}</strong>
                    {item.dropout_risk_percent != null && ` — estimated dropout risk: ${item.dropout_risk_percent}%`}
                    {` — ${formatTime(item.created_at)}`}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
          </>
        )}
      </section>
    </main>
  );
}
