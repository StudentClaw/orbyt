# Feature 7: File System

## What It Is

The File System manages local storage for downloaded assignments, research materials, notes, and any files the student works with through Student Claw. It provides markdown and PDF viewing within the app and handles file organization, so the AI can reference and work with the student's documents.

---

## Why It Exists

Students constantly deal with files — assignment PDFs, lecture notes, research papers, their own essay drafts. The File System gives Student Claw a place to store and organize these files locally, view them without leaving the app, and make them accessible to the AI for context (e.g., "summarize this PDF" or "review my draft").

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

Manage the student's local file directory within the app's data folder.

**Storage locations:**
- `~/.student-claw/files/` — General file storage
- `~/.student-claw/files/courses/<course>/` — Per-course file organization
- `~/.student-claw/files/downloads/` — Files downloaded from Canvas
- `~/.student-claw/memory/` — Memory markdown files (shared with Memory System)
- `~/.student-claw/skills/` — Skill files (shared with Skill System)

### 2. File Import

Students can bring files into Student Claw from various sources.

- **Drag and drop**: Drop a file onto the app window
- **File picker**: Native Electron file dialog
- **Canvas download**: Automatically download assignment attachments during sync
- **AI-generated**: When the AI creates a study guide or outline, save it as a file

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

### 5. File Metadata Index

SQLite index for fast search and organization without scanning the filesystem.

```
files
  id, name, path, type (md/pdf/txt/other), size,
  courseId (nullable), tags, createdAt, lastAccessedAt
```

### 6. File Context for AI

When the student wants the AI to work with a file, the File System provides it.

- **Injection**: Read file content and inject into AI context window
- **Size limits**: Large PDFs are summarized or chunked before injection
- **Supported formats**: Markdown (full text), PDF (extracted text), plain text, code files
- **Reference tracking**: When the AI references a file, link back to it in the response

---

## File Operations

| Operation | Trigger | Description |
|---|---|---|
| **Import** | Drag-drop, file picker, Canvas download | Add a file to local storage |
| **View** | Click in File Explorer | Open in built-in MD/PDF viewer |
| **Edit** | Toggle edit mode (markdown only) | In-app markdown editor |
| **Send to AI** | Right-click → "Ask AI about this" | Inject file content into chat context |
| **Export** | Share button | Open in external app or copy to clipboard |
| **Delete** | Right-click → Delete | Remove from local storage and index |
| **Organize** | Drag to course folder | Associate file with a course |

---

## Proposed File Structure

```
packages/server/src/files/
  FileService.ts              # Effect service: CRUD operations on local files
  FileIndex.ts                # SQLite metadata index management
  MarkdownProcessor.ts        # Parse and process markdown content
  PdfExtractor.ts             # Extract text from PDFs for AI context
  FileWatcher.ts              # Watch directories for external changes

packages/ui/src/components/files/
  FileExplorer.tsx            # Sidebar file tree browser
  MarkdownViewer.tsx          # Render markdown with math/code support
  MarkdownEditor.tsx          # Edit mode for markdown files
  PdfViewer.tsx               # PDF rendering with navigation
  FileDropZone.tsx            # Drag-and-drop file import
  FileContextMenu.tsx         # Right-click actions (Send to AI, Export, Delete)
```

---

## Open Questions

- **Storage limits**: Should we cap local storage usage? Students on laptops with small SSDs might care.
- **File sync**: Should files sync anywhere (cloud backup)? Or is local-only the philosophy?
- **Version history**: Should we keep versions of edited markdown files (like a simple git)?
- **Image support**: Should the viewer handle images (screenshots of whiteboards, diagrams)?
- **Annotation**: Should the PDF viewer support highlighting and annotation? This is a major feature unto itself.
- **File sharing**: Could students share files with study group members through the app?
