import { getInboundItems, getInboundShipments } from '@/lib/queries/inbound'
import { buildInboundStatusTrend, buildSupplierVolume } from '@/lib/calculations/inbound'
import { calculateInboundKpis } from '@/lib/calculations/kpi'
import { getCrossFunctionalKpis, getPutawayTasksCount } from '@/lib/queries/operations'
import KpiTile from '@/components/kpi/KpiTile'
import DataTable, { type Column } from '@/components/tables/DataTable'
import LineCharts from '@/components/charts/LineCharts'
import BarChart from '@/components/charts/BarChart'
import type { Shipment } from '@/types/inbound'

export const dynamic = 'force-dynamic'

export default async function InboundPage() {
  const [shipments, inboundItems, crossKpis, putawayTasks] = await Promise.all([
    getInboundShipments(),
    getInboundItems(),
    getCrossFunctionalKpis(),
    getPutawayTasksCount(),
  ])
  const kpis = calculateInboundKpis(shipments)
  const statusTrend = buildInboundStatusTrend(shipments)
  const supplierVolume = buildSupplierVolume(inboundItems)

  const columns: Column<Shipment>[] = [
    { header: 'Supplier', accessor: 'supplier' },
    { header: 'ETA', accessor: 'eta' },
    { header: 'Status', accessor: 'status' },
  ]

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-2xl font-semibold">
        <span className="text-orange-500">Inbound</span>{' '}
        <span className="text-[var(--foreground)]">Dashboard</span>
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
        <KpiTile title="Scheduled" value={kpis.scheduled} />
        <KpiTile title="Arrived" value={kpis.arrived} />
        <KpiTile title="Received" value={kpis.received} />
        <KpiTile title="Accuracy" value={99.2} suffix="%" />
        <KpiTile title="Inventory Risk SKUs" value={crossKpis.inventoryRiskSkus} />
        <KpiTile title="Inbound QA Pending" value={crossKpis.inboundQaPending} />
        <KpiTile title="Inbound QA Blocked" value={crossKpis.inboundQaBlocked} />
        <KpiTile title="Putaway Tasks" value={putawayTasks} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <LineCharts
          title="Inbound Status Trend"
          description="Scheduled, arrived, and received shipment counts by ETA date."
          labels={statusTrend.labels}
          series={[
            { name: 'Scheduled', color: '#F07E1E', values: statusTrend.scheduled },
            { name: 'Arrived', color: '#6EE7B7', values: statusTrend.arrived },
            { name: 'Received', color: '#A78BFA', values: statusTrend.received },
          ]}
        />

        <BarChart
          title="Supplier Volume (Expected vs Received)"
          description="Top suppliers by expected units from inbound items."
          labels={supplierVolume.labels}
          series={[
            { name: 'Expected', color: '#F07E1E', values: supplierVolume.expected },
            { name: 'Received', color: '#A78BFA', values: supplierVolume.received },
          ]}
        />
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Shipments</h2>
        <DataTable<Shipment> columns={columns} data={shipments} />
      </div>
    </div>
  )
}
