import type {
  ProviderPendingApproval,
} from "@orbyt/contracts"
import {
  type CodexCliService,
  ProviderRuntimeFailure,
} from "../../ai/CodexCli.js"

export type ControlledRuntime = CodexCliService & {
  readonly id: string
  readonly streamCalls: Array<{ threadId: string; turnId: string; content: string }>
  readonly interruptedTurns: string[]
  shutdownCount: number
  completeTurn: (turnId: string) => Promise<void>
  interruptTurnCallback: (turnId: string) => Promise<void>
  failTurn: (turnId: string, error: ProviderRuntimeFailure) => Promise<void>
  emitApproval: (turnId: string, approvalId: string) => Promise<void>
  emitToken: (turnId: string, token: string) => Promise<void>
  activeTurnIds: () => string[]
}

export type ControlledRuntimeFactory = {
  readonly factory: () => ControlledRuntime
  readonly runtimes: ControlledRuntime[]
}

export function createControlledRuntimeFactory(): ControlledRuntimeFactory {
  const runtimes: ControlledRuntime[] = []

  const factory = (): ControlledRuntime => {
    const pendingApprovals = new Map<string, ProviderPendingApproval>()
    const activeTurns = new Map<string, Parameters<CodexCliService["streamTurn"]>[0]>()
    const runtime: ControlledRuntime = {
      id: `runtime-${runtimes.length + 1}`,
      streamCalls: [],
      interruptedTurns: [],
      shutdownCount: 0,
      initialize: async () => undefined,
      retryInitialize: async () => true,
      startAuth: async () => true,
      reloadGatewayTools: async () => true,
      streamTurn: async (input) => {
        runtime.streamCalls.push({
          threadId: input.localThreadId,
          turnId: input.localTurnId,
          content: input.content,
        })
        activeTurns.set(input.localTurnId, input)
      },
      listPendingApprovals: () => Array.from(pendingApprovals.values()),
      respondToApproval: async (approvalRequestId, decision) => {
        const approval = pendingApprovals.get(approvalRequestId)
        if (!approval) {
          return {
            approvalRequestId,
            threadId: "",
            turnId: "",
            decision,
            resolved: false,
          }
        }
        pendingApprovals.delete(approvalRequestId)
        return {
          approvalRequestId,
          threadId: String(approval.threadId),
          turnId: String(approval.turnId),
          decision,
          resolved: true,
        }
      },
      interruptTurn: async (_threadId, turnId) => {
        runtime.interruptedTurns.push(turnId)
        return activeTurns.has(turnId)
      },
      shutdown: async () => {
        runtime.shutdownCount += 1
        activeTurns.clear()
        pendingApprovals.clear()
      },
      completeTurn: async (turnId) => {
        const input = activeTurns.get(turnId)
        if (!input) return
        activeTurns.delete(turnId)
        await input.onCompleted()
      },
      interruptTurnCallback: async (turnId) => {
        const input = activeTurns.get(turnId)
        if (!input) return
        activeTurns.delete(turnId)
        await input.onInterrupted()
      },
      failTurn: async (turnId, error) => {
        const input = activeTurns.get(turnId)
        if (!input) return
        activeTurns.delete(turnId)
        await input.onError(error)
      },
      emitApproval: async (turnId, approvalId) => {
        const input = activeTurns.get(turnId)
        if (!input) return
        const approval: ProviderPendingApproval = {
          id: approvalId as ProviderPendingApproval["id"],
          threadId: input.localThreadId as ProviderPendingApproval["threadId"],
          turnId: input.localTurnId as ProviderPendingApproval["turnId"],
          kind: "command",
          itemId: `item-${approvalId}`,
          approvalId,
          reason: null,
          command: "echo test",
          cwd: "/repo",
          availableDecisions: ["approve", "deny"],
        }
        pendingApprovals.set(approvalId, approval)
        await input.onApprovalRequest(approval)
      },
      emitToken: async (turnId, token) => {
        const input = activeTurns.get(turnId)
        if (!input) return
        await input.onToken(token, runtime.streamCalls.length)
      },
      activeTurnIds: () => Array.from(activeTurns.keys()),
    }
    runtimes.push(runtime)
    return runtime
  }

  return { factory, runtimes }
}
