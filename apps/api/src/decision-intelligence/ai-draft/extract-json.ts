/**
 * Models occasionally wrap JSON in a ```json fence despite being told not
 * to — stripped defensively rather than trusting the instruction was
 * followed. Throws on anything that isn't parseable JSON; never guesses.
 */
export function extractJson(rawText: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)\s*```/.exec(rawText);
  const candidate = fenced ? fenced[1] : rawText.trim();

  try {
    return JSON.parse(candidate);
  } catch {
    throw new Error('The model did not return valid JSON.');
  }
}
