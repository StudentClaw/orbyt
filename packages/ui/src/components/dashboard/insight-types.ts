/** Shared insight types (decoupled from deleted InsightStrip / InsightCard). */

export interface InsightAction {
  readonly label: string
  readonly prompt: string
  readonly skillId?: string
}

export interface InsightData {
  readonly id: string
  readonly title: string
  readonly body: string
}

export type InsightWithAction = InsightData & {
  readonly action?: InsightAction
}
