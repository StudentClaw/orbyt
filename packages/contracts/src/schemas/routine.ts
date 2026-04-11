import { Schema } from "@effect/schema"

export const RoutineCell = Schema.Struct({
  dayOfWeek: Schema.Number.pipe(Schema.between(0, 6)),
  hourOfDay: Schema.Number.pipe(Schema.between(0, 23)),
})
export type RoutineCell = Schema.Schema.Type<typeof RoutineCell>

export const SetRoutinesParams = Schema.Struct({
  cells: Schema.Array(RoutineCell),
})
export type SetRoutinesParams = Schema.Schema.Type<typeof SetRoutinesParams>
