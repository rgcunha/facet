/**
 * An OpenAI-compatible stand-in for the model provider, so e2e tests make no paid calls. It records
 * every request (tests check them for personal data and the model asked for) and answers a review
 * or an analysis with fixed answers; any other request (tailoring, Apply, Ask, Tighten) gets the CV it
 * was sent, with " (edited)" added to the headline.
 * It reports a cost per model like OpenRouter does.
 * GET /calls lists the recorded requests. POST /reset clears them and sets how the next calls end:
 * `failing` (an API error) or `invalid` (an answer that doesn't fit the schema).
 */
const port = Number(new URL(process.env.LLM_BASE_URL!).port);
// Long enough for a test to close the panel while the call is still running.
const DELAY_MS = 1500;

const SUGGESTIONS = {
  suggestions: [
    {
      area: "summary",
      entryId: null,
      problem: "“I am a engineer” has a grammar error",
      detail: "Write “Backend engineer with 7 years in payments”.",
      rule: "Strong verbs",
      kind: "fix",
    },
    {
      area: "experience",
      entryId: "e1",
      problem: "“Responsible for payments service” says nothing about results",
      detail: "Add what the service handled, such as its volume.",
      rule: "Impact",
      kind: "yours",
    },
  ],
};

const ANALYSIS = {
  title: "Platform Engineer",
  company: "Halden",
  language: "en",
  yearsRequired: 3,
  requirements: [{ name: "Kubernetes", synonyms: [], priority: "must" }],
  strengths: ["Payments platform work"],
  gaps: [{ name: "Helm", why: "Kubernetes deployments usually involve it." }],
  missing: [],
  suggestions: [
    "Lead the headline with Platform Engineer",
    "Open the Orbital Pay bullets with on-call",
  ],
};

let calls: unknown[] = [];
let failing = false;
let invalid = false;
const COST: Record<string, number> = { "mock-fast": 0.002, "mock-good": 0.031 };

type Call = {
  model: string;
  messages: { role: string; content: string }[];
  response_format?: unknown;
};

/**
 * Told apart by the schema asked for: an analysis (gaps) or a review (suggestions). Anything else
 * (tailoring, Apply, Ask, Tighten) edits the CV, so send that CV back, edited.
 * Relies on the prompts ending with "CV (JSON):\n\n" and the CV (tailor.ts, review.ts, revise.ts).
 */
function answer(call: Call) {
  const schema = JSON.stringify(call.response_format);
  if (schema.includes('"gaps"')) return JSON.stringify(ANALYSIS);
  if (schema.includes('"suggestions"')) return JSON.stringify(SUGGESTIONS);
  const cv = JSON.parse(
    call.messages.at(-1)!.content.split("CV (JSON):\n\n")[1],
  );
  return JSON.stringify({ ...cv, headline: `${cv.headline} (edited)` });
}

Bun.serve({
  port,
  async fetch(request) {
    const { pathname } = new URL(request.url);
    if (pathname === "/calls") return Response.json(calls);
    if (pathname === "/reset") {
      calls = [];
      ({ failing = false, invalid = false } = await request.json());
      return new Response(null, { status: 204 });
    }
    const call: Call = await request.json();
    calls.push(call);
    await Bun.sleep(DELAY_MS);
    // 400, not 5xx: the AI SDK retries server errors.
    if (failing)
      return Response.json(
        { error: { message: "Mock provider failure" } },
        { status: 400 },
      );
    return Response.json({
      id: "mock",
      object: "chat.completion",
      created: 0,
      model: "mock",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: invalid ? "not JSON" : answer(call),
          },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: 1,
        completion_tokens: 1,
        total_tokens: 2,
        cost: COST[call.model] ?? 0,
      },
    });
  },
});
