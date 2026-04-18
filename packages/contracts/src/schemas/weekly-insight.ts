import { Schema } from "@effect/schema"

export const WeeklyInsight = Schema.Struct({
  title: Schema.String,
  body: Schema.String,
  weekKey: Schema.String,
})

export type WeeklyInsight = Schema.Schema.Type<typeof WeeklyInsight>
