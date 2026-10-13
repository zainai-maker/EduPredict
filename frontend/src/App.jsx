import { useState } from "react";
import PredictionForm from "./components/PredictionForm";
import PredictionResult from "./components/PredictionResult";
import { emptyValues, fields } from "./data/fields";

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(
  /\/$/,
  "",
);

function getErrorMessage(responseBody) {
  if (typeof responseBody?.detail === "string") return responseBody.detail;
  if (Array.isArray(responseBody?.detail)) {
    return responseBody.detail.map((item) => item.msg).join(" ");
  }
  return "The prediction request could not be completed.";
}

export default function App() {
  const [values, setValues] = useState(emptyValues);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  function updateValue(key, value) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setResult(null);

    const payload = {};
    for (const field of fields) {
      const value = values[field.key].trim();
      if (!value || !Number.isFinite(Number(value))) {
        setError(`Enter a valid value for ${field.label}.`);
        return;
      }
      payload[field.key] = Number(value);
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(getErrorMessage(body));
        return;
      }
      setResult(body);
    } catch {
      setError(
        `Could not reach the prediction API at ${apiBaseUrl}. Start the FastAPI backend and try again.`,
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="prediction-card" aria-labelledby="page-title">
        <header>
          <p className="eyebrow">Student support tool</p>
          <h1 id="page-title">EduPredict - Student Outcome Prediction</h1>
          <p>Enter student details to estimate Dropout or Graduate.</p>
        </header>

        <PredictionForm
          values={values}
          isLoading={isLoading}
          onValueChange={updateValue}
          onSubmit={handleSubmit}
        />
        <PredictionResult error={error} result={result} />
      </section>
    </main>
  );
}
