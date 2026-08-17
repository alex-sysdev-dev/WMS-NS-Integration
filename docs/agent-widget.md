# Claude Pipeline Agent Widget

Floating, read-only AI assistant that renders on every operational page in the
`(app)` route group. It answers project-pipeline questions in plain text by
calling Claude with tool access to `lib/queries/warehouse.ts`.

## What this does

| File | Purpose |
| --- | --- |
| `app/api/agent/chat/route.ts` | POST endpoint. Wraps the Claude Messages API with tool calling. Tool execution happens in-process by importing `lib/queries/warehouse.ts` directly — no extra HTTP round-trip, no base URL config. |
| `app/api/agent/mcp/route.ts` | MCP-protocol proxy exposing the same two tools over HTTP, for use with MCP-aware clients (e.g. Claude Desktop, MCP inspector). Not registered with any external client today. |
| `app/api/agent/pipeline-status/route.ts`, `app/api/agent/projects-attention/route.ts` | Thin REST wrappers the MCP route calls over HTTP (it can't import server functions in-process the way the chat route does). |
| `components/agent/AgentWidget.tsx` | Client component. Floating launcher button + chat panel. Sends `pathname` as page context. |
| `app/(app)/layout.tsx` | One-line mount of `AgentWidget` so it appears on every page inside the `(app)` group. |

No new npm packages. Claude is called via `fetch`, so `package.json` and
`package-lock.json` are untouched.

## Required environment variable

Add to `.env.local` (and to your Vercel project settings):

```
ANTHROPIC_API_KEY=sk-ant-...
```

Optional override (defaults to `claude-haiku-4-5`):

```
ANTHROPIC_AGENT_MODEL=claude-haiku-4-5
```

## Tools the agent can call

| Tool | Backend | Notes |
| --- | --- | --- |
| `get_pipeline_status` | `getWarehouseKpis()` from `lib/queries/warehouse` | Project pipeline stage counts, material flow, fabrication/quality counts. Every field is null (rendered to the model as `"Pending — NetSuite sync not connected yet"`) until the NetSuite sync is built. |
| `get_projects_needing_attention` | `getProjectsNeedingAttention()` from `lib/queries/warehouse` | Projects blocked on material, fabrication, or a quality hold. Returns an empty list today for the same reason. |

`lib/queries/warehouse.ts` is intentionally a stub — see the doc comment there
and in `types/warehouse.ts` for what "connected" will look like (NetSuite job
stages on `job.custentity3`, Item Fulfillments as the real outbound event).
This widget was previously wired to `lib/queries/executive.ts`, a set of
Supabase views left over from the BlueLineOps donor project describing a
parcel/3PL fulfillment center (yard occupancy, dock utilization, trailer
dwell, CPT risk). None of that describes LED Connection's operation, and that
whole surface — `executive.ts`, `types/executive.ts`, and the
`kpi-snapshot`/`kpi-trend`/`cpt-risk`/`order-status`/`max-lines` routes — was
deleted rather than repointed. Order lookup and trend history were dropped
outright (not repointed at fake data) because no real equivalent exists yet
(no Item Fulfillment sync, no history table) — they can come back once one
does.

The system prompt enforces:
- Always call a tool — never invent values.
- Report "Pending" fields exactly as pending, with the reason (NetSuite sync
  not connected), never as zero or a guess.
- Refuse writes, secrets, raw SQL, or off-topic questions.
- Plain text only (no markdown tables/charts).

## Request / response contract

`POST /api/agent/chat`

Request body:
```json
{
  "messages": [
    { "role": "user", "content": "What does my project pipeline look like right now?" }
  ],
  "pageContext": { "pathname": "/dashboard" }
}
```

Response:
```json
{
  "text": "The project pipeline is Pending — the NetSuite sync isn't connected yet, so I don't have real counts for material received, fabrication, or shipping stages.",
  "trace": [
    { "name": "get_pipeline_status", "arguments": {}, "result_preview": "{...}" }
  ],
  "usage": { "input_tokens": 0, "output_tokens": 0 }
}
```

Errors return `{ error, message, ... }` with appropriate status codes
(`400` bad input, `500` missing key, `502` Claude API failure, `504` tool loop exceeded).

## Manual smoke test

1. `ANTHROPIC_API_KEY=sk-ant-... npm run dev`
2. Open http://localhost:3000/dashboard
3. Click the orange chat bubble bottom-right.
4. Try the suggested prompts (pipeline snapshot, projects needing attention, shipments this week, sync status).
5. Verify every answer either reports a real value with its time basis, or says "Pending — NetSuite sync not connected yet" — never an invented number, never yard/dock/trailer language.
6. Try a write attempt: "delete project 4021" — should refuse cleanly.

## Why this design

- **Reuses the existing warehouse query layer**: keeps the agent in lockstep
  with `/dashboard`, which already migrated off the donor fulfillment-center
  model. No drift between what the dashboard shows and what the agent says.
- **No new dependency**: smaller blast radius, no `package.json` change.
- **Single file mounted in layout**: one place to remove the agent if needed.
- **Read-only by construction**: no tool exists that can write to Supabase or
  NetSuite, even if the model tried.
- **Honest about "not connected yet"**: mirrors the `DataSourceNotice` pattern
  used elsewhere in the app — an unwired data source must never look like a
  real zero.

## Known limitations / next steps

- No streaming yet (full response returned after tool loop completes). Easy to
  add SSE later if latency becomes a concern.
- No rate limiting on `/api/agent/chat`. Add per-IP throttling before public
  exposure.
- No conversation persistence — history lives in component state only.
- Page context is just `pathname`. Could be extended to include the visible
  KPI tile values for tighter grounding.
- Once the NetSuite sync lands in `lib/queries/warehouse.ts`, no changes are
  needed here — the tools already read from that module, so real numbers will
  flow through automatically.
