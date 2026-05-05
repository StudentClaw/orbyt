export function logMemoryWrite(
  _kind: string,
  _filePath: string,
  _content: string,
): void {
  // no-op in production; memory write events are not persisted to stdout.
}
