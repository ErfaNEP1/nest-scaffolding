import { type Config, ConfigValidationError, loadConfig } from './config';

/**
 * Loads configuration for an entrypoint. On invalid configuration it prints the list of
 * problems and exits, before any module is created.
 */
export function loadConfigOrExit(): Config {
  try {
    return loadConfig();
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      process.stderr.write(`${error.message}\n`);
      process.exit(1);
    }
    throw error;
  }
}
