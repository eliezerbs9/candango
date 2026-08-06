/**
 * Shared logic for the `{{variable}}` autocomplete. Given the text before/after the caret, decide
 * whether to show the picker, what the partial query is, and whether the picked variable should be
 * inserted **bare** (just the key) because the caret is already INSIDE a `{{ … }}` — e.g. the second
 * key in `{{company.name or |}}`. Otherwise it inserts a fresh `{{key}}`.
 */
export interface VariableTrigger {
  from: number; // absolute index (into the full text) where the partial token starts
  query: string; // the partial word to filter variables by
  bare: boolean; // true = insert just the key (already inside {{ }}); false = wrap in {{ }}
}

export function variableTrigger(textBefore: string, textAfter: string): VariableTrigger | null {
  const openBefore = textBefore.lastIndexOf('{{');
  const closeBefore = textBefore.lastIndexOf('}}');
  const nextClose = textAfter.indexOf('}}');
  const nextOpen = textAfter.indexOf('{{');
  // We're inside an open {{ … }} only if there's an unclosed {{ before AND a }} after (before any new {{).
  const hasCloseAfter = nextClose !== -1 && (nextOpen === -1 || nextClose < nextOpen);
  const inside = openBefore > closeBefore && hasCloseAfter;

  if (inside) {
    const partial = /([\w.]*)$/.exec(textBefore)?.[1] ?? '';
    return { from: textBefore.length - partial.length, query: partial, bare: true };
  }
  // Fresh variable: only after a `{` or `{{`.
  const m = /\{{1,2}([\w.]*)$/.exec(textBefore);
  if (!m) return null;
  return { from: textBefore.length - m[0].length, query: m[1], bare: false };
}

/** The text to insert for a picked variable key, given whether we're already inside `{{ }}`. */
export const variableToken = (key: string, bare: boolean) => (bare ? key : `{{${key}}}`);
