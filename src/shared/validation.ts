import Ajv, { type AnySchema } from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);

export class ContractError extends Error {
  readonly details: string;

  constructor(message: string, details: string) {
    super(message);
    this.name = 'ContractError';
    this.details = details;
  }
}
export function assertContract<T>(schema: AnySchema, value: unknown, name: string): asserts value is T {
  const validate = ajv.compile<T>(schema);
  if (!validate(value)) {
    throw new ContractError(`Invalid ${name}`, ajv.errorsText(validate.errors));
  }
}
