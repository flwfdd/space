import { posix } from "node:path";

export function normalizePath(basePath: string, relativePath?: string): string {
  if (!relativePath) return basePath;
  return posix.normalize(posix.join(basePath, relativePath));
}
