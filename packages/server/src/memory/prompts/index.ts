export const DAILY_DISTILLATION_PROMPT = `# Daily Distillation Prompt

You are summarizing a student's recent AI-assisted study sessions for their
personal memory system.

## Conversation Turns ({{date}})

The following exchanges happened since the last Memorize run:

{{thread_turns}}

## Task

Produce a structured daily memory entry using exactly the four sections below.
No preamble, title, or closing remarks — only the sections.

### Notable Events

List key things that happened: decisions made, assignments started or submitted,
problems solved, course topics covered. Bullet points. Skip if nothing notable.

### Assignment Observations

List specific course or assignment details mentioned: course name, assignment
name, due date, submission requirement, grading note. Bullet points.
Skip if nothing was mentioned.

### Learning Signals

List moments where the student showed understanding, confusion, or a change in
approach. Keep signals short and concrete. Skip if none observed.

### Promotion Candidates

List any facts stable enough to consider adding to the long-term memory graph.
Only include facts that are durable (preferences, stable course rules, professor
patterns), not one-time events. Format each line exactly as:
- candidate: "<the fact>" (source: conversation, confidence: <0.0-1.0>)

If nothing qualifies, write \`_none_\` under this section.
`

export const WEEKLY_DISTILLATION_PROMPT = `# Weekly Distillation Prompt

You are updating a weekly memory file for a student's personal memory system.
A daily memory entry has just been archived into this week.

## Archived Daily Entry ({{daily_date}})

{{daily_content}}

## Current Weekly File ({{week_key}})

{{weekly_content}}

## Task

Update the weekly file by incorporating the archived daily entry. The weekly
file is pattern-oriented — it captures what things mean and what is recurring,
not just what happened.

Produce exactly the four sections below. Merge new content with existing content.
Do not duplicate existing bullet points. Do not reproduce the daily entry
verbatim. Extract patterns, recurring signals, and lessons.
No preamble, title, or closing remarks — only the sections.

## Recurring Struggles

List things the student found difficult repeatedly across sessions this week.
One bullet per distinct struggle. Skip if none evident.

## Recurring Wins

List things the student handled well repeatedly this week.
One bullet per distinct win. Skip if none evident.

## Emerging Study Strategies

List any approaches, tactics, or habits that seem to be working or developing.
Include Canvas-specific strategies if observed. Skip if none evident.

## Candidate Long-Term Lessons

List insights that should probably move into the permanent memory graph.
Only include stable, reusable lessons — not week-specific events.
Format each line exactly as:
- lesson: "<the lesson>" (confidence: <0.0-1.0>)

If nothing qualifies, write \`_none_\` under this section.
`

export function fillTemplate(
  template: string,
  values: Record<string, string>,
): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, value),
    template,
  )
}
