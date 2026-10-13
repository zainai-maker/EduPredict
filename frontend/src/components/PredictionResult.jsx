export default function PredictionResult({ error, result }) {
  return (
    <section className="result" aria-live="polite" aria-label="Prediction result">
      {error && <p className="error">{error}</p>}
      {result && (
        <>
          <h2>Prediction: {result.prediction}</h2>
          {typeof result.dropout_risk_percent === "number" && (
            <p>Estimated dropout risk: {result.dropout_risk_percent.toFixed(1)}%</p>
          )}
        </>
      )}
    </section>
  );
}
