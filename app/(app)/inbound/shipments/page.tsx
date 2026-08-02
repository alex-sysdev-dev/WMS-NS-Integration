import LineCharts from '@/components/charts/LineCharts'
import BarChart from '@/components/charts/BarChart'
import KpiTile from '@/components/kpi/KpiTile'
import DataTable, { type Column } from '@/components/tables/DataTable'
import { buildInboundStatusTrend, buildSupplierVolume } from '@/lib/calculations/inbound'
import { getInboundItems, getInboundShipments } from '@/lib/queries/inbound'
import type { Shipment } from '@/types/inbound'

export const dynamic = 'force-dynamic'

export default async function InboundShipmentsPage() {
  const [shipments, items] = await Promise.all([getInboundShipments(), getInboundItems()])
  const trend = buildInboundStatusTrend(shipments, 14)
  const suppliers = buildSupplierVolume(items, 8)
  const scheduledCount = shipments.filter((shipment) => shipment.status === 'scheduled').length
  const arrivedCount = shipments.filter((shipment) => shipment.status === 'arrived').length
  const receivedCount = shipments.filter((shipment) => shipment.status === 'received').length

  const columns: Column<Shipment>[] = [
    { header: 'Supplier', accessor: 'supplier' },
    { header: 'ETA', accessor: 'eta' },
    { header: 'Status', accessor: 'status' },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">
        <span className="text-orange-500">Inbound</span>{' '}
        <span className="text-[var(--foreground)]">Shipments</span>
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <KpiTile title="Scheduled" value={scheduledCount} />
        <KpiTile title="Arrived" value={arrivedCount} />
        <KpiTile title="Received" value={receivedCount} />
        <KpiTile title="Suppliers" value={suppliers.labels.length} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <LineCharts
          title="Two-Week Shipment Trend"
          description="Daily shipment lifecycle movement from scheduled to received."
          labels={trend.labels}
          series={[
            { name: 'Scheduled', color: '#F07E1E', values: trend.scheduled },
            { name: 'Arrived', color: '#6EE7B7', values: trend.arrived },
            { name: 'Received', color: '#A78BFA', values: trend.received },
          ]}
        />

        <BarChart
          title="Supplier Throughput"
          description="Expected vs received quantity by supplier."
          labels={suppliers.labels}
          series={[
            { name: 'Expected', color: '#F07E1E', values: suppliers.expected },
            { name: 'Received', color: '#A78BFA', values: suppliers.received },
          ]}
        />
      </div>

      <section className="rounded-2xl border border-zinc-700/70 bg-[#151517] p-6">
        <h2 className="text-xl font-semibold text-zinc-100 mb-4">Shipment Table</h2>
        <DataTable<Shipment> columns={columns} data={shipments} />
      </section>
    </div>
  )
}
