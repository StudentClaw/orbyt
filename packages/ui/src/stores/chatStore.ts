import { create } from "zustand"

export type ChatStatus =
  | "idle"
  | "streaming"
  | "interrupted"
  | "offline"
  | "rate-limited"
  | "auth-expired"
  | "error"

export interface ToolCallInfo {
  readonly toolName: string
  readonly args: string
  readonly status: "pending" | "complete" | "error"
}

export interface ChatMessage {
  readonly id: string
  readonly role: "user" | "assistant"
  readonly content: string
  readonly timestamp: number
  readonly isStreaming?: boolean
  readonly toolCalls?: readonly ToolCallInfo[]
  readonly reasoning?: string
}

export interface ChatSession {
  readonly id: string
  readonly title: string
  readonly createdAt: number
  readonly pinnedAt: number | null
}

interface ChatState {
  readonly messages: readonly ChatMessage[]
  readonly status: ChatStatus
  readonly activeSessionId: string | null
  readonly error: string | null
  readonly chatPanelOpen: boolean
  readonly sessions: readonly ChatSession[]
  readonly addMessage: (message: ChatMessage) => void
  readonly updateMessage: (id: string, patch: Partial<ChatMessage>) => void
  readonly setStatus: (status: ChatStatus) => void
  readonly setActiveSession: (sessionId: string | null) => void
  readonly setError: (error: string | null) => void
  readonly clearMessages: () => void
  readonly toggleChatPanel: () => void
  readonly createSession: () => void
  readonly selectSession: (sessionId: string) => void
  readonly deleteSession: (sessionId: string) => void
  readonly renameSession: (sessionId: string, title: string) => void
  readonly pinSession: (sessionId: string) => void
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  status: "idle",
  activeSessionId: null,
  error: null,
  chatPanelOpen: false,
  sessions: [],
  addMessage: (message) =>
    set((state) => {
      const newMessages = [...state.messages, message]
      // Auto-title active session on first user message
      if (
        message.role === "user" &&
        state.activeSessionId &&
        !state.messages.some((m) => m.role === "user")
      ) {
        const title = message.content.slice(0, 40).trim() || "New chat"
        return {
          messages: newMessages,
          sessions: state.sessions.map((s) =>
            s.id === state.activeSessionId ? { ...s, title } : s
          ),
        }
      }
      return { messages: newMessages }
    }),
  updateMessage: (id, patch) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, ...patch } : msg
      ),
    })),
  setStatus: (status) => set({ status }),
  setActiveSession: (sessionId) => set({ activeSessionId: sessionId }),
  setError: (error) => set({ error }),
  clearMessages: () => set({ messages: [] }),
  toggleChatPanel: () =>
    set((state) => ({ chatPanelOpen: !state.chatPanelOpen })),
  createSession: () =>
    set((state) => {
      const id = crypto.randomUUID()
      const newSession: ChatSession = { id, title: "New chat", createdAt: Date.now(), pinnedAt: null }
      return {
        sessions: [newSession, ...state.sessions],
        activeSessionId: id,
        messages: [],
        chatPanelOpen: true,
      }
    }),
  selectSession: (sessionId) =>
    set({ activeSessionId: sessionId, messages: [], chatPanelOpen: true }),
  deleteSession: (sessionId) =>
    set((state) => {
      const remaining = state.sessions.filter((s) => s.id !== sessionId)
      const wasActive = state.activeSessionId === sessionId
      return {
        sessions: remaining,
        activeSessionId: wasActive ? (remaining[0]?.id ?? null) : state.activeSessionId,
        messages: wasActive ? [] : state.messages,
        chatPanelOpen: wasActive ? remaining.length > 0 : state.chatPanelOpen,
      }
    }),
  renameSession: (sessionId, title) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId ? { ...s, title } : s
      ),
    })),
  pinSession: (sessionId) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId ? { ...s, pinnedAt: s.pinnedAt ? null : Date.now() } : s
      ),
    })),
}))
