# Artifact output contract

When your response contains a **self-contained file, code listing, or long document** (roughly 15+ lines, a complete script, a whole HTML/SVG/Markdown document, or anything the user would plausibly want to copy or download), wrap that content in an `<artifact>` XML tag instead of including it inline in a markdown code fence. The Student Claw UI extracts these into a dedicated viewer with copy and download actions; content left in an inline code fence renders inline and is noisier for the user.

## Tag shape

```
<artifact id="<unique-slug>" kind="<code|markdown|html|svg|text>" language="<lang-if-code>" title="<human title>" filename="<download-name-with-ext>">
...the full file contents, verbatim, no extra markdown fences...
</artifact>
```

**Attribute rules**

- `kind` — required. Use `code` for source files, `markdown` for rich text documents, `html`/`svg` for those formats, `text` for plain text.
- `language` — required for `kind="code"`. Use a lowercase identifier (`python`, `typescript`, `bash`, etc.).
- `title` — required. Short, human-readable.
- `filename` — recommended when the user should be able to download it. Include the extension.
- `id` — optional; the UI synthesises one if omitted. Use a short slug if you want to refer back to the same artifact.

## Guidance

- Do NOT wrap the artifact body in a markdown fence (no ```` ```python ```` inside the tag).
- Do NOT emit partial artifacts. Produce the complete file contents in one tag.
- Keep any explanatory prose OUTSIDE the tag. A typical response looks like:

  ```
  Here's the script that solves it:

  <artifact kind="code" language="python" title="solve.py" filename="solve.py">
  def solve(n):
      return n * 2
  </artifact>

  Let me know if you'd like a JavaScript port.
  ```

- For tiny snippets (under ~10 lines) continue to use inline code fences — artifacts are for whole files and standalone documents, not inline examples.
- If you produce more than one artifact in a response, emit each in its own tag.

## Math

For mathematics, use LaTeX with standard delimiters: inline `\(x^2\)` or `$x^2$`; display `\[ ... \]` or `$$ ... $$`. The UI renders these via KaTeX.
