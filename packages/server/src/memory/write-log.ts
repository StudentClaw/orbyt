export function logMemoryWrite(
  kind: string,
  filePath: string,
  content: string,
): void {
  console.log(
    [
      `[Memorize] wrote ${kind}: ${filePath}`,
      "--- memory content start ---",
      content.trimEnd(),
      "--- memory content end ---",
    ].join("\n"),
  )
}
