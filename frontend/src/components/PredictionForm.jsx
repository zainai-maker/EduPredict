import { fields, sections } from "../data/fields";

export default function PredictionForm({
  values,
  formOptions,
  isLoading,
  onValueChange,
  onSubmit,
}) {
  const metadata = Object.fromEntries(formOptions.map((field) => [field.name, field]));

  return (
    <form onSubmit={onSubmit} noValidate>
      {sections.map((section) => (
        <fieldset key={section} disabled={isLoading}>
          <legend>{section}</legend>
          <div className="field-grid">
            {fields
              .filter((field) => field.section === section)
              .map((field) => {
                const option = metadata[field.key];
                return (
                  <label key={field.key} className="field">
                    <span>{field.label}</span>
                    {option?.type === "select" ? (
                      <select
                        name={field.key}
                        value={values[field.key] ?? ""}
                        onChange={(event) => onValueChange(field.key, event.target.value)}
                        required
                      >
                        <option value="">Select an option</option>
                        {option.options.map((choice) => (
                          <option key={choice.value} value={String(choice.value)}>
                            {choice.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        name={field.key}
                        type="number"
                        inputMode="decimal"
                        min={option?.min}
                        max={option?.max}
                        step={option?.step ?? "any"}
                        value={values[field.key] ?? ""}
                        onChange={(event) => onValueChange(field.key, event.target.value)}
                        required
                      />
                    )}
                  </label>
                );
              })}
          </div>
        </fieldset>
      ))}

      <button type="submit" disabled={isLoading || formOptions.length !== fields.length}>
        {isLoading ? "Working…" : "Save academic data & predict"}
      </button>
    </form>
  );
}
