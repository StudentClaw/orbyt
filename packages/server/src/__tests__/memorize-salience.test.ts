import { describe, test, expect } from "bun:test"
import { LlmSalienceClassifier } from "../memory/salience/llm-classifier.js"
import type { MemorizeDistiller } from "../memory/distiller.js"

function distillerReturning(raw: string): MemorizeDistiller {
  return {
    async distill(): Promise<string> {
      return raw
    },
  }
}

describe("LlmSalienceClassifier", () => {
  test("parses simple JSON verdict", async () => {
    const classifier = new LlmSalienceClassifier(
      distillerReturning('{"noteworthy": true, "reason": "grade mentioned"}'),
    )
    const v = await classifier.classify({
      turnId: "t1",
      threadId: "th1",
      inputText: "Got my essay back",
      outputText: "You got 92%, nicely done.",
    })
    expect(v.noteworthy).toBe(true)
    expect(v.reason).toBe("grade mentioned")
  })

  test("parses JSON wrapped in ```json fences", async () => {
    const classifier = new LlmSalienceClassifier(
      distillerReturning(
        "```json\n{\"noteworthy\": false, \"reason\": \"greeting\"}\n```",
      ),
    )
    const v = await classifier.classify({
      turnId: "t2",
      threadId: "th1",
      inputText: "hi",
      outputText: "hello",
    })
    expect(v.noteworthy).toBe(false)
  })

  test("parses JSON with surrounding prose", async () => {
    const classifier = new LlmSalienceClassifier(
      distillerReturning(
        'Here is my verdict: {"noteworthy": true, "reason": "deadline"} hope that helps',
      ),
    )
    const v = await classifier.classify({
      turnId: "t3",
      threadId: "th1",
      inputText: "",
      outputText: "",
    })
    expect(v.noteworthy).toBe(true)
  })

  test("returns not-noteworthy on invalid JSON", async () => {
    const classifier = new LlmSalienceClassifier(
      distillerReturning("this is not json"),
    )
    const v = await classifier.classify({
      turnId: "t4",
      threadId: "th1",
      inputText: "",
      outputText: "",
    })
    expect(v.noteworthy).toBe(false)
    expect(v.reason).toContain("no json")
  })

  test("returns not-noteworthy when field missing", async () => {
    const classifier = new LlmSalienceClassifier(
      distillerReturning('{"something": "else"}'),
    )
    const v = await classifier.classify({
      turnId: "t5",
      threadId: "th1",
      inputText: "",
      outputText: "",
    })
    expect(v.noteworthy).toBe(false)
  })
})
