/**
 * The faint node-and-line field behind the landing hero.
 *
 * LED Connection's own site uses a constellation motif — it is the literal
 * visual metaphor for "connection" — so this echoes it rather than inventing a
 * new background. Coordinates are hand-placed constants, not generated: a
 * random layout would differ between the server render and the browser render
 * and surface as a React hydration mismatch.
 *
 * Purely decorative, so it is hidden from assistive technology.
 */

type Node = { x: number; y: number; r: number }

const NODES: Node[] = [
  { x: 60, y: 120, r: 2.5 },
  { x: 168, y: 62, r: 1.8 },
  { x: 232, y: 196, r: 3.2 },
  { x: 118, y: 268, r: 2 },
  { x: 316, y: 108, r: 2.2 },
  { x: 402, y: 232, r: 2.8 },
  { x: 288, y: 340, r: 1.8 },
  { x: 470, y: 78, r: 2 },
  { x: 556, y: 178, r: 3 },
  { x: 452, y: 366, r: 2.4 },
  { x: 624, y: 296, r: 1.8 },
  { x: 712, y: 128, r: 2.6 },
  { x: 760, y: 254, r: 2 },
  { x: 660, y: 402, r: 2.2 },
  { x: 830, y: 350, r: 1.8 },
  { x: 884, y: 176, r: 2.8 },
  { x: 196, y: 424, r: 2.2 },
  { x: 372, y: 472, r: 1.8 },
  { x: 540, y: 448, r: 2.4 },
  { x: 792, y: 468, r: 2 },
  { x: 940, y: 288, r: 2.2 },
  { x: 90, y: 356, r: 1.6 },
]

// Index pairs into NODES. Kept sparse on purpose — a dense mesh reads as noise
// and fights the headline for attention.
const EDGES: Array<[number, number]> = [
  [0, 1], [1, 4], [4, 7], [7, 8], [8, 11], [11, 15],
  [0, 3], [3, 2], [2, 4], [2, 5], [5, 8], [5, 9],
  [6, 3], [6, 9], [9, 12], [12, 13], [13, 19],
  [10, 9], [10, 12], [14, 13], [14, 20], [15, 20],
  [16, 6], [16, 17], [17, 18], [18, 9], [21, 3], [21, 16],
]

export default function ConnectionField({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1000 520"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <g stroke="currentColor" strokeWidth="1" opacity="0.22">
        {EDGES.map(([from, to]) => {
          const a = NODES[from]
          const b = NODES[to]
          return <line key={`${from}-${to}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
        })}
      </g>
      <g fill="currentColor" opacity="0.42">
        {NODES.map((node, index) => (
          <circle key={index} cx={node.x} cy={node.y} r={node.r} />
        ))}
      </g>
    </svg>
  )
}
