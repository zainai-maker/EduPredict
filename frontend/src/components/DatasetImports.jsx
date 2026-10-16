import { useEffect, useState } from "react";
import "./DatasetImports.css";

const formatDate = (value) => value ? new Date(value).toLocaleString() : "—";

export default function DatasetImports({ api }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api("/datasets", { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setBatches(result); })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(`Unable to load previous imports: ${cause.message}`);
      });
    return () => controller.abort();
  }, [api, refresh]);

  async function sendFile(route) {
    if (!file) {
      setError("Choose a CSV file first.");
      return;
    }
    setLoading(true);
    setError("");
    setNotice("");
    const form = new FormData();
    form.append("file", file);
    try {
      const result = await api(route, { method: "POST", body: form });
      if (route.endsWith("/preview")) {
        setPreview(result);
        setNotice(result.invalid_rows
          ? `Please fix ${result.invalid_rows} invalid row(s) before importing.`
          : "File validated. You can now import it.");
      } else {
        setNotice(`Imported ${result.row_count.toLocaleString()} historical rows from ${result.filename}.`);
        setPreview(null);
        setRefresh((current) => current + 1);
        setFile(null);
        // Reset the file input after successful import.
        const input = document.getElementById("edp-dataset-file");
        if (input) input.value = "";
      }
    } catch (cause) {
      setError(cause.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="edp-datasets" aria-labelledby="datasets-title">
      <h2 id="datasets-title">Historical dataset imports</h2>
      <p>Upload labeled or unlabeled academic CSV files. These rows stay separate from registered student accounts and never change your trained model.</p>
      <div className="edp-datasets-panel">
        <label htmlFor="edp-dataset-file">Choose CSV file (maximum 5 MB / 10,000 rows)</label>
        <input
          id="edp-dataset-file"
          type="file"
          accept=".csv,text/csv"
          disabled={loading}
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setPreview(null);
            setNotice("");
            setError("");
          }}
        />
        <div className="edp-datasets-actions">
          <button type="button" disabled={loading || !file} onClick={() => sendFile("/datasets/preview")}>Validate &amp; preview</button>
          <button
            type="button"
            disabled={loading || !file || !preview || preview.invalid_rows !== 0 || preview.valid_rows === 0}
            onClick={() => sendFile("/datasets/import")}
          >Import valid CSV</button>
        </div>
        {loading && <p role="status">Processing CSV…</p>}
        {notice && <p role="status">{notice}</p>}
        {error && <p role="alert" className="edp-dataset-error">{error}</p>}
      </div>

      {preview && (
        <article className="edp-datasets-panel">
          <h3>Validation results</h3>
          <div className="edp-dataset-metrics">
            <span><strong>{preview.total_rows}</strong> total rows</span>
            <span><strong>{preview.valid_rows}</strong> valid</span>
            <span><strong>{preview.invalid_rows}</strong> invalid</span>
            <span><strong>{preview.labeled_rows}</strong> labeled</span>
          </div>
          {preview.issues.length > 0 && <>
            <h4>Errors (first {preview.issues.length})</h4>
            <ul className="edp-dataset-issues">
              {preview.issues.map((item, index) => <li key={`${item.row}-${index}`}>
                Row {item.row}: {item.message}
              </li>)}
            </ul>
          </>}
          {preview.sample.length > 0 && <>
            <h4>First {preview.sample.length} valid rows</h4>
            <div className="edp-dataset-scroll"><table>
              <thead><tr><th>CSV row</th><th>Application mode</th><th>Course</th><th>Age</th><th>Actual outcome</th></tr></thead>
              <tbody>{preview.sample.map((item) => <tr key={item.row_number}>
                <td>{item.row_number}</td>
                <td>{item.features["Application mode"]}</td>
                <td>{item.features.Course}</td>
                <td>{item.features["Age at enrollment"]}</td>
                <td>{item.target === null ? "Not provided" : item.target === 0 ? "Dropout (0)" : "Graduate (1)"}</td>
              </tr>)}</tbody>
            </table></div>
          </>}
        </article>
      )}
      <article className="edp-datasets-panel">
        <h3>Import history</h3>
        {batches.length === 0 ? <p>No datasets have been imported yet.</p> :
          <div className="edp-dataset-scroll"><table>
            <thead><tr><th>Filename</th><th>Rows</th><th>Labeled</th><th>Imported</th></tr></thead>
            <tbody>{batches.map((batch) => <tr key={batch.id}>
              <td>{batch.filename}</td>
              <td>{batch.row_count}</td>
              <td>{batch.labeled_count}</td>
              <td>{formatDate(batch.created_at)}</td>
            </tr>)}</tbody>
          </table></div>
        }
      </article>
    </section>
  );
}
