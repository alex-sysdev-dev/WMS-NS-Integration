type Props = {
  /** What this page will read once connected, e.g. "NetSuite inventory balances". */
  source: string
  /** What still has to happen. Keep it concrete. */
  detail: string
}

/**
 * Marks a page whose data source is not wired up yet.
 *
 * The point is that an empty page and a broken page look identical, and a page
 * with invented sample data looks like neither. This makes the state explicit so
 * nobody demos a placeholder as though it were live operations.
 */
export default function DataSourceNotice({ source, detail }: Props) {
  return (
    <div
      role="status"
      className="rounded-2xl border border-amber-500/40 bg-amber-500/[0.07] px-5 py-4"
    >
      <div className="flex items-baseline gap-2.5">
        <span
          aria-hidden="true"
          className="mt-1.5 h-2 w-2 flex-none rounded-full bg-amber-400"
        />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-amber-100">
            Not connected yet — no live data on this page
          </p>
          <p className="text-sm leading-relaxed text-amber-100/70">
            Will read from {source}. {detail}
          </p>
        </div>
      </div>
    </div>
  )
}
