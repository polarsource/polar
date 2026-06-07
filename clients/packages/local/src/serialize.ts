/**
 * Canonical JSON: stable key ordering + bigint → decimal string.
 *
 * Two invoices are equal iff their canonical JSON is byte-identical. That makes
 * the determinism guarantee mechanically checkable — a golden file — instead of
 * a vibe. Key sorting removes object-insertion-order as a hidden input.
 */
const canonicalize = (value: unknown): unknown => {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
};

export const canonicalJson = (value: unknown): string => JSON.stringify(canonicalize(value), null, 2);
