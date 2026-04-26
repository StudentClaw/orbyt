import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { OnboardingAnswers, StudentDna } from "@orbyt/contracts"
import {
  ensureGraphScaffold,
  writeGraphCandidate,
} from "../memory/graph-writer.js"
import type { MemoryPaths } from "../memory/paths.js"

export function writeDnaToMemoryGraph(
  paths: MemoryPaths,
  dna: StudentDna,
  answers: OnboardingAnswers,
  now: Date,
): string[] {
  ensureGraphScaffold(paths)
  const written = new Set<string>()

  const facts = [
    `Archetype: ${dna.trait} (${dna.archetypeId})${dna.isRare ? ` — ${dna.rarity}` : ""}`,
    `Field: ${answers.field}`,
    `Peak hours: ${dna.peak}`,
    `Study mode: ${dna.style}`,
    `Motivation: ${dna.motivation}`,
    `Tagline: ${dna.tagline}`,
    `AI guidance: ${dna.aiPromptHint}`,
    `Orbyt adapts: ${dna.orbytAdapts}`,
    `Recommended features: ${dna.recommendedFeatures.join(", ")}`,
  ]

  for (const fact of facts) {
    const path = writeGraphCandidate(paths, { branch: "personality", text: fact }, now)
    written.add(path)
  }

  const openEnded: Array<[string, string]> = [
    ["Secret love/hate", answers.secretLove],
    ["Wishes they were better at", answers.wishBetter],
    ["Past habit", answers.pastHabit],
    ["Doing this for", answers.forWho],
    ["A successful semester looks like", answers.successLook],
  ]
  for (const [label, value] of openEnded) {
    if (!value || value.trim().length === 0) continue
    const path = writeGraphCandidate(
      paths,
      { branch: "personality", text: `${label}: ${value.trim()}` },
      now,
    )
    written.add(path)
  }

  return Array.from(written)
}

export function writeStudentProfileTemplate(
  paths: MemoryPaths,
  dna: StudentDna,
  answers: OnboardingAnswers,
  now: Date,
): void {
  const isRare = dna.isRare ?? false
  const markdown = `# Student Profile

_Last updated: ${now.toISOString()}_

## Identity
- **Name:** ${answers.name}
- **Field of study:** ${answers.field}

## Learning Archetype
- **Type:** ${dna.trait} (${dna.archetypeId})${isRare ? ` — ${dna.rarity}` : ""}
- **Tagline:** ${dna.tagline}

## Study Profile
- **Peak hours:** ${dna.peak}
- **Study style:** ${dna.style}
- **Primary motivation:** ${dna.motivation}
- **Main challenge:** ${answers.struggle}

## Personal Insights
- **Secret love/hate:** ${answers.secretLove}
- **Wishes they were better at:** ${answers.wishBetter}
- **A past study habit:** ${answers.pastHabit}
- **Doing this for:** ${answers.forWho}
- **Successful semester looks like:** ${answers.successLook}

## AI Guidance
- **How Orby helps:** ${dna.aiPromptHint}
- **Adaptation strategy:** ${dna.orbytAdapts}

## Recommended Features
${dna.recommendedFeatures.map((f) => `- ${f}`).join("\n")}
`
  mkdirSync(paths.graphDir, { recursive: true })
  writeFileSync(join(paths.graphDir, "student-profile.md"), markdown, "utf8")
}
