export interface SalienceTurn {
  readonly turnId: string
  readonly threadId: string
  readonly inputText: string
  readonly outputText: string
}

export interface SalienceVerdict {
  readonly noteworthy: boolean
  readonly reason: string
}

export interface SalienceClassifier {
  classify(turn: SalienceTurn): Promise<SalienceVerdict>
}
