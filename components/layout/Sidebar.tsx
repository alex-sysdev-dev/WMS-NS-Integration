"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"

type AssociateLink = {
  employeeId: string
  fullName: string
}

type Props = {
  associateLinks?: AssociateLink[]
}

type NavLink = {
  name: string
  href: string
  hasDropdown?: boolean
}

type NavSection = {
  label: string | null
  links: NavLink[]
}

/**
 * Navigation mirrors how the warehouse actually works: material is received
 * against a project, fabricated if the job calls for it, inspected, then shipped.
 * There is no yard management section because there is no yard.
 */
const sections: NavSection[] = [
  {
    label: null,
    links: [{ name: "Dashboard", href: "/dashboard" }],
  },
  {
    label: "Receiving",
    links: [
      { name: "Overview", href: "/inbound" },
      { name: "Inbound Shipments", href: "/inbound/shipments" },
    ],
  },
  {
    label: "Fabrication",
    links: [{ name: "Build Queue", href: "/fabrication" }],
  },
  {
    label: "Shipping",
    links: [
      { name: "Overview", href: "/outbound" },
      { name: "Pick / Pack Floor", href: "/outbound/floor" },
    ],
  },
  {
    label: "Quality Control",
    links: [
      { name: "Fabrication QC", href: "/qc/fabrication" },
      { name: "Warehouse QC", href: "/qc/warehouse" },
    ],
  },
  {
    label: "People",
    links: [{ name: "Associates", href: "/associates", hasDropdown: true }],
  },
]

export default function Sidebar({ associateLinks = [] }: Props) {
  const pathname = usePathname()
  const onAssociatesSection = pathname.startsWith("/associates")
  const [associatesOpen, setAssociatesOpen] = useState(onAssociatesSection)
  const [isDark, setIsDark] = useState(() =>
    typeof document === "undefined" ? true : document.documentElement.classList.contains("dark")
  )

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove("dark")
      setIsDark(false)
    } else {
      document.documentElement.classList.add("dark")
      setIsDark(true)
    }
  }

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`)

  const linkClasses = (active: boolean) =>
    `px-4 py-2 rounded-lg cursor-pointer transition ${
      active
        ? "bg-zinc-800 text-white"
        : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
    }`

  return (
    <aside className="w-64 bg-[#101012] border-r border-zinc-800 flex flex-col justify-between">
      <div className="flex flex-col min-h-0">
        <Link href="/dashboard">
          <div className="flex items-center gap-3 p-6 cursor-pointer">
            <span
              aria-hidden="true"
              className="h-7 w-7 flex-none rounded bg-orange-500"
            />
            <span className="leading-tight">
              <span className="block text-sm font-semibold tracking-tight text-zinc-100">
                LED Connection
              </span>
              <span className="block text-[11px] font-medium uppercase tracking-[0.18em] text-orange-500">
                Warehouse
              </span>
            </span>
          </div>
        </Link>

        <nav className="space-y-4 px-4 mt-1 flex-1 overflow-y-auto pb-4">
          {sections.map((section, sectionIndex) => (
            <div key={section.label ?? `section-${sectionIndex}`} className="space-y-1">
              {section.label && (
                <div className="px-4 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
                  {section.label}
                </div>
              )}

              {section.links.map((link) => {
                const active = isActive(link.href)

                if (!link.hasDropdown) {
                  return (
                    <Link key={link.href} href={link.href}>
                      <div className={linkClasses(active)}>{link.name}</div>
                    </Link>
                  )
                }

                return (
                  <div key={link.href}>
                    <div className="flex items-center gap-1">
                      <Link href={link.href} className="flex-1">
                        <div className={linkClasses(active)}>{link.name}</div>
                      </Link>
                      {associateLinks.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setAssociatesOpen((prev) => !prev)}
                          className="px-2 py-2 text-zinc-400 hover:text-zinc-200 transition-colors flex-shrink-0"
                          aria-label="Toggle associate list"
                          aria-expanded={associatesOpen}
                        >
                          <svg
                            className={`w-3.5 h-3.5 transition-transform duration-200 ${associatesOpen ? "rotate-180" : ""}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2.5}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      )}
                    </div>

                    {associatesOpen && associateLinks.length > 0 && (
                      <div className="ml-3 mt-1 max-h-52 overflow-y-auto rounded-lg border border-zinc-800 bg-[#0A0A0B]/60">
                        {associateLinks.map((associate) => {
                          const detailPath = `/associates/${encodeURIComponent(associate.employeeId)}`
                          const isDetailActive = pathname === detailPath
                          return (
                            <Link key={associate.employeeId} href={detailPath}>
                              <div
                                className={`px-3 py-1.5 text-xs cursor-pointer transition border-b border-zinc-800/60 last:border-0 ${
                                  isDetailActive
                                    ? "bg-orange-500/15 text-orange-100"
                                    : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
                                }`}
                              >
                                <div className="font-medium truncate">{associate.fullName}</div>
                                <div className="text-zinc-600 text-[10px]">{associate.employeeId}</div>
                              </div>
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </nav>
      </div>

      <div className="p-4 border-t border-zinc-800 flex justify-center flex-shrink-0">
        <button
          type="button"
          onClick={toggleTheme}
          className="w-14 h-7 rounded-full bg-[#0A0A0B] border border-zinc-700 flex items-center px-1 transition-colors cursor-pointer"
          aria-label="Toggle dark mode"
        >
          <div
            className={`w-5 h-5 rounded-full bg-orange-500 transition-transform duration-300 ${
              isDark ? "translate-x-7" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    </aside>
  )
}
