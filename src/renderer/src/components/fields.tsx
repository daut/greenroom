import { type ReactNode, useEffect, useId, useState } from "react";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  labelOf = (option) => option,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  labelOf?: (option: T) => string;
}) {
  const name = useId();
  return (
    <fieldset className="field">
      <legend className="label">{label}</legend>
      <div className="segmented">
        {options.map((option) => (
          <label key={option} className={value === option ? "active" : ""}>
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
            />
            {labelOf(option)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Text input with suggestions; free text is allowed. */
export function SuggestInput({
  id,
  value,
  suggestions,
  onChange,
}: {
  id: string;
  value: string;
  suggestions: readonly string[];
  onChange: (value: string) => void;
}) {
  const listId = `${id}-list`;
  const [text, setText] = useState(value);

  useEffect(() => setText(value), [value]);

  return (
    <>
      <input
        id={id}
        list={listId}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (e.target.value.trim()) onChange(e.target.value);
        }}
      />
      <datalist id={listId}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </>
  );
}

/** Number input that only reports valid values in range, but lets you type freely. */
export function NumberInput({
  id,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  id: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  const [text, setText] = useState(String(value));

  useEffect(() => setText(String(value)), [value]);

  return (
    <input
      id={id}
      type="number"
      min={min}
      max={max}
      step={step}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value !== "" && n >= min && n <= max) onChange(n);
      }}
    />
  );
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
