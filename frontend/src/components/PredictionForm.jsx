import { fields, sections } from "../data/fields";

export default function PredictionForm({
  values,
  isLoading,
  onValueChange,
  onSubmit,
}) {
  return (
    <form onSubmit={onSubmit} noValidate>
      {sections.map((section) => (
        <fieldset key={section}>
          <legend>{section}</legend>
          <div className="field-grid">
            {fields
              .filter((field) => field.section === section)
              .map((field) => (
                <label key={field.key} className="field">
                  <span>{field.label}</span>
                  {field.kind === "yesNo" ? (
                    <select
                      value={values[field.key]}
                      onChange={(event) => onValueChange(field.key, event.target.value)}
                      required
                      disabled={isLoading}
                    >
                      <option value="">Select</option>
                      <option value="1">Yes</option>
                      <option value="0">No</option>
                    </select>
                  ) : (
                    <input
                      type="number"
                      inputMode="decimal"
                      step={field.kind === "code" ? "1" : "any"}
                      value={values[field.key]}
                      onChange={(event) => onValueChange(field.key, event.target.value)}
                      required
                      disabled={isLoading}
                    />
                  )}
                </label>
              ))}
          </div>
        </fieldset>
      ))}

      <button type="submit" disabled={isLoading}>
        {isLoading ? "Predicting…" : "Predict"}
      </button>
    </form>
  );
}
