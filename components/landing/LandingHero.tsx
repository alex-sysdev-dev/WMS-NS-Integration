import Image from 'next/image'
import LoginForm from '@/components/auth/LoginForm'
import ConnectionField from '@/components/landing/ConnectionField'

/**
 * Entry screen for the WMS.
 *
 * Follows LED Connection's own brand language: heavy all-caps display type split
 * two-tone between brand orange and the foreground, the constellation field, and
 * a solid orange action. Sits on a near-black ground rather than the website's
 * white, because it opens directly into a dark application and a white flash
 * between the two reads as a seam.
 *
 * The `-orwh` logo is deliberate — the standard mark draws "LED" in black, which
 * disappears on a dark ground. That asset draws it in white.
 *
 * Authentication reuses `LoginForm` rather than reimplementing it, so there is
 * exactly one sign-in code path in the app.
 */
export default function LandingHero() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0B0B0C] text-zinc-100">
      {/* Warm floor glow, keyed to the brand orange. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_108%,rgba(240,126,30,0.16),transparent_62%)]"
      />
      <ConnectionField className="pointer-events-none absolute inset-0 h-full w-full text-orange-400/70" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-14 px-6 py-14 lg:flex-row lg:items-center lg:gap-20 lg:py-20">
        <section className="flex-1">
          <Image
            src="/brand/led-connection-logo-orwh.webp"
            alt="LED Connection"
            width={800}
            height={700}
            priority
            className="h-auto w-[210px] sm:w-[248px]"
          />

          <p className="mt-10 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-orange-500">
            Warehouse Management
          </p>

          <h1 className="mt-4 text-5xl font-extrabold uppercase leading-[0.94] tracking-tight text-balance sm:text-6xl lg:text-7xl">
            <span className="text-orange-500">Receive.</span>{' '}
            <span className="text-orange-500">Fabricate.</span>{' '}
            <span className="block text-zinc-50">Ship.</span>
          </h1>

          <p className="mt-14 border-t border-white/10 pt-6 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-zinc-600">
            LED Connection, LLC &middot; Las Vegas, NV
          </p>
        </section>

        <section className="w-full lg:max-w-[26rem]">
          <LoginForm
            initialMode="login"
            initialNextPath="/dashboard"
            initialMessage={null}
            variant="embedded"
          />
        </section>
      </div>
    </main>
  )
}
