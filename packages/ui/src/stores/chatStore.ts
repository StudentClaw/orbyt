import { create } from "zustand"

interface ChatMessage {
  readonly id: string
  readonly role: "user" | "assistant"
  readonly content: string
  readonly timestamp: number
}

interface ChatState {
  readonly messages: readonly ChatMessage[]
  readonly isStreaming: boolean
  readonly activeSessionId: string | null
  readonly addMessage: (message: ChatMessage) => void
  readonly setStreaming: (streaming: boolean) => void
  readonly setActiveSession: (sessionId: string | null) => void
  readonly clearMessages: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isStreaming: false,
  activeSessionId: null,
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  setStreaming: (streaming) => set({ isStreaming: streaming }),
  setActiveSession: (sessionId) => set({ activeSessionId: sessionId }),
  clearMessages: () => set({ messages: [] }),
}))
