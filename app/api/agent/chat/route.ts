import { NextRequest, NextResponse } from 'next/server'
import { getWarehouseKpis, getProjectsNeedingAttention } from '@/lib/queries/warehouse'
import type { WarehouseKpiSnapshot } from '@/types/warehouse'

// =============================================================================
// LED Connection WMS Claude Chat Agent
// -----------------------------------------------------------------------------
// Read-only project-pipeline assistant. See docs/agent-widget.md.
//
// The agent uses Claude tool calling to answer questions about the project
// pipeline by invoking lib/queries/warehouse.ts directly (in-process — no HTTP
// round-trip, no base URL/auth needed between routes). Those queries are
// currently stubs that return honest nulls until the NetSuite sync is built;
// see lib/queries/warehouse.ts for what "connected" will look like.
// =============================================================================

export const runtime = 'nodejs'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const MODEL = process.env.ANTHROPIC_AGENT_MODEL ?? 'claude-haiku-4-5'
const MAX_TOKENS = 1024
const MAX_TOOL_LOOPS = 6

// -----------------------------------------------------------------------------
// Tool schemas (mirrors app/api/agent/mcp/route.ts)
// -----------------------------------------------------------------------------

const TOOLS = [
  {
    name: 'get_pipeline_status',
    description:
      'Get the current project pipeline snapshot: how many projects are in each stage (material received, in fabrication, ready to ship, partially shipped), open purchase orders, projects short material, shipments this week/month, open fab requests, fab QC holds, bins never counted, and open inventory variances. Fields are "Pending" until the NetSuite sync is connected — never invent a number for a pending field. Use this for any "right now" or "current" pipeline/KPI question.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_projects_needing_attention',
    description:
      'List projects blocked on missing material, fabrication, or a quality hold, with the reason and install date. Returns an empty list until the NetSuite sync is connected.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
] as const

/** Renders a nullable count the same way ExecutiveControlCenter does: null means "not measured yet," never a bare zero or a raw null the model could misread. */
function formatKpiField(value: number | string | null): number | string {
  return value === null ? 'Pending — NetSuite sync not connected yet' : value
}

function formatSnapshotForTool(kpis: WarehouseKpiSnapshot) {
  return {
    snapshotAt: kpis.snapshotAt ?? 'No NetSuite sync has run yet',
    projectsMaterialReceived: formatKpiField(kpis.projectsMaterialReceived),
    projectsInFabrication: formatKpiField(kpis.projectsInFabrication),
    projectsReadyToShip: formatKpiField(kpis.projectsReadyToShip),
    projectsPartiallyShipped: formatKpiField(kpis.projectsPartiallyShipped),
    openPurchaseOrders: formatKpiField(kpis.openPurchaseOrders),
    projectsShortMaterial: formatKpiField(kpis.projectsShortMaterial),
    shipmentsThisWeek: formatKpiField(kpis.shipmentsThisWeek),
    shipmentsThisMonth: formatKpiField(kpis.shipmentsThisMonth),
    openFabRequests: formatKpiField(kpis.openFabRequests),
    fabQcHolds: formatKpiField(kpis.fabQcHolds),
    binsNeverCounted: formatKpiField(kpis.binsNeverCounted),
    openInventoryVariances: formatKpiField(kpis.openInventoryVariances),
  }
}

// -----------------------------------------------------------------------------
// Tool execution
// -----------------------------------------------------------------------------

type ToolArgs = Record<string, unknown>

async function executeTool(name: string, _args: ToolArgs): Promise<unknown> {
  switch (name) {
    case 'get_pipeline_status': {
      const kpis = await getWarehouseKpis()
      return formatSnapshotForTool(kpis)
    }

    case 'get_projects_needing_attention': {
      const rows = await getProjectsNeedingAttention()
      return { count: rows.length, data: rows }
    }

    default:
      return { error: 'unknown_tool', name }
  }
}

// -----------------------------------------------------------------------------
// System prompt
// -----------------------------------------------------------------------------

function buildSystemPrompt(pageContext?: { pathname?: string }): string {
  const page = pageContext?.pathname ? ` The user is currently viewing ${pageContext.pathname}.` : ''
  return [
    'You are the LED Connection WMS assistant — a read-only assistant for a project-based lighting/rigging fabrication and install operation, not a parcel fulfillment center. There is no yard, no trailers, no dock, and no parcel cutoff times — do not use that language.',
    `Operating mode: read-only. Timezone: America/Los_Angeles.${page}`,
    '',
    'Capabilities:',
    '- Report the current project pipeline: how many projects are in each NetSuite job stage (material received, in fabrication, ready to ship, partially shipped), open purchase orders, projects short material, shipments this week/month, open fab requests, fab QC holds, bins never counted, and open inventory variances.',
    '- List projects that need attention (blocked on material, fabrication, or a quality hold) with the reason and install date.',
    '',
    'Rules:',
    '- Always call a tool to get real values — never invent a number.',
    '- The NetSuite sync that populates these numbers is not connected yet. Any field the tool returns as "Pending — NetSuite sync not connected yet" must be reported exactly that way — say it is pending and explain the sync isn\'t connected. Never substitute zero, an estimate, or a guess for a pending field.',
    '- Lead the answer with the value (or "Pending") and, when available, the snapshot time basis.',
    '- Keep answers concise and plain-text. No markdown tables, no charts, no code blocks.',
    '- If the user asks for a write/update/insert/delete or for credentials or raw SQL, refuse with: "I can help with read-only LED Connection WMS pipeline and project-status questions, but I cannot modify data or expose credentials."',
    '- If the request is ambiguous, ask one short clarifying question before calling tools.',
    '- If a tool returns an error, say so plainly and do not fabricate a substitute.',
  ].join('\n')
}

// -----------------------------------------------------------------------------
// Claude message types (minimal — we only use what we need)
// -----------------------------------------------------------------------------

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: ToolArgs }
  | { type: 'tool_result'; tool_use_id: string; content: string }

