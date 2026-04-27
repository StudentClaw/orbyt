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

  test("fails open to noteworthy=true on unparseable output", async () => {
    const classifier = new LlmSalienceClassifier(
      distillerReturning("this is not json"),
    )
    const v = await classifier.classify({
      turnId: "t4",
      threadId: "th1",
      inputText: "",
      outputText: "",
    })
    // Was silently false before — that's exactly what dropped real turns from
    // the memory pipeline. Distillation pass is the authoritative filter.
    expect(v.noteworthy).toBe(true)
    expect(v.reason).toBe("classifier output unparseable")
  })

  test("fails open when JSON is valid but missing the noteworthy field", async () => {
    const classifier = new LlmSalienceClassifier(
      distillerReturning('{"something": "else"}'),
    )
    const v = await classifier.classify({
      turnId: "t5",
      threadId: "th1",
      inputText: "",
      outputText: "",
    })
    expect(v.noteworthy).toBe(true)
  })

  test("unwraps verdict from <artifact> tags", async () => {
    const classifier = new LlmSalienceClassifier(
      distillerReturning(
        '<artifact id="x" kind="text" title="Verdict">{"noteworthy": true, "reason": "deadline"}</artifact>',
      ),
    )
    const v = await classifier.classify({
      turnId: "t6",
      threadId: "th1",
      inputText: "",
      outputText: "",
    })
    expect(v.noteworthy).toBe(true)
    expect(v.reason).toBe("deadline")
  })

  test("prefers the last valid JSON when multiple candidates appear", async () => {
    // Mirrors the leak we saw where a daily distillation got a stray verdict
    // appended. The trailing JSON is the actual classifier answer.
    const classifier = new LlmSalienceClassifier(
      distillerReturning(
        '{"unrelated": 1} prose {"noteworthy": false, "reason": "small talk"}',
      ),
    )
    const v = await classifier.classify({
      turnId: "t7",
      threadId: "th1",
      inputText: "",
      outputText: "",
    })
    expect(v.noteworthy).toBe(false)
    expect(v.reason).toBe("small talk")
  })

  test("ignores braces inside string values", async () => {
    const classifier = new LlmSalienceClassifier(
      distillerReturning(
        '{"noteworthy": true, "reason": "mentioned a {weird} token"}',
      ),
    )
    const v = await classifier.classify({
      turnId: "t8",
      threadId: "th1",
      inputText: "",
      outputText: "",
    })
    expect(v.noteworthy).toBe(true)
    expect(v.reason).toContain("weird")
  })
})
