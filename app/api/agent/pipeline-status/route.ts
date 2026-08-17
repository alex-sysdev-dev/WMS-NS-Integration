import { getWarehouseKpis } from '@/lib/queries/warehouse'

export async function GET() {
  const kpis = await getWarehouseKpis()

  return Response.json({
    source: 'warehouse (NetSuite job stages — sync not connected yet)',
    ...kpis,
  })
}
