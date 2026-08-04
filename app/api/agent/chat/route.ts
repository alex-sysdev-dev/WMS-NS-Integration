import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import {
  getExecutiveKpiSnapshot,
  getExecutiveKpiHistoryDaily,
  getExecutiveKpiHistoryHourly,
  getExecutiveKpiMaxLines,
  getExecutiveCptRiskOrders,
} from '@/lib/queries/executive'

// =============================================================================
// LED Connection WMS Claude Chat Agent
// -----------------------------------------------------------------------------
// Read-only KPI assistant. Mirrors the build note in:
//   docs/agent-builder-guide.txt
//
// The agent uses Claude tool calling to answer questions about KPIs by
// invoking the existing /api/agent/* endpoints' underlying query functions.
// Tool execution happens in-process (no HTTP round-trip), so no base URL
// or auth needs to flow between routes.
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

const TREND_METRICS = [
  'throughput_per_hour',
  'labor_cost_per_unit',
  'on_time_ship_pct',
  'cpt_risk_orders',
  'active_orders',
  'pending_pick_orders',
  'pending_pack_orders',
  'avg_order_age_hours',
  'yard_occupancy_pct',
  'dock_utilization_pct',
  'avg_trailer_dwell_hours',
  'deadlined_orders',
  'active_labor',
  'productivity_per_labor_hour',
  'quality_score_pct',
  'safety_incidents_30d',
] as const

const RISK_BUCKETS = ['all', 'safe', 'watch', 'risk', 'missed', 'shipped_on_time', 'shipped_late'] as const

const TREND_FIELD_MAP: Record<string, string> = {
  throughput_per_hour: 'throughput_per_hour_avg',
  labor_cost_per_unit: 'labor_cost_per_unit_avg',
  on_time_ship_pct: 'on_time_ship_pct_avg',
  cpt_risk_orders: 'cpt_risk_orders_max',
  active_orders: 'active_orders_max',
  pending_pick_orders: 'pending_pick_orders_max',
  pending_pack_orders: 'pending_pack_orders_max',
  avg_order_age_hours: 'avg_order_age_hours_avg',
  yard_occupancy_pct: 'yard_occupancy_pct_avg',
  dock_utilization_pct: 'dock_utilization_pct_avg',
  avg_trailer_dwell_hours: 'avg_trailer_dwell_hours_avg',
  deadlined_orders: 'deadlined_orders_max',
  active_labor: 'active_labor_max',
  productivity_per_labor_hour: 'productivity_per_labor_hour_avg',
  quality_score_pct: 'quality_score_pct_avg',
  safety_incidents_30d: 'safety_incidents_30d_max',
}

const TOOLS = [
  {
    name: 'get_kpi_snapshot',
    description:
      'Get the current executive KPI snapshot: throughput, on-time ship %, CPT risk orders, active orders, pick/pack queues, yard occupancy, dock utilization, deadlined orders, labor, quality, and safety. Use this for any "right now" or "current" KPI question.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_kpi_trend',
    description:
      'Get historical trend data for one KPI metric. Use this for questions about how a metric has moved over the last hours or days.',
    input_schema: {
      type: 'object',
      properties: {
        metric: { type: 'string', enum: [...TREND_METRICS] },
        grain: { type: 'string', enum: ['hourly', 'daily'] },
      },
      required: ['metric'],
    },
  },
  {
    name: 'get_max_lines',
    description:
      'Get hourly max-line series for active orders, CPT risk orders, and safety incidents. Use when the user asks for max lines or all three together.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_cpt_risk',
    description:
      'List CPT risk orders, optionally filtered by bucket (safe, watch, risk, missed, shipped_on_time, shipped_late, or all). Sorted by deadline urgency.',
    input_schema: {
      type: 'object',
      properties: {
        bucket: { type: 'string', enum: [...RISK_BUCKETS] },
        limit: { type: 'integer', minimum: 1, maximum: 50 },
      },
      required: [],
    },
  },
  {
    name: 'get_order_status',
    description:
      'Look up status for a single order by order_number or internal id. Returns null when not found.',
    input_schema: {
      type: 'object',
      properties: {
        order_number: { type: 'string' },
        id: { type: 'string' },
      },
      required: [],
    },
  },
] as const

