import { ValidationError } from 'class-validator';

/** Flattens class-validator's (possibly nested) ValidationError[] into readable strings. */
export function formatValidationErrors(errors: ValidationError[], prefix = ''): string[] {
  return errors.flatMap((error) => {
    const path = prefix ? `${prefix}.${error.property}` : error.property;
    const ownMessages = Object.values(error.constraints ?? {}).map(
      (message) => `${path}: ${message}`,
    );
    const childMessages = error.children?.length
      ? formatValidationErrors(error.children, path)
      : [];
    return [...ownMessages, ...childMessages];
  });
}
