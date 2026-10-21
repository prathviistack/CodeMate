export default function FormField({ label, id, error, hint, ...inputProps }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">{label}</label>
      <input
        id={id}
        name={id}
        className={`input ${error ? "!border-danger focus:!ring-danger/30" : ""}`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-err` : undefined}
        {...inputProps}
      />
      {error ? (
        <p id={`${id}-err`} className="mt-1 text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
