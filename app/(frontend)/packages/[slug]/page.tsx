import Image from 'next/image'
import { notFound } from 'next/navigation'
import config from '@payload-config'
import { getPayload } from 'payload'

const durationLabels: Record<string, string> = {
  'half-day': 'Half-Day',
  'full-day': 'Full-Day',
  weekend: 'Weekend',
  'multi-day': 'Multi-Day',
}

export default async function PackagePage({ params }: PageProps<'/packages/[slug]'>) {
  const { slug } = await params
  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'inspiration-packages',
    where: {
      and: [{ slug: { equals: slug } }, { isActive: { equals: true } }],
    },
    // depth: 2 populates heroImage and gallery.image as full Media
    // Library documents (with their generated sizes) instead of just ids.
    depth: 2,
    limit: 1,
  })

  const pkg = result.docs[0]
  if (!pkg) return notFound()

  const hero = typeof pkg.heroImage === 'object' ? pkg.heroImage : null
  const heroUrl = hero?.sizes?.hero?.url || hero?.url

  return (
    <div className="flex flex-1 flex-col">
      {heroUrl && (
        <div className="relative h-[50vh] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-900">
          <Image src={heroUrl} alt={hero?.alt || pkg.title} fill priority className="object-cover" />
        </div>
      )}

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12 sm:px-8">
        <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          {pkg.duration && (
            <span className="rounded-full border border-zinc-300 px-3 py-1 dark:border-zinc-700">
              {durationLabels[pkg.duration] ?? pkg.duration}
            </span>
          )}
          {pkg.moodTags?.map((tag) => (
            <span key={tag} className="rounded-full bg-zinc-100 px-3 py-1 dark:bg-zinc-800">
              {tag}
            </span>
          ))}
        </div>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">{pkg.title}</h1>
        <p className="mt-3 text-lg leading-8 text-zinc-600 dark:text-zinc-400">{pkg.summary}</p>

        {pkg.gallery && pkg.gallery.length > 0 && (
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {pkg.gallery.map((item, i) => {
              const img = typeof item.image === 'object' ? item.image : null
              const url = img?.sizes?.card?.url || img?.url
              if (!url) return null
              return (
                <div
                  key={i}
                  className="relative aspect-square overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-900"
                >
                  <Image src={url} alt={item.caption || img?.alt || ''} fill className="object-cover" />
                  {item.caption && (
                    <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-xs text-white">
                      {item.caption}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <section className="mt-12 border-t border-zinc-200 pt-8 dark:border-zinc-800">
          <h2 className="text-xl font-semibold text-black dark:text-zinc-50">What this package needs</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Matching this list to real, available vendors is coming soon — for now, here&apos;s what&apos;s in the
            theme.
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {pkg.requiredCategorySlugs?.map((catSlug) => (
              <li
                key={catSlug}
                className="rounded-full border border-dashed border-zinc-300 px-3 py-1 text-sm capitalize text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
              >
                {catSlug.replace(/-/g, ' ')}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  )
}

export const revalidate = 60