// -----------------------------------------------------------------------------
// Tool execution
// -----------------------------------------------------------------------------

type ToolArgs = Record<string, unknown>

async function executeTool(name: string, args: ToolArgs): Promise<unknown> {
  switch (name) {
    case 'get_kpi_snapshot': {
      const snapshot = await getExecutiveKpiSnapshot()
      return snapshot ?? { error: 'not_found', message: 'No executive KPI snapshot was found.' }
    }

    case 'get_kpi_trend': {
      const metric = String(args.metric ?? '')
      const grain = String(args.grain ?? 'hourly')
      const field = TREND_FIELD_MAP[metric]
      if (!field) {
        return { error: 'bad_request', message: `Unknown metric: ${metric}`, supported: Object.keys(TREND_FIELD_MAP) }
      }
      const rows =
        grain === 'daily'
          ? await getExecutiveKpiHistoryDaily(30)
          : await getExecutiveKpiHistoryHourly(24)
      return {
        metric,
        grain,
        data: rows.map((row) => ({
          bucket_at: row.bucket_at,
          value: (row as Record<string, unknown>)[field] ?? null,
        })),
      }
    }

    case 'get_max_lines': {
      const data = await getExecutiveKpiMaxLines(48)
      return { grain: 'hourly', data }
    }

    case 'get_cpt_risk': {
      const bucket = (args.bucket as string) ?? 'all'
      const limit = Math.min(50, Math.max(1, Number(args.limit) || 10))
      const rows = await getExecutiveCptRiskOrders(limit)
      const filtered = bucket === 'all' ? rows : rows.filter((o) => o.risk_bucket === bucket)
      return { bucket, limit, count: filtered.length, data: filtered }
    }

    case 'get_order_status': {
      const id = args.id ? String(args.id) : null
      const orderNumber = args.order_number ? String(args.order_number) : null
      if (!id && !orderNumber) {
        return { error: 'bad_request', message: 'Provide id or order_number.' }
      }
      let query = supabase.from('order_cpt_risk').select('*')
      query = id ? query.eq('order_id', id) : query.eq('order_number', orderNumber!)
      const { data, error } = await query.maybeSingle()
      if (error) return { error: 'server_error', message: error.message }
      if (!data) return { found: false, data: null }
      return { found: true, data }
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
    'You are the LED Connection WMS assistant — a read-only KPI helper for a fulfillment center operations platform.',
    `Operating mode: read-only demo. Timezone: America/Chicago.${page}`,
    '',
    'Capabilities:',
    '- Answer questions about current KPI snapshot values (throughput, on-time ship %, CPT risk orders, active/pick/pack queues, yard, dock, labor, quality, safety).',
    '- Answer questions about KPI trends over hours or days.',
    '- Show max-line series for active orders, CPT risk, and safety.',
    '- List CPT risk orders by bucket (safe/watch/risk/missed/shipped_on_time/shipped_late).',
    '- Look up a specific order by order number or id.',
    '',
    'Rules:',
    '- Always call a tool to get real numbers — never invent values.',
    '- Lead the answer with the number and the time basis (e.g., "as of 14:00 CT", "last 24 hours hourly").',
    '- Keep answers concise and plain-text. No markdown tables, no charts, no code blocks unless quoting an order id.',
    '- If the user asks for a write/update/insert/delete or for credentials or raw SQL, refuse with: "I can help with read-only LED Connection WMS KPI, trend, CPT risk, and order lookup questions, but I cannot modify data or expose credentials."',
    '- If the request is ambiguous (missing metric, grain, or order reference), ask one short clarifying question before calling tools.',
    '- If a tool returns an error or empty result, say so plainly and do not fabricate a substitute.',
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
