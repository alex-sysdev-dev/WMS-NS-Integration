/**
 * Says where fabrication time is being written, and that it is not the final home.
 *
 * This is deliberately not the DataSourceNotice used elsewhere. That one means
 * "this page has no data at all", and saying that here would be false: these
 * runs are real time logged by real operators. What is provisional is the
 * storage, not the data, and conflating the two would either make the floor
 * distrust a working timer or let leadership assume the log is already in
 * NetSuite. Both are worse than stating the actual situation.
 */
export default function InterimStoreNotice() {
  return (
    <div
      role="status"
      className="rounded-2xl border border-sky-500/40 bg-sky-500/[0.07] px-5 py-4"
    >
      <div className="flex items-baseline gap-2.5">
        <span
          aria-hidden="true"
          className="mt-1.5 h-2 w-2 flex-none rounded-full bg-sky-400"
        />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-sky-100">
            Live time, interim storage
          </p>
          <p className="text-sm leading-relaxed text-sky-100/70">
            Runs are real and are saved on the server the moment a button is tapped, shared across
            every device. They are held in a JSON file, not in NetSuite, because fabrication does
            not exist in NetSuite yet. When that record is built, the store swaps underneath and
            nothing on this screen changes. Two things follow from that in the meantime: the log
            lives on one server, so back it up with the rest of the app data, and this page is not
            an accounting record.
          </p>
        </div>
      </div>
    </div>
  )
}
