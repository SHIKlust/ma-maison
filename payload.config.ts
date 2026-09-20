import path from 'path'
import { fileURLToPath } from 'url'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { buildConfig } from 'payload'
import sharp from 'sharp'

import { Admins } from './src/collections/Admins'
import { InspirationPackages } from './src/collections/InspirationPackages'
import { MediaLibrary } from './src/collections/MediaLibrary'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  // Payload checks incoming requests' Origin/Referer against this before
  // allowing create/update/delete — without it, Payload has to guess the
  // origin, and any mismatch (e.g. the admin UI loaded from a different
  // port than the one actually handling the request) fails silently as
  // "You are not allowed to perform this action." Update the port here if
  // your dev server ever runs on something other than 3000.
  serverURL: process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000',
  csrf: [process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'],
  admin: {
    user: Admins.slug,
  },
  // Only content-curation collections live here. Vendors, bookings,
  // events, users, etc. stay in prisma/schema.prisma and are managed
  // through the app's existing API routes — see decisions.md.
  collections: [Admins, MediaLibrary, InspirationPackages],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  // Reuses the SAME Postgres database as Prisma (same DATABASE_URL), but
  // in its OWN schema namespace ("payload", not "public"), and via real
  // migrations rather than dev-mode "push". Push relies on drizzle-kit
  // introspecting the schema on every server start, and that introspection
  // has a live bug (empty params array on its primary-key lookup query) —
  // migrations don't go through that code path at all.
  //
  // Run `npx payload migrate:create` once, then `npx payload migrate`
  // (or just start the dev server after migrating) to create the two
  // tables. Re-run migrate:create after changing a collection's fields.
  db: postgresAdapter({
    schemaName: 'payload',
    push: false,
    pool: {
      connectionString: process.env.DATABASE_URL,
    },
  }),
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})
