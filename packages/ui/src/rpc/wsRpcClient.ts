import { Schema } from "@effect/schema"
import {
  OrchestrationDomainEvent,
  OrchestrationSnapshot,
  ProviderRuntimeEvent,
  PUSH_CHANNELS,
  RPC_METHODS,
  ServerConfig,
  ServerConfigStreamEvent,
  ServerLifecycleEvent,
  type CreateThreadResult,
  type DesktopBootstrap,
  type InterruptTurnResult,
  type RetryProviderInitializeResult,
  type SendTurnResult,
  type StartProviderAuthResult,
} from "@student-claw/contracts"
import { WsTransport } from "./wsTransport"

type StreamSubscriptionOptions = {
  readonly onResubscribe?: () => void
}

function decode(schema: Schema.Schema<any, any, never>, value: unknown): any {
  return Schema.decodeUnknownSync(schema)(value)
}

export interface WsRpcClient {
  readonly transport: WsTransport
  readonly server: {
    readonly getBootstrap: () => Promise<DesktopBootstrap>
    readonly getConfig: () => Promise<ServerConfig>
    readonly subscribeLifecycle: (
      listener: (event: ServerLifecycleEvent) => void,
      options?: StreamSubscriptionOptions,
    ) => () => void
    readonly subscribeConfig: (
      listener: (event: ServerConfigStreamEvent) => void,
      options?: StreamSubscriptionOptions,
    ) => () => void
  }
  readonly orchestration: {
    readonly getSnapshot: () => Promise<OrchestrationSnapshot>
    readonly createThread: (title?: string) => Promise<CreateThreadResult>
    readonly sendTurn: (threadId: string, content: string) => Promise<SendTurnResult>
    readonly interruptTurn: (threadId: string) => Promise<InterruptTurnResult>
    readonly onDomainEvent: (
      listener: (event: OrchestrationDomainEvent, sequence: number) => void,
      options?: StreamSubscriptionOptions,
    ) => () => void
  }
  readonly provider: {
    readonly startAuth: () => Promise<StartProviderAuthResult>
    readonly retryInitialize: () => Promise<RetryProviderInitializeResult>
    readonly onRuntimeEvent: (
      listener: (event: ProviderRuntimeEvent, sequence: number) => void,
      options?: StreamSubscriptionOptions,
    ) => () => void
  }
  readonly reconnect: () => Promise<void>
  readonly dispose: () => Promise<void>
}

export function createWsRpcClient(transport = new WsTransport()): WsRpcClient {
  return {
    transport,
    server: {
      getBootstrap: () => transport.request(RPC_METHODS.SERVER_GET_BOOTSTRAP, {}),
      getConfig: async () => decode(ServerConfig, await transport.request(RPC_METHODS.SERVER_GET_CONFIG, {})),
      subscribeLifecycle: (listener, options) =>
        transport.subscribe(
          PUSH_CHANNELS.SERVER_LIFECYCLE,
          RPC_METHODS.SERVER_SUBSCRIBE_LIFECYCLE,
          (push) => {
            listener(decode(ServerLifecycleEvent, push.data))
          },
          options,
        ),
      subscribeConfig: (listener, options) =>
        transport.subscribe(
          PUSH_CHANNELS.SERVER_CONFIG,
          RPC_METHODS.SERVER_SUBSCRIBE_CONFIG,
          (push) => {
            listener(decode(ServerConfigStreamEvent, push.data))
          },
          options,
        ),
    },
    orchestration: {
      getSnapshot: async () =>
        decode(OrchestrationSnapshot, await transport.request(RPC_METHODS.ORCHESTRATION_GET_SNAPSHOT, {})),
      createThread: async (title) =>
        transport.request<CreateThreadResult>(RPC_METHODS.ORCHESTRATION_CREATE_THREAD, title ? { title } : {}),
      sendTurn: async (threadId, content) =>
        transport.request<SendTurnResult>(RPC_METHODS.ORCHESTRATION_SEND_TURN, {
          threadId,
          content,
        }),
      interruptTurn: async (threadId) =>
        transport.request<InterruptTurnResult>(RPC_METHODS.ORCHESTRATION_INTERRUPT_TURN, {
          threadId,
        }),
      onDomainEvent: (listener, options) =>
        transport.subscribe(
          PUSH_CHANNELS.ORCHESTRATION_DOMAIN,
          RPC_METHODS.ORCHESTRATION_SUBSCRIBE_DOMAIN,
          (push) => {
            listener(decode(OrchestrationDomainEvent, push.data), push.sequence)
          },
          options,
        ),
    },
    provider: {
      startAuth: async () =>
        transport.request<StartProviderAuthResult>(RPC_METHODS.PROVIDER_START_AUTH, {}),
      retryInitialize: async () =>
        transport.request<RetryProviderInitializeResult>(RPC_METHODS.PROVIDER_RETRY_INITIALIZE, {}),
      onRuntimeEvent: (listener, options) =>
        transport.subscribe(
          PUSH_CHANNELS.PROVIDER_RUNTIME,
          RPC_METHODS.PROVIDER_SUBSCRIBE_RUNTIME,
          (push) => {
            listener(decode(ProviderRuntimeEvent, push.data), push.sequence)
          },
          options,
        ),
    },
    reconnect: () => transport.reconnect(),
    dispose: () => transport.dispose(),
  }
}
