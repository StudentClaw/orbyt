export const DAILY_DISTILLATION_PROMPT = `# Daily Distillation Prompt

You are summarizing a student's recent AI-assisted study sessions for their
personal memory system.

## Active Courses

{{courses}}

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
- candidate: "<the fact>" (source: conversation, confidence: <0.0-1.0>, branch: <branch>)

If the student says a professor posts homework, readings, quizzes, deadlines,
weekly schedules, syllabus work, modules, or "the real assignments/work" at a
Canvas location, include that URL exactly in the candidate fact and use the
matching course branch. The URL may be a bare course URL, front page/wiki URL,
Canvas page URL, module URL, assignment URL, announcement URL, or file URL.
Phrase the candidate as a possible assignment source so Orbyt can verify it
during Canvas sync.

Where \`<branch>\` is one of:
- \`school/courses/<course-slug>\` — course-specific facts (e.g. \`school/courses/cs-301\`)
- \`school/playbooks/<playbook-slug>\` — reusable cross-course strategies
- \`school\` — general academic strategies
- \`personality\` — student preferences or identity facts
- \`routine\` — schedule or habit facts
- \`work\` — work-related facts
- \`relationships\` — relationship facts

Use kebab-case for slugs. If nothing qualifies, write \`_none_\` under this section.
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
- lesson: "<the lesson>" (confidence: <0.0-1.0>, branch: <branch>)

If the lesson is that a course uses a Canvas location for homework, readings,
quizzes, deadlines, weekly schedules, syllabus work, modules, or the real
assignments/work, include the Canvas URL exactly in the lesson and use the
matching course branch. The URL may be a bare course URL, front page/wiki URL,
Canvas page URL, module URL, assignment URL, announcement URL, or file URL.

Where \`<branch>\` is one of:
- \`school/courses/<course-slug>\` — course-specific lessons
- \`school/playbooks/<playbook-slug>\` — reusable cross-course strategies
- \`school\` — general academic lessons
- \`personality\` — student character or preference lessons
- \`routine\` — schedule or habit lessons
- \`work\` — work-related lessons
- \`relationships\` — relationship lessons

If nothing qualifies, write \`_none_\` under this section.
`

export const SALIENCE_CLASSIFIER_PROMPT = `# Turn Salience Classifier

You are a lightweight classifier deciding whether a single student/assistant
chat turn is noteworthy enough to update the student's long-term memory.

## Turn

{{turn}}

## Rules

Noteworthy includes any of:
- Grade, feedback, or rubric mentioned
- Deadline, due date, exam date, or scheduling fact
- Assignment, course, or professor detail
- Study strategy, plan, or commitment
- Recurring struggle, confusion, breakthrough, or insight
- Durable preference about how the student works, learns, or communicates
- Personal context relevant to academic life (work shifts, routines, goals)
- Any factual claim about the student or their courses worth remembering later

Not noteworthy = greetings, throwaway acknowledgements ("ok", "thanks"),
pure factual lookups with no student-specific content, raw tool output echoes.

When unsure, prefer noteworthy=true. The distillation pass is the
authoritative filter; the classifier should err on the side of capturing.

## Output

Respond with ONLY a JSON object on a single line. No prose, no code fences,
no artifact tags.

{"noteworthy": true|false, "reason": "<<=12 words>"}
`

export const END_OF_DAY_RECAP_PROMPT = `# End-of-Day Recap Prompt

You are producing a consolidated end-of-day recap for a student's personal
memory system. This runs once per day after the student is done studying.

## Date

{{date}}

## All Turns Today

{{thread_turns}}

## Task

Produce a concise recap using exactly the four sections below. No preamble,
no closing remarks — only the sections. Keep each section tight: prefer 2–5
bullets. Emphasize grades, feedback, commitments, and progress over trivia.

### Highlights

The 2–4 most important moments of the day.

### Work Completed

Assignments, readings, problem sets, or topics the student worked on today.

### Open Threads

Things that were started but not finished, unanswered questions, or topics
the student said they'd come back to.

### Tomorrow's Focus

Explicit commitments or implied priorities for the next day. Skip if none.
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
