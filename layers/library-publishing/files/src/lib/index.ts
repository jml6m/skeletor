/**
 * Public API of the {{PROJECT_NAME}} package: what this file exports is what consumers import.
 * Keep it free of side effects on import (no logging, no env reads), and import local modules by
 * relative path: the `#` subpath imports resolve to the app build in dist/, which isn't published.
 */

/** Replace with the library's API. */
export function greet(name: string): string {
  return `Hello, ${name}!`;
}
