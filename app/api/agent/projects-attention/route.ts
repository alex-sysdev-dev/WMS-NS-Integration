import { getProjectsNeedingAttention } from '@/lib/queries/warehouse'

export async function GET() {
  const data = await getProjectsNeedingAttention()

  return Response.json({
    source: 'warehouse (NetSuite job stages — sync not connected yet)',
    count: data.length,
    data,
  })
}
