# Daily Distillation Prompt

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

Where `<branch>` is one of:
- `school/courses/<course-slug>` — course-specific facts (e.g. `school/courses/cs-301`)
- `school/playbooks/<playbook-slug>` — reusable cross-course strategies
- `school` — general academic strategies
- `personality` — student preferences or identity facts
- `routine` — schedule or habit facts
- `work` — work-related facts
- `relationships` — relationship facts

Use kebab-case for slugs. If nothing qualifies, write `_none_` under this section.
