import Link from "next/link"
import Image from "next/image"

export default function Topbar() {
  return (
    <header className="h-16 bg-[#101012] border-b border-zinc-800 flex items-center justify-between px-6">
      {/* Mobile Logo (Hidden on desktop since sidebar has it) */}
      <div className="md:hidden">
        <Link href="/">
          <Image
            src="/brand/led-connection-logo-orwh.webp"
            alt="LED Connection"
            width={800}
            height={700}
            className="h-auto w-[92px]"
          />
        </Link>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-3 text-sm text-zinc-400">
        <span>Operations Platform</span>
      </div>
    </header>
  )
}
