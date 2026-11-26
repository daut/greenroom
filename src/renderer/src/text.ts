export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatUsd(amount: number): string {
  return amount < 1 ? `$${amount.toFixed(2)}` : `$${amount.toFixed(amount < 10 ? 2 : 0)}`;
}

/** Error text without Electron's "Error invoking remote method '…': Error:" prefix. */
export function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/^Error invoking remote method '[^']+': (Error: )?/, "");
}

const ROMAN: [number, string][] = [
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

/** Act numbers; an interview loop can have more than twelve. */
export function roman(n: number): string {
  if (n < 1 || n >= 50) return String(n);
  let rest = n;
  let out = "";
  for (const [value, symbol] of ROMAN) {
    while (rest >= value) {
      out += symbol;
      rest -= value;
    }
  }
  return out;
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function dateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
