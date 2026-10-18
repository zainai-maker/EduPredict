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
    <form onSubmit={onSubmit} noValidate className="mt-0 space-y-4">
      {sections.map((section) => (
        <fieldset key={section} disabled={isLoading} className="m-0 rounded-lg border border-[#D8DED6] bg-[#FCFDFC] p-4">
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

      <div className="flex justify-end border-t border-[#e5e9e3] pt-4">
        <button type="submit" disabled={isLoading || formOptions.length !== fields.length} className="min-h-10 rounded-lg bg-[#123D2C] px-4 py-2 text-sm font-bold text-white hover:bg-[#0d3022] disabled:cursor-wait disabled:opacity-60">
          {isLoading ? "Working…" : "Save academic data & predict"}
        </button>
      </div>
    </form>
  );
}
