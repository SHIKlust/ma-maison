import type { CollectionConfig } from 'payload'

// Internal staff only — this gates who can log in to /admin to manage
// marketing content (Inspiration Packages). It is intentionally NOT
// connected to the app's own `User` model in prisma/schema.prisma:
// vendor and customer identity/auth stays exactly where it already
// lives (User, PartnerProfile, etc.) and is unaffected by Payload.
export const Admins: CollectionConfig = {
  slug: 'admins',
  auth: true,
  admin: {
    useAsTitle: 'email',
    description:
      'Staff who can edit Inspiration Packages in this admin panel. Unrelated to vendor or customer accounts, which live in the main app database.',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
    },
  ],
}
