import { beforeEach, describe, test, expect, vi } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { IpcChannel, type ChatModel, type TurnAttachmentInput } from "@orbyt/contracts"
import { PromptInput } from "../components/chat/PromptInput"

type ElectronAPI = NonNullable<Window["electronAPI"]>

function setElectronApi(
  invoke: ElectronAPI["invoke"],
  getPathForFile?: ElectronAPI["getPathForFile"],
) {
  window.electronAPI = {
    getBootstrap: vi.fn().mockResolvedValue(null),
    codexAuthStart: vi.fn().mockResolvedValue({ status: "connected" as const }),
    invoke,
    send: vi.fn(),
    on: vi.fn().mockReturnValue(() => {}),
    getPathForFile,
  }
}

function createFileDragEvent(type: string, files: File[] = []) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, "dataTransfer", {
    value: { files, types: files.length > 0 ? ["Files"] : [] },
    configurable: true,
  })
  return event
}

describe("PromptInput", () => {
  const availableModels: readonly ChatModel[] = [
    {
      id: "gpt-5.4",
      label: "GPT-5.4",
      description: "Best general-purpose model",
      group: "standard",
    },
    {
      id: "gpt-5.4-mini",
      label: "GPT-5.4 Mini",
      description: "Fast default model",
      group: "standard",
    },
    {
      id: "gpt-5.3-codex",
      label: "GPT-5.3 Codex",
      description: "Best coding-focused option",
      group: "standard",
    },
  ]

  const defaultProps = {
    onSend: vi.fn(),
    onInterrupt: vi.fn(),
    status: "idle" as const,
    connectionState: "connected" as const,
    availableModels,
    selectedModel: "gpt-5.4-mini",
    onModelChange: vi.fn(),
    accessMode: "default" as const,
    onAccessModeChange: vi.fn(),
    onRespondToApproval: vi.fn(),
  }

  beforeEach(() => {
    const invoke = vi.fn(async (channel, ..._args) => {
        if (channel === IpcChannel.FILE_SELECT_ATTACHMENTS) {
          return null
        }

        if (channel === IpcChannel.FILE_GET_ATTACHMENT_METADATA) {
          return []
        }

        return null
      }) as ElectronAPI["invoke"]

    setElectronApi(invoke)
  })

  test("renders textarea with placeholder", () => {
    render(<PromptInput {...defaultProps} />)
    expect(screen.getByText("What would you like to know?")).toBeDefined()
  })

  test("shows connecting placeholder when connecting", () => {
    render(<PromptInput {...defaultProps} connectionState="connecting" />)
    expect(screen.getByText("Connecting to Orbyt...")).toBeDefined()
  })

  test("shows reconnecting placeholder when disconnected", () => {
    render(<PromptInput {...defaultProps} connectionState="disconnected" />)
    expect(screen.getByText("Reconnecting...")).toBeDefined()
  })

  test("shows wait placeholder when streaming", () => {
    render(<PromptInput {...defaultProps} status="streaming" />)
    expect(screen.getByText("Wait for response...")).toBeDefined()
  })

  test("renders a loading overlay and locks the composer while preparing", () => {
    render(
      <PromptInput
        {...defaultProps}
        disabled={true}
        disabledReason="Warming the local Codex runtime for chat."
        loading={true}
        loadingLabel="Preparing Codex"
        loadingDetail="Warming the local Codex runtime for chat."
      />,
    )

    const overlay = screen.getByTestId("composer-loading-overlay")
    expect(overlay).toBeDefined()
    expect(within(overlay).getByRole("progressbar", { name: "Runtime readiness progress" })).toBeDefined()
    expect(screen.getByLabelText("Chat message input").getAttribute("aria-disabled")).toBe("true")
    expect(screen.getByLabelText("Send message").hasAttribute("disabled")).toBe(true)
  })

  test("disables textarea when disconnected", () => {
    render(<PromptInput {...defaultProps} connectionState="disconnected" />)
    const textarea = screen.getByLabelText("Chat message input")
    expect(textarea.getAttribute("aria-disabled")).toBe("true")
  })

  test("send button is disabled when empty", () => {
    render(<PromptInput {...defaultProps} />)
    const sendBtn = screen.getByLabelText("Send message")
    expect(sendBtn.hasAttribute("disabled")).toBe(true)
  })

  test("send button enables when text is entered", async () => {
    const user = userEvent.setup()
    render(<PromptInput {...defaultProps} />)
    await user.type(screen.getByLabelText("Chat message input"), "Hello")
    const sendBtn = screen.getByLabelText("Send message")
    expect(sendBtn.hasAttribute("disabled")).toBe(false)
  })

  test("calls onSend with trimmed content on click", async () => {
    const onSend = vi.fn()
    const user = userEvent.setup()
    render(<PromptInput {...defaultProps} onSend={onSend} />)
    await user.type(screen.getByLabelText("Chat message input"), "  Hello  ")
    await user.click(screen.getByLabelText("Send message"))
    expect(onSend).toHaveBeenCalledWith({ content: "Hello", attachments: [], references: [] })
  })

  test("calls onSend on Enter key", async () => {
    const onSend = vi.fn()
    const user = userEvent.setup()
    render(<PromptInput {...defaultProps} onSend={onSend} />)
    await user.type(screen.getByLabelText("Chat message input"), "Hello{Enter}")
    expect(onSend).toHaveBeenCalledWith({ content: "Hello", attachments: [], references: [] })
  })

  test("Shift+Enter inserts newline instead of sending", async () => {
    const onSend = vi.fn()
    const user = userEvent.setup()
    render(<PromptInput {...defaultProps} onSend={onSend} />)
    await user.type(screen.getByLabelText("Chat message input"), "Line 1{Shift>}{Enter}{/Shift}Line 2")
    expect(onSend).not.toHaveBeenCalled()
  })

  test("clears input after sending", async () => {
    const user = userEvent.setup()
    render(<PromptInput {...defaultProps} onSend={vi.fn()} />)
    const textarea = screen.getByLabelText("Chat message input")
    await user.type(textarea, "Hello{Enter}")
    expect(textarea.textContent).toBe("")
  })

  test("shows Stop button during streaming", () => {
    render(<PromptInput {...defaultProps} status="streaming" />)
    expect(screen.getByLabelText("Stop generating")).toBeDefined()
  })

  test("calls onInterrupt when Stop is clicked", async () => {
    const onInterrupt = vi.fn()
    const user = userEvent.setup()
    render(<PromptInput {...defaultProps} status="streaming" onInterrupt={onInterrupt} />)
    await user.click(screen.getByLabelText("Stop generating"))
    expect(onInterrupt).toHaveBeenCalledOnce()
  })

  test("shows Stop button while status is queued", () => {
    render(<PromptInput {...defaultProps} status="queued" />)
    expect(screen.getByLabelText("Stop generating")).toBeDefined()
    expect(screen.queryByLabelText("Send message")).toBeNull()
  })

  test("shows disabled Stop with Stopping… label while status is interrupting", () => {
    render(<PromptInput {...defaultProps} status="interrupting" />)
    const stopBtn = screen.getByLabelText("Stopping…")
    expect(stopBtn).toBeDefined()
    expect(stopBtn.hasAttribute("disabled")).toBe(true)
    expect(screen.getByTestId("interrupt-pending-hint")).toBeDefined()
  })

  test("shows disabled Stop when interruptPending is true during streaming", () => {
    render(<PromptInput {...defaultProps} status="streaming" interruptPending={true} />)
    const stopBtn = screen.getByLabelText("Stopping…")
    expect(stopBtn.hasAttribute("disabled")).toBe(true)
    expect(stopBtn.getAttribute("data-pending")).toBe("true")
  })

  test("rapid double-click fires onInterrupt exactly once when interruptPending is true", async () => {
    const onInterrupt = vi.fn()
    const user = userEvent.setup()
    render(
      <PromptInput
        {...defaultProps}
        status="streaming"
        interruptPending={true}
        onInterrupt={onInterrupt}
      />,
    )
    const stopBtn = screen.getByLabelText("Stopping…")
    await user.click(stopBtn)
    await user.click(stopBtn)
    expect(onInterrupt).not.toHaveBeenCalled()
  })

  test("does not fire Send when transitioning from streaming to interrupting", async () => {
    const onSend = vi.fn()
    const onInterrupt = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(
      <PromptInput
        {...defaultProps}
        status="streaming"
        onSend={onSend}
        onInterrupt={onInterrupt}
      />,
    )
    rerender(
      <PromptInput
        {...defaultProps}
        status="interrupting"
        onSend={onSend}
        onInterrupt={onInterrupt}
      />,
    )
    const stopBtn = screen.getByLabelText("Stopping…")
    await user.click(stopBtn)
    expect(onSend).not.toHaveBeenCalled()
    expect(screen.queryByLabelText("Send message")).toBeNull()
  })

  test("renders interruptError with role alert", () => {
    render(
      <PromptInput
        {...defaultProps}
        status="streaming"
        interruptError="Failed to stop the turn."
      />,
    )
    const alert = screen.getByTestId("interrupt-error")
    expect(alert.getAttribute("role")).toBe("alert")
    expect(alert.textContent).toBe("Failed to stop the turn.")
  })

  test("shows the selected model label", () => {
    render(<PromptInput {...defaultProps} />)
    expect(screen.getByText("GPT-5.4 Mini")).toBeDefined()
  })

  test("adds attachments from the native picker and sends them with the message", async () => {
    const onSend = vi.fn()
    const user = userEvent.setup()
    const invokeMock = vi.fn(async (channel, ...args) => {
      const payload = args[0] as { paths: readonly string[] } | undefined

      if (channel === IpcChannel.FILE_SELECT_ATTACHMENTS) {
        return ["/Users/rereynrd/Desktop/diagram.png", "/Users/rereynrd/Desktop/notes.md"]
      }

      if (channel === IpcChannel.FILE_GET_ATTACHMENT_METADATA) {
        expect(payload).toEqual({
          paths: ["/Users/rereynrd/Desktop/diagram.png", "/Users/rereynrd/Desktop/notes.md"],
        })

        return [
          {
            path: "/Users/rereynrd/Desktop/diagram.png",
            name: "diagram.png",
            mimeType: "image/png",
            sizeBytes: 2048,
            kind: "image" as const,
          },
          {
            path: "/Users/rereynrd/Desktop/notes.md",
            name: "notes.md",
            mimeType: "text/markdown",
            sizeBytes: 256,
            kind: "file" as const,
          },
        ]
      }

      return null
    }) as ElectronAPI["invoke"]

    setElectronApi(invokeMock)

    render(<PromptInput {...defaultProps} onSend={onSend} />)

    await user.click(screen.getByLabelText("Add attachments"))

    expect(await screen.findByText("diagram.png")).toBeDefined()
    expect(screen.getByText("notes.md")).toBeDefined()

    await user.click(screen.getByLabelText("Send message"))

    expect(onSend).toHaveBeenCalledWith({
      content: "",
      attachments: [
        {
          path: "/Users/rereynrd/Desktop/diagram.png",
          name: "diagram.png",
          mimeType: "image/png",
          sizeBytes: 2048,
          kind: "image",
        },
        {
          path: "/Users/rereynrd/Desktop/notes.md",
          name: "notes.md",
          mimeType: "text/markdown",
          sizeBytes: 256,
          kind: "file",
        },
      ],
      references: [],
    })
  })

  test("removes an attachment from the composer before sending", async () => {
    const user = userEvent.setup()
    const invokeMock = vi.fn(async (channel) => {
      if (channel === IpcChannel.FILE_SELECT_ATTACHMENTS) {
        return ["/Users/rereynrd/Desktop/notes.md"]
      }

      if (channel === IpcChannel.FILE_GET_ATTACHMENT_METADATA) {
        return [
          {
            path: "/Users/rereynrd/Desktop/notes.md",
            name: "notes.md",
            mimeType: "text/markdown",
            sizeBytes: 256,
            kind: "file" as const,
          },
        ]
      }

      return null
    }) as ElectronAPI["invoke"]

    setElectronApi(invokeMock)

    render(<PromptInput {...defaultProps} />)

    await user.click(screen.getByLabelText("Add attachments"))
    expect(await screen.findByText("notes.md")).toBeDefined()

    await user.click(screen.getByLabelText("Remove"))
    expect(screen.queryByText("notes.md")).toBeNull()
    expect(screen.getByLabelText("Send message").hasAttribute("disabled")).toBe(true)
  })

  test("changes the selected model from the selector", async () => {
    const onModelChange = vi.fn()
    const user = userEvent.setup()
    render(<PromptInput {...defaultProps} onModelChange={onModelChange} />)

    await user.click(screen.getByLabelText("Select model"))
    await user.click(screen.getByText("GPT-5.3 Codex"))

    expect(onModelChange).toHaveBeenCalledWith("gpt-5.3-codex")
  })

  test("hides the selector when the runtime exposes a single model", () => {
    render(
      <PromptInput
        {...defaultProps}
        availableModels={[availableModels[0]!]}
      />,
    )

    expect(screen.queryByLabelText("Select model")).toBeNull()
  })

  describe("drag and drop attachments", () => {
    function setupDropMocks(metadataByPath: Record<string, TurnAttachmentInput>) {
      const getPathForFile = vi.fn((file: File) =>
        Object.keys(metadataByPath).find((p) => p.endsWith(file.name)) ?? ""
      )
      const invoke = vi.fn(async (channel, ...args) => {
        const payload = args[0] as { paths: readonly string[] } | undefined
        if (channel === IpcChannel.FILE_GET_ATTACHMENT_METADATA) {
          return (payload?.paths ?? [])
            .map((p) => metadataByPath[p])
            .filter(Boolean) as TurnAttachmentInput[]
        }
        return null
      }) as ElectronAPI["invoke"]
      setElectronApi(invoke, getPathForFile)
      return { getPathForFile, invoke }
    }

    test("shows drag overlay when files are dragged over the composer", () => {
      setupDropMocks({})
      render(<PromptInput {...defaultProps} />)
      const composerArea = screen.getByTestId("composer-area")
      const file = new File(["content"], "photo.png", { type: "image/png" })

      fireEvent(composerArea, createFileDragEvent("dragenter", [file]))

      expect(screen.getByTestId("drag-drop-overlay")).toBeDefined()
    })

    test("hides drag overlay when drag leaves the composer", () => {
      setupDropMocks({})
      render(<PromptInput {...defaultProps} />)
      const composerArea = screen.getByTestId("composer-area")
      const file = new File(["content"], "photo.png", { type: "image/png" })

      fireEvent(composerArea, createFileDragEvent("dragenter", [file]))
      expect(screen.getByTestId("drag-drop-overlay")).toBeDefined()

      fireEvent(composerArea, createFileDragEvent("dragleave"))
      expect(screen.queryByTestId("drag-drop-overlay")).toBeNull()
    })

    test("does not show overlay for non-file drag events", () => {
      setupDropMocks({})
      render(<PromptInput {...defaultProps} />)
      const composerArea = screen.getByTestId("composer-area")

      const event = new Event("dragenter", { bubbles: true, cancelable: true })
      Object.defineProperty(event, "dataTransfer", {
        value: { files: [], types: ["text/plain"] },
        configurable: true,
      })
      fireEvent(composerArea, event)

      expect(screen.queryByTestId("drag-drop-overlay")).toBeNull()
    })

    test("adds dropped files as attachments", async () => {
      const metadata: TurnAttachmentInput = {
        path: "/Users/test/photo.png",
        name: "photo.png",
        mimeType: "image/png",
        sizeBytes: 7,
        kind: "image" as const,
      }
      setupDropMocks({ "/Users/test/photo.png": metadata })
      render(<PromptInput {...defaultProps} />)
      const composerArea = screen.getByTestId("composer-area")
      const file = new File(["content"], "photo.png", { type: "image/png" })

      fireEvent(composerArea, createFileDragEvent("drop", [file]))

      expect(await screen.findByText("photo.png")).toBeDefined()
    })

    test("hides drag overlay after drop", async () => {
      const metadata: TurnAttachmentInput = {
        path: "/Users/test/photo.png",
        name: "photo.png",
        mimeType: "image/png",
        sizeBytes: 7,
        kind: "image" as const,
      }
      setupDropMocks({ "/Users/test/photo.png": metadata })
      render(<PromptInput {...defaultProps} />)
      const composerArea = screen.getByTestId("composer-area")
      const file = new File(["content"], "photo.png", { type: "image/png" })

      fireEvent(composerArea, createFileDragEvent("dragenter", [file]))
      expect(screen.getByTestId("drag-drop-overlay")).toBeDefined()

      fireEvent(composerArea, createFileDragEvent("drop", [file]))
      await waitFor(() => {
        expect(screen.queryByTestId("drag-drop-overlay")).toBeNull()
      })
    })

    test("sends dropped attachments with the message", async () => {
      const onSend = vi.fn()
      const metadata: TurnAttachmentInput = {
        path: "/Users/test/notes.md",
        name: "notes.md",
        mimeType: "text/markdown",
        sizeBytes: 12,
        kind: "file" as const,
      }
      setupDropMocks({ "/Users/test/notes.md": metadata })
      const user = userEvent.setup()
      render(<PromptInput {...defaultProps} onSend={onSend} />)
      const composerArea = screen.getByTestId("composer-area")
      const file = new File(["hello world"], "notes.md", { type: "text/markdown" })

      fireEvent(composerArea, createFileDragEvent("drop", [file]))
      expect(await screen.findByText("notes.md")).toBeDefined()

      await user.click(screen.getByLabelText("Send message"))

      expect(onSend).toHaveBeenCalledWith(
        expect.objectContaining({ attachments: [metadata] }),
      )
    })
  })

  describe("mention picker wiring (Phase 05)", () => {
    const assignment = {
      id: "canvas-course:42:assignment:12345",
      label: "Essay 3",
      url: "https://canvas.example.edu/courses/42/assignments/12345",
      courseCode: "ENG 101",
    }

    test("typing @ opens MentionPicker", async () => {
      const user = userEvent.setup()
      render(
        <PromptInput
          {...defaultProps}
          assignments={[assignment]}
          workspaceRoot="/repo"
        />,
      )
      await user.type(screen.getByLabelText("Chat message input"), "@")
      expect(await screen.findByText("Essay 3")).toBeDefined()
    })

    test("clicking an assignment inserts a chip and submit carries references", async () => {
      const onSend = vi.fn()
      const user = userEvent.setup()
      render(
        <PromptInput
          {...defaultProps}
          onSend={onSend}
          assignments={[assignment]}
          workspaceRoot="/repo"
        />,
      )
      await user.type(screen.getByLabelText("Chat message input"), "@")
      const row = await screen.findByText("Essay 3")
      await user.click(row)
      await user.click(screen.getByLabelText("Send message"))
      expect(onSend).toHaveBeenCalledWith(
        expect.objectContaining({
          references: [
            expect.objectContaining({
              kind: "canvas-assignment",
              id: "canvas-course:42:assignment:12345",
              label: "Essay 3",
              url: "https://canvas.example.edu/courses/42/assignments/12345",
            }),
          ],
        }),
      )
    })

    test("ArrowDown + Enter selects a mention via keyboard without leaving the composer", async () => {
      const onSend = vi.fn()
      const user = userEvent.setup()
      const otherAssignment = {
        id: "canvas-course:42:assignment:99999",
        label: "Reading Response",
        url: "https://canvas.example.edu/courses/42/assignments/99999",
        courseCode: "ENG 101",
      }
      render(
        <PromptInput
          {...defaultProps}
          onSend={onSend}
          assignments={[assignment, otherAssignment]}
          workspaceRoot="/repo"
        />,
      )
      const input = screen.getByLabelText("Chat message input")
      await user.type(input, "@")
      await screen.findByText("Essay 3")
      await user.keyboard("{ArrowDown}{Enter}")
      await user.click(screen.getByLabelText("Send message"))
      expect(onSend).toHaveBeenCalledWith(
        expect.objectContaining({
          references: [
            expect.objectContaining({
              kind: "canvas-assignment",
              id: "canvas-course:42:assignment:99999",
              label: "Reading Response",
            }),
          ],
        }),
      )
    })

    test("Grant access button fires onRequestCanvasAccess when canReadCanvas is false", async () => {
      const onRequestCanvasAccess = vi.fn()
      const user = userEvent.setup()
      render(
        <PromptInput
          {...defaultProps}
          assignments={[]}
          workspaceRoot="/repo"
          canReadCanvas={false}
          onRequestCanvasAccess={onRequestCanvasAccess}
        />,
      )
      await user.type(screen.getByLabelText("Chat message input"), "@")
      const grant = await screen.findByRole("button", { name: /grant access/i })
      await user.click(grant)
      expect(onRequestCanvasAccess).toHaveBeenCalled()
    })
  })
})
