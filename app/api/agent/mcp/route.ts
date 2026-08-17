import { NextRequest, NextResponse } from "next/server";

function getBaseUrl(req: NextRequest) {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

const tools = [
  {
    name: "get_pipeline_status",
    description:
      "Get the current LED Connection project pipeline snapshot (job stages, material flow, fabrication/quality counts). Fields are null/\"Pending\" until the NetSuite sync is connected.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_projects_needing_attention",
    description:
      "List projects blocked on missing material, fabrication, or a quality hold. Empty until the NetSuite sync is connected.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
];

async function callTool(baseUrl: string, name: string, args: Record<string, unknown>) {
  const params = new URLSearchParams();
  Object.entries(args).forEach(([k, v]) => {
    if (v != null) params.set(k, String(v));
  });

  const endpoints: Record<string, string> = {
    get_pipeline_status: "/api/agent/pipeline-status",
    get_projects_needing_attention: "/api/agent/projects-attention",
  };

  const path = endpoints[name];
  if (!path) throw new Error(`Unknown tool: ${name}`);

  const url = `${baseUrl}${path}${params.toString() ? "?" + params.toString() : ""}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Tool call failed: ${res.status}`);
  }

  return res.json();
}

export async function GET() {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    start(controller) {
      // Send endpoint event
      controller.enqueue(encoder.encode(
        `event: endpoint\ndata: ${JSON.stringify({ uri: "/api/agent/mcp" })}\n\n`
      ));
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { method, params, id } = body;
  const baseUrl = getBaseUrl(req);

  if (method === "initialize") {
    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "led-connection-wms", version: "1.0.0" },
      },
    });
  }

  if (method === "tools/list") {
    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      result: { tools },
    });
  }

  if (method === "tools/call") {
    const { name, arguments: args } = params;
    try {
      const result = await callTool(baseUrl, name, args || {});
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: JSON.stringify(result) }],
        },
      });
    } catch (err) {
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        error: { code: -32000, message: String(err) },
      });
    }
  }

  return NextResponse.json({
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: "Method not found" },
  });
}
