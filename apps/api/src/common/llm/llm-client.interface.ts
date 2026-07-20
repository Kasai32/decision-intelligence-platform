export const LLM_CLIENT = Symbol('LLM_CLIENT');

export interface LlmGenerateParams {
  system: string;
  user: string;
}

/**
 * A minimal, provider-agnostic seam (see ADR-0018) — every real LLM call in
 * this codebase goes through this interface, never a provider SDK directly,
 * so swapping providers or adding a second one never touches a caller.
 */
export interface LlmClient {
  /** True only when a real API key is configured — never a soft "maybe works". */
  readonly available: boolean;

  /** Returns the model's raw text output. Callers are responsible for parsing/validating it. */
  generateText(params: LlmGenerateParams): Promise<string>;

  /**
   * Same call, but yields text as the model generates it (see ADR-0020) —
   * for a live "drafting…" UI instead of a blocking wait. Callers still
   * validate the *full* accumulated text once the generator completes;
   * streaming is a presentation concern only, it changes nothing about
   * what gets validated or accepted.
   */
  generateTextStream(params: LlmGenerateParams): AsyncGenerator<string, void, void>;
}
