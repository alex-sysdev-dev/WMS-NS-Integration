type Props = {
  title: string
  value: number | string
  suffix?: string
}

/**
 * A KPI tile.
 *
 * Deliberately monochrome: a deep neutral surface, a hairline border, and a soft
 * drop shadow that deepens on hover so the card reads as lifted. The previous
 * version stacked a white-to-orange gradient over two coloured blur blooms,
 * which tinted every tile and made a wall of them noisy.
 *
 * Values are white rather than accent-tinted. On a board of twelve tiles,
 * colouring every number means none of them stand out — colour is worth saving
 * for genuine exceptions, and belongs on a badge rather than the figure.
 */
export default function KpiTile({ title, value, suffix }: Props) {
  const displayValue =
    typeof value === 'number'
      ? value.toLocaleString('en-US', {
          minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
          maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
        })
      : value

  return (
    <div
      className="
        group rounded-2xl
        border border-white/[0.07]
        bg-[#141416]
        p-6
        shadow-[0_16px_36px_-18px_rgba(0,0,0,0.9)]
        transition-[transform,box-shadow,border-color] duration-300 ease-out
        hover:-translate-y-1
        hover:border-white/[0.14]
        hover:shadow-[0_28px_58px_-22px_rgba(0,0,0,0.95)]
        motion-reduce:transition-none motion-reduce:hover:translate-y-0
      "
    >
      <div className="text-sm text-zinc-400 transition-colors duration-300 group-hover:text-zinc-300">
        {title}
      </div>

      <div className="tabular mt-2 text-3xl font-bold tracking-tight text-zinc-50">
        {displayValue}
        {suffix}
      </div>
    </div>
  )
}
