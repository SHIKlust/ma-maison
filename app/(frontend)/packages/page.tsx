import Image from 'next/image'
import Link from 'next/link'
import config from '@payload-config'
import { getPayload } from 'payload'

const durationLabels: Record<string, string> = {
  'half-day': 'Half-Day',
  'full-day': 'Full-Day',
  weekend: 'Weekend',
  'multi-day': 'Multi-Day',
}

// Bare-bones grid for now — a starting point to build mood/duration
// filtering on top of once there's more than a handful of packages.
export default async function PackagesIndexPage() {
  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'inspiration-packages',
    where: { isActive: { equals: true } },
    depth: 1,
    limit: 50,
    sort: '-createdAt',
  })

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12 sm:px-8">
      <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">Inspiration</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">Curated themes to build your event around.</p>

      {result.docs.length === 0 ? (
        <p className="mt-10 text-zinc-500 dark:text-zinc-400">No packages published yet.</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {result.docs.map((pkg) => {
            const hero = typeof pkg.heroImage === 'object' ? pkg.heroImage : null
            const cardUrl = hero?.sizes?.card?.url || hero?.url

            return (
              <Link
                key={pkg.id}
                href={`/packages/${pkg.slug}`}
                className="group overflow-hidden rounded-xl border border-zinc-200 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-900">
                  {cardUrl && (
                    <Image
                      src={cardUrl}
                      alt={hero?.alt || pkg.title}
                      fill
                      className="object-cover transition-transform group-hover:scale-105"
                    />
                  )}
                </div>
                <div className="p-4">
                  {pkg.duration && (
                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      {durationLabels[pkg.duration] ?? pkg.duration}
                    </span>
                  )}
                  <h2 className="mt-1 font-semibold text-black dark:text-zinc-50">{pkg.title}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">{pkg.summary}</p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}

export const revalidate = 60