type ChatMessage = { role: 'user' | 'assistant'; content: string | ContentBlock[] }

// -----------------------------------------------------------------------------
// Route handler
// -----------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'config_error', message: 'ANTHROPIC_API_KEY is not set on the server.' },
      { status: 500 }
    )
  }

  let body: { messages?: { role: string; content: string }[]; pageContext?: { pathname?: string } }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad_request', message: 'Invalid JSON body.' }, { status: 400 })
  }

  const userMessages = (body.messages ?? []).filter(
    (m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'
  )
  if (userMessages.length === 0) {
    return NextResponse.json({ error: 'bad_request', message: 'messages array is required.' }, { status: 400 })
  }

  const messages: ChatMessage[] = userMessages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  const trace: { name: string; arguments: ToolArgs; result_preview: string }[] = []

  for (let loop = 0; loop < MAX_TOOL_LOOPS; loop++) {
    const anthropicRes = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: buildSystemPrompt(body.pageContext),
        messages,
        tools: TOOLS,
        tool_choice: { type: 'auto' },
        temperature: 0.2,
      }),
    })

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text()
      return NextResponse.json(
        { error: 'anthropic_error', status: anthropicRes.status, message: errText.slice(0, 500) },
        { status: 502 }
      )
    }

    const completion: { content: ContentBlock[]; stop_reason: string; usage: unknown } =
      await anthropicRes.json()

    const toolUses = completion.content.filter(
      (block): block is Extract<ContentBlock, { type: 'tool_use' }> => block.type === 'tool_use'
    )

    // No tool calls -> we have a final answer.
    if (completion.stop_reason !== 'tool_use' || toolUses.length === 0) {
      const text = completion.content
        .filter((block): block is Extract<ContentBlock, { type: 'text' }> => block.type === 'text')
        .map((block) => block.text)
        .join('\n')

      return NextResponse.json({
        text,
        trace,
        usage: completion.usage,
      })
    }

    // Append assistant turn (with tool_use blocks) to history.
    messages.push({ role: 'assistant', content: completion.content })

    // Execute each tool call and append the results as a single user turn.
    const toolResults: ContentBlock[] = []
    for (const call of toolUses) {
      let result: unknown
      try {
        result = await executeTool(call.name, call.input)
      } catch (err) {
        result = { error: 'tool_exception', message: err instanceof Error ? err.message : String(err) }
      }

      const resultJson = JSON.stringify(result)
      trace.push({
        name: call.name,
        arguments: call.input,
        result_preview: resultJson.length > 280 ? resultJson.slice(0, 280) + '…' : resultJson,
      })

      toolResults.push({ type: 'tool_result', tool_use_id: call.id, content: resultJson })
    }

    messages.push({ role: 'user', content: toolResults })
  }

  return NextResponse.json(
    { error: 'tool_loop_exceeded', message: 'Hit max tool loops without a final answer.', trace },
    { status: 504 }
  )
}
