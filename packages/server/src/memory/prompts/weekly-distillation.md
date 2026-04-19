# Weekly Distillation Prompt

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

If nothing qualifies, write `_none_` under this section.
