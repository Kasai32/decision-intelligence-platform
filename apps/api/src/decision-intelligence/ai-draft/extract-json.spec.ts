import { extractJson } from './extract-json';

describe('extractJson', () => {
  it('parses plain JSON', () => {
    expect(extractJson('{"a": 1}')).toEqual({ a: 1 });
  });

  it('strips a ```json fence the model added despite being told not to', () => {
    expect(extractJson('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
  });

  it('strips a bare ``` fence with no language tag', () => {
    expect(extractJson('```\n{"a": 1}\n```')).toEqual({ a: 1 });
  });

  it('throws on non-JSON output instead of guessing', () => {
    expect(() => extractJson('sorry, I cannot help with that')).toThrow(
      'The model did not return valid JSON.',
    );
  });
});
