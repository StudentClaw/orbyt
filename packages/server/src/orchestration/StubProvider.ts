export function buildStubResponse(
  input: string,
  skill?: { id: string; name: string } | null,
): string {
  const base = `Student Claw stub provider heard: ${input.trim() || "..."}.`
  const suffix = skill
    ? ` [skill: ${skill.id} / ${skill.name}]`
    : " This turn proved the orchestration transport, ordered push bus, and receipt pipeline."
  return base + suffix
}

export function tokenizeStubResponse(
  input: string,
  skill?: { id: string; name: string } | null,
): string[] {
  return buildStubResponse(input, skill).split(/(\s+)/).filter(Boolean)
}
