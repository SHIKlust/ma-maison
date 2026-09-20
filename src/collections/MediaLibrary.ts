import type { CollectionConfig } from 'payload'

// Images used across Inspiration Packages (hero images, mood-board
// galleries). For MVP this is populated with stock/AI-generated images
// uploaded directly by staff via the Admins-gated /admin panel.
//
// Vendor-submitted images are supported by the schema (source +
// reviewStatus) so the review workflow can be turned on later without a
// migration, but the vendor-facing submission flow itself isn't built
// yet — only staff can upload here for now.
export const MediaLibrary: CollectionConfig = {
  slug: 'media-library',
  admin: {
    useAsTitle: 'alt',
    description:
      'Images for Inspiration Packages. Stock/AI images go straight to Approved; vendor submissions (once that flow exists) start Pending. Only Approved images should ever be surfaced on the public site.',
  },
  upload: {
    staticDir: 'media-library-uploads',
    mimeTypes: ['image/*'],
    imageSizes: [
      { name: 'thumbnail', width: 400, height: 400, position: 'centre' },
      { name: 'card', width: 800, height: 600, position: 'centre' },
      { name: 'hero', width: 1600, height: 900, position: 'centre' },
    ],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      admin: { description: 'Describes the image — required for accessibility, also shown as the title here' },
    },
    {
      name: 'source',
      type: 'select',
      required: true,
      defaultValue: 'stock',
      options: [
        { label: 'Stock photo', value: 'stock' },
        { label: 'AI-generated / AI-edited', value: 'ai-generated' },
        { label: 'Vendor-submitted', value: 'vendor-submitted' },
      ],
    },
    {
      name: 'reviewStatus',
      type: 'select',
      defaultValue: 'approved',
      options: [
        { label: 'Approved', value: 'approved' },
        { label: 'Pending review', value: 'pending' },
        { label: 'Rejected', value: 'rejected' },
      ],
      admin: {
        description: 'Only meaningful for vendor-submitted images — stock/AI images default to Approved.',
        condition: (data) => data?.source === 'vendor-submitted',
      },
    },
    {
      name: 'moodTags',
      type: 'text',
      hasMany: true,
      admin: { description: 'Style/mood keywords, e.g. "boho", "beach", "romantic"' },
    },
  ],
}
