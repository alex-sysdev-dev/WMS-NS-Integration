import KpiTile from '@/components/kpi/KpiTile'
import DataTable, { type Column } from '@/components/tables/DataTable'
import DataSourceNotice from '@/components/common/DataSourceNotice'
import { calculateWarehouseQcKpis, getInventoryHealth } from '@/lib/queries/qc'
import type { InventoryHealthRow } from '@/types/qc'

export const dynamic = 'force-dynamic'

export default async function WarehouseQcPage() {
  const rows = await getInventoryHealth()
  const kpis = calculateWarehouseQcKpis(rows)

  const columns: Column<InventoryHealthRow>[] = [
    { header: 'Item', accessor: 'itemName' },
    { header: 'Lot', accessor: 'lotNumber' },
    { header: 'Bin', accessor: 'binNumber' },
    { header: 'On Hand', accessor: 'onHandQty' },
    { header: 'Committed', accessor: 'committedQty' },
    { header: 'Available', accessor: 'availableQty' },
    { header: 'Variance', accessor: 'varianceQty' },
    { header: 'Last Counted', accessor: 'lastCountedAt' },
    { header: 'Status', accessor: 'status' },
  ]

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          <span className="text-orange-500">Warehouse</span>{' '}
          <span className="text-[var(--foreground)]">QC</span>
        </h1>
        <p className="max-w-3xl text-zinc-400">
          Inventory health at the bin and lot level: what is on hand, what is committed to a project,
          where the record disagrees with the shelf, and how much of the warehouse has actually been
          counted.
        </p>
      </header>

      <DataSourceNotice
        source="NetSuite inventory balances at item + lot + bin, Headquarters location"
        detail="Read-only to start. How variances post back is still open, because NetSuite has no inventory adjustment history to append to."
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <KpiTile title="Bins In Use" value={`${kpis.binsInUse} / ${kpis.binsDefined}`} />
        <KpiTile title="Item / Lot / Bin Records" value={kpis.itemLotBinRecords} />
        <KpiTile title="Count Coverage" value={kpis.countCoverage} suffix="%" />
        <KpiTile title="Never Counted" value={kpis.neverCounted} />
        <KpiTile title="Open Variances" value={kpis.openVariances} />
        <KpiTile title="Counts Posted To Date" value={0} />
      </div>

      <section className="rounded-2xl border border-zinc-700/70 bg-[#151517] p-6">
        <h2 className="mb-1 text-xl font-semibold text-zinc-100">Inventory Health by Bin</h2>
        <p className="mb-4 text-sm text-zinc-400">
          Balances are tracked at item + lot + bin, so the same bin can hold two lots of the same
          item. Each lot gets its own row — collapsing them would hide real stock.
        </p>
        <div className="overflow-x-auto">
          <DataTable<InventoryHealthRow>
            columns={columns}
            data={rows}
            emptyMessage="No balances loaded. This table fills in once NetSuite inventory balances are connected."
          />
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-700/70 bg-[#151517] p-6">
        <h2 className="mb-2 text-xl font-semibold text-zinc-100">Cycle Counting</h2>
        <p className="max-w-3xl text-sm leading-relaxed text-zinc-400">
          No cycle count has ever been reconciled in NetSuite — there are zero inventory adjustments
          in the account, which is why &ldquo;counts posted to date&rdquo; reads zero above rather
          than being unavailable. The practical consequence is that the current inventory error rate
          is unknown, so there is no way to tell whether accuracy is improving or degrading. Counting
          is net-new work, and the item/lot/bin balances above are the correct starting point for a
          first count sheet.
        </p>
      </section>
    </div>
  )
}
