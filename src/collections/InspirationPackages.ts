import type { CollectionConfig } from 'payload'

// The "Container" in the Container/Ingredient model: a curated event
// theme (e.g. "Sun-Drenched Bachelorette") shown to customers. This is
// marketing/curation content ONLY.
//
// Deliberately NOT stored here: which vendors can actually fill a given
// slot. That comes from the main app database — PartnerProfile ->
// PartnerCategory -> Package (approved, bookable, in the right market) —
// so an unapproved or paused vendor can never be surfaced through a
// theme just because someone typed them into this CMS.
//
// Note the naming: prisma/schema.prisma already has a `Package` model
// (one vendor's single-category bookable offering). This collection is
// called "InspirationPackages" specifically so it's never confused with
// that — they are different concepts.
//
// Duration is modeled as a fixed preset (not a continuous range): a
// "Weekend" version of a theme is a separate package record from the
// "Full-Day" version, rather than one record juggling multiple
// duration-specific category lists internally. Simpler data model, at
// the cost of some duplication across duration variants of the same
// theme — acceptable trade-off for MVP.
export const InspirationPackages: CollectionConfig = {
  slug: 'inspiration-packages',
  admin: {
    useAsTitle: 'title',
    description:
      'Curated event themes (the "container"). Vendors that fill each slot are matched live from the main database, not stored here.',
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: { description: 'URL-friendly id, e.g. "sun-drenched-bachelorette"' },
    },
    {
      name: 'summary',
      type: 'textarea',
      required: true,
      admin: { description: 'Short teaser shown on the package card' },
    },
    { name: 'description', type: 'richText' },
    {
      name: 'duration',
      type: 'select',
      required: true,
      options: [
        { label: 'Half-Day (up to ~4 hours)', value: 'half-day' },
        { label: 'Full-Day (up to ~10 hours)', value: 'full-day' },
        { label: 'Weekend (2–3 days)', value: 'weekend' },
        { label: 'Multi-Day (4+ days)', value: 'multi-day' },
      ],
      admin: {
        description: 'A "Weekend" edition of a theme is a separate package from its "Full-Day" edition, not one record covering both.',
      },
    },
    {
      name: 'moodTags',
      type: 'text',
      hasMany: true,
      required: true,
      admin: { description: 'Keywords for discovery/search, e.g. "boho", "beach", "low-key", "glam"' },
    },
    {
      name: 'heroImage',
      type: 'upload',
      relationTo: 'media-library',
      admin: { description: 'Main image shown on the package card and detail page' },
    },
    {
      name: 'gallery',
      type: 'array',
      admin: { description: 'Additional images for the mood-board view' },
      fields: [
        { name: 'image', type: 'upload', relationTo: 'media-library', required: true },
        { name: 'caption', type: 'text' },
      ],
    },
    {
      name: 'requiredCategorySlugs',
      type: 'text',
      hasMany: true,
      required: true,
      admin: {
        description:
          'Which vendor category slugs this theme needs — must exactly match a VendorCategory.slug in the main database (e.g. "transport", "hair-makeup", "decor", "catering"). Not validated live against that table yet, so a typo here will silently fail to match vendors rather than error — double-check spelling.',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Uncheck to hide this theme everywhere without deleting it' },
    },
  ],
}
