import { useEffect, useState } from "react";
import "./Dashboard.css";

function formattedDate(raw) {
  if (!raw) return "—";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function percent(value) {
  return value == null ? "—" : `${Number(value).toFixed(1)}%`;
}

export default function Dashboard({ api, onManageStudents, showRecent }) {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    api("/dashboard/summary", { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setSummary(data);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(`Unable to load dashboard: ${cause.message}`);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [refresh, api]);

  const counts = summary
    ? [
        { label: "Predicted dropout", value: summary.predicted_dropout, className: "edp-bar-dropout" },
        { label: "Predicted graduate", value: summary.predicted_graduate, className: "edp-bar-graduate" },
        { label: "Not predicted yet", value: summary.awaiting_prediction, className: "edp-bar-pending" },
      ]
    : [];

  return (
    <section className="edp-dashboard" aria-labelledby="dashboard-heading">
      <div className="edp-dashboard-heading">
        <div>
          <h2 id="dashboard-heading">Student overview</h2>
          <p>Current student records and model predictions, directly from the database.</p>
        </div>
        <button type="button" className="edp-refresh" disabled={loading} onClick={() => setRefresh((n) => n + 1)}>
          {loading ? "Loading…" : "Refresh data"}
        </button>
      </div>

      {error && <p role="alert" className="edp-error">{error}</p>}
      {loading && !summary && <p role="status">Loading dashboard…</p>}

      {summary && (
        <>
          <div className="edp-metrics" aria-label="Student prediction statistics">
            <article className="edp-metric">
              <span>Registered students</span>
              <strong>{summary.total_students.toLocaleString()}</strong>
              <small>All student records</small>
            </article>
            <article className="edp-metric">
              <span>Students with predictions</span>
              <strong>{summary.students_with_predictions.toLocaleString()}</strong>
              <small>Latest prediction per student</small>
            </article>
            <article className="edp-metric">
              <span>Predicted dropout</span>
              <strong>{summary.predicted_dropout.toLocaleString()}</strong>
              <small>Based on latest prediction</small>
            </article>
            <article className="edp-metric">
              <span>Awaiting prediction</span>
              <strong>{summary.awaiting_prediction.toLocaleString()}</strong>
              <small>No saved prediction yet</small>
            </article>
          </div>

          <div className="edp-panels">
            <article className="edp-panel">
              <div className="edp-panel-title">
                <h3>Prediction breakdown</h3>
                <span>{summary.total_students.toLocaleString()} students</span>
              </div>
              {summary.total_students === 0 ? (
                <p className="edp-empty">No students registered yet.</p>
              ) : (
                <div className="edp-breakdown">
                  {counts.map((item) => (
                    <div className="edp-breakdown-row" key={item.label}>
                      <div className="edp-bar-label">
                        <span>{item.label}</span><strong>{item.value}</strong>
                      </div>
                      <div
                        className="edp-bar-track"
                        role="img"
                        aria-label={`${item.label}: ${item.value} out of ${summary.total_students} students`}
                      >
                        <div
                          className={`edp-bar-fill ${item.className}`}
                          style={{ width: `${(100 * item.value) / summary.total_students}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>
            <article className="edp-panel edp-risk-panel">
              <h3>Predicted dropout share</h3>
              <strong className="edp-risk-number">{percent(summary.dropout_share_percent)}</strong>
              <p>Of students with a saved prediction, this percentage was classified as Dropout by the model.</p>
              <div className="edp-subtle-rule" />
              <div className="edp-small-stat">
                <span>Total prediction runs (history)</span>
                <strong>{summary.total_predictions.toLocaleString()}</strong>
              </div>
              <p className="edp-caveat">Model predictions are not confirmed student outcomes. Estimated risk scores are not guarantees.</p>
            </article>
          </div>

          {showRecent && <article className="edp-panel edp-history">
            <div className="edp-panel-title">
              <div>
                <h3>Recent predictions</h3>
                <p>Last 10 saved predictions, newest first.</p>
              </div>
              <button type="button" className="edp-manage-link" onClick={onManageStudents}>
                Manage students →
              </button>
            </div>
            {summary.recent_predictions.length === 0 ? (
              <p className="edp-empty">No saved predictions yet. Register a student and run a prediction.</p>
            ) : (
              <div className="edp-table-scroll">
                <table className="edp-table">
                  <thead>
                    <tr>
                      <th scope="col">Student</th>
                      <th scope="col">Prediction</th>
                      <th scope="col">Estimated dropout risk</th>
                      <th scope="col">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.recent_predictions.map((item) => (
                      <tr key={item.id}>
                        <td><strong>{item.full_name}</strong><span className="edp-secondary">{item.student_code}</span></td>
                        <td><span className={`edp-outcome ${item.prediction === "Dropout" ? "edp-outcome-dropout" : "edp-outcome-graduate"}`}>{item.prediction}</span></td>
                        <td>{percent(item.dropout_risk_percent)}</td>
                        <td>{formattedDate(item.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>}
        </>
      )}
    </section>
  );
}
