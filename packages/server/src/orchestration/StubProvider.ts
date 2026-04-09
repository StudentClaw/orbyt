export function buildStubResponse(input: string): string {
  return `Student Claw stub provider heard: ${input.trim() || "..."}. This turn proved the orchestration transport, ordered push bus, and receipt pipeline.`
}

export function tokenizeStubResponse(input: string): string[] {
  return buildStubResponse(input).split(/(\s+)/).filter(Boolean)
}
