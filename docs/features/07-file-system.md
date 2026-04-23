# Feature 7: File System

## What It Is

The File System manages local storage for downloaded assignments, research materials, notes, and any files the student works with through Orbyt. It provides markdown and PDF viewing within the app and handles file organization, so the AI can reference and work with the student's documents.

---

## Why It Exists

Students constantly deal with files — assignment PDFs, lecture notes, research papers, their own essay drafts. The File System gives Orbyt a place to store and organize these files locally, view them without leaving the app, and make them accessible to the AI for context (e.g., "summarize this PDF" or "review my draft").

It also underpins the Memory System (markdown files) and the Skill System (skill files are stored on disk).

---

## Dependencies

```
Electron Shell ──→ File System (file dialogs, native file access)
SQLite Database ──→ File System (file metadata index)
Shared Contracts ──→ File System (FileEntry schema)
```

| Depends On | Why |
|---|---|
| **Electron Shell** | Native file picker dialogs, `app.getPath()` for storage locations, shell.openPath for external open |
| **SQLite Database** | File metadata index (name, path, type, size, course association, last accessed) |
| **Shared Contracts** | `FileEntry` schema |

| Depended On By | Why |
|---|---|
| **Memory System** | Markdown memory files stored and managed via File System |
| **Skill System** | Skill `.md` files loaded from disk |
| **AI Harness** | File content can be injected into AI context for review/analysis |
| **Canvas Integration** | Downloaded assignment attachments stored via File System |

---

## Core Responsibilities

### 1. Local File Storage

All storage is local-only — no cloud sync. No storage cap; students manage their own disk.

**Storage locations:**
- `~/.orbyt/files/` — General file storage
- `~/.orbyt/files/courses/<course>/` — Per-course file organization
- `~/.orbyt/files/downloads/` — Files downloaded from Canvas
- `~/.orbyt/trash/` — Soft-deleted files (purged after 30 days or on manual empty)
- `~/.orbyt/memory/` — Memory markdown files (shared with Memory System)
- `~/.orbyt/skills/` — Skill files (shared with Skill System)

### 2. File Import

Every import copies the file into the app's storage directory. The app always works with its own copy — no references to external paths that could break if the student moves or deletes the original.

- **Drag and drop**: Drop a file onto the app window — copied into `~/.orbyt/files/`
- **File picker**: Native Electron file dialog — copied into `~/.orbyt/files/`
- **Canvas download**: Downloaded and copied into `~/.orbyt/files/downloads/`
- **AI-generated**: When the AI creates a study guide or outline, saved directly into storage

### 3. Markdown Viewer

Built-in rendering for `.md` files with academic features.

- GitHub-flavored markdown rendering
- LaTeX/KaTeX math rendering (essential for STEM students)
- Syntax highlighting for code blocks
- Table support
- Checkbox lists (for to-do tracking within notes)
- Edit mode: toggle between view and edit for the student's own files

### 4. PDF Viewer

Built-in PDF rendering for assignment sheets, research papers, and lecture slides.

- Page-by-page rendering
- Zoom controls
- Search within PDF
- Text selection (for copying into chat or notes)
- Thumbnail navigation for long documents
- Optional: AI-powered PDF summary ("Summarize this paper in 3 bullet points")

### 5. Other File Viewers

Support for the full range of files students commonly work with.

| Format | Viewer |
|---|---|
| `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp` | Inline image display |
| `.docx` | Rendered text view (via mammoth.js or similar) |
| `.pptx` | Slide-by-slide view (best-effort rendering) |
| `.txt`, `.csv` | Plain text display |
| Code files (`.py`, `.js`, `.ts`, `.java`, etc.) | Syntax-highlighted text view |

Files with no supported viewer open externally via `shell.openPath`.

### 6. File Metadata Index

SQLite index for fast search and organization without scanning the filesystem.

Primary organization axis is **course** — files belong to a course or are uncategorized. **Tags** are secondary: optional free-form labels (e.g. "midterm prep", "primary source") that can span courses and are filterable in the File Explorer.

```
files
  id, name, path, type (md/pdf/txt/docx/image/code/other), size,
  courseId (nullable), tags (string array), createdAt, lastAccessedAt,
  deletedAt (nullable) — set on soft delete, null means active
```

### 7. File Context for AI

When the student wants the AI to work with a file, the File System extracts the content and passes a structured object to the AI Harness. The Harness handles all prompt formatting.

```ts
interface FileContext {
  name: string
  type: 'md' | 'pdf' | 'docx' | 'txt' | 'image' | 'code' | 'other'
  content: string             // extracted text (images: empty or alt description)
  summarized: boolean         // true if content was produced via layered summarization
}
```

- **Markdown**: full text passed as-is
- **PDF / DOCX**: text extracted before passing
- **Images**: content is empty; the Harness handles multimodal injection separately
- **Large files**: layered summarization — split into chunks, summarize each chunk, then summarize the summaries into a single condensed representation that fits the context window. `summarized` is set to `true` so the Harness can surface a note that the content was compressed.

---

## File Operations

| Operation | Trigger | Description |
|---|---|---|
| **Import** | Drag-drop, file picker, Canvas download | Add a file to local storage |
| **View** | Click in File Explorer | Open in built-in MD/PDF viewer |
| **Edit** | Toggle edit mode (markdown only) | In-app markdown editor |
| **Send to AI** | Right-click → "Ask AI about this" | Inject file content into chat context |
| **Open Externally** | Share button → "Open in [App]" | `shell.openPath()` to OS default app |
| **Export** | Share button → "Save a Copy…" | OS save dialog — copies file to user-chosen location |
| **Delete** | Right-click → Delete | Move to trash (`~/.orbyt/trash/`); purged after 30 days or manual empty |
| **Restore** | Trash → Restore | Move file back to its original location and re-index |
| **Organize** | Drag to course folder | Associate file with a course |

---

## Proposed File Structure

```
packages/server/src/files/
  FileService.ts              # Effect service: CRUD operations on local files
  FileIndex.ts                # SQLite metadata index management
  MarkdownProcessor.ts        # Parse and process markdown content
  PdfExtractor.ts             # Extract text from PDFs for AI context
  FileWatcher.ts              # Watch directories for external changes; silently re-indexes on modification (updates metadata, invalidates content cache)

packages/ui/src/components/files/
  FileExplorer.tsx            # Sidebar file tree browser (course folders + tag filters)
  MarkdownViewer.tsx          # Render markdown with math/code support
  MarkdownEditor.tsx          # Edit mode for markdown files
  PdfViewer.tsx               # PDF rendering with navigation
  DocxViewer.tsx              # Rendered text view for .docx files
  ImageViewer.tsx             # Inline image display
  CodeViewer.tsx              # Syntax-highlighted plain text / code files
  TrashView.tsx               # Trash browser with restore and empty actions
  FileDropZone.tsx            # Drag-and-drop file import
  FileContextMenu.tsx         # Right-click actions (Send to AI, Share, Delete, Organize)
```

---

## Future Considerations

- **PDF annotation** (post-V1): Highlighting and inline notes on PDFs. Significant scope — store annotation data separately from the file, render highlight layer over the PDF viewer. Defer until core features are stable.
