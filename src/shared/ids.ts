import { v7 as uuidv7, validate, version } from 'uuid';

/** New time-ordered UUIDv7. All entity ids are generated in the application with this. */
export function newId(): string {
  return uuidv7();
}

export function isUuidV7(value: string): boolean {
  return validate(value) && version(value) === 7;
}
