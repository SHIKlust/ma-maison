import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_media_library_source" AS ENUM('stock', 'ai-generated', 'vendor-submitted');
  CREATE TYPE "payload"."enum_media_library_review_status" AS ENUM('approved', 'pending', 'rejected');
  CREATE TYPE "payload"."enum_inspiration_packages_duration" AS ENUM('half-day', 'full-day', 'weekend', 'multi-day');
  CREATE TABLE "payload"."media_library" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"source" "payload"."enum_media_library_source" DEFAULT 'stock' NOT NULL,
  	"review_status" "payload"."enum_media_library_review_status" DEFAULT 'approved',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_thumbnail_url" varchar,
  	"sizes_thumbnail_width" numeric,
  	"sizes_thumbnail_height" numeric,
  	"sizes_thumbnail_mime_type" varchar,
  	"sizes_thumbnail_filesize" numeric,
  	"sizes_thumbnail_filename" varchar,
  	"sizes_card_url" varchar,
  	"sizes_card_width" numeric,
  	"sizes_card_height" numeric,
  	"sizes_card_mime_type" varchar,
  	"sizes_card_filesize" numeric,
  	"sizes_card_filename" varchar,
  	"sizes_hero_url" varchar,
  	"sizes_hero_width" numeric,
  	"sizes_hero_height" numeric,
  	"sizes_hero_mime_type" varchar,
  	"sizes_hero_filesize" numeric,
  	"sizes_hero_filename" varchar
  );
  
  CREATE TABLE "payload"."media_library_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "payload"."inspiration_packages_gallery" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer NOT NULL,
  	"caption" varchar
  );
  
  ALTER TABLE "payload"."inspiration_packages" ADD COLUMN "duration" "payload"."enum_inspiration_packages_duration" NOT NULL;
  ALTER TABLE "payload"."inspiration_packages" ADD COLUMN "hero_image_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "media_library_id" integer;
  ALTER TABLE "payload"."media_library_texts" ADD CONSTRAINT "media_library_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."media_library"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."inspiration_packages_gallery" ADD CONSTRAINT "inspiration_packages_gallery_image_id_media_library_id_fk" FOREIGN KEY ("image_id") REFERENCES "payload"."media_library"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."inspiration_packages_gallery" ADD CONSTRAINT "inspiration_packages_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."inspiration_packages"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "media_library_updated_at_idx" ON "payload"."media_library" USING btree ("updated_at");
  CREATE INDEX "media_library_created_at_idx" ON "payload"."media_library" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_library_filename_idx" ON "payload"."media_library" USING btree ("filename");
  CREATE INDEX "media_library_sizes_thumbnail_sizes_thumbnail_filename_idx" ON "payload"."media_library" USING btree ("sizes_thumbnail_filename");
  CREATE INDEX "media_library_sizes_card_sizes_card_filename_idx" ON "payload"."media_library" USING btree ("sizes_card_filename");
  CREATE INDEX "media_library_sizes_hero_sizes_hero_filename_idx" ON "payload"."media_library" USING btree ("sizes_hero_filename");
  CREATE INDEX "media_library_texts_order_parent" ON "payload"."media_library_texts" USING btree ("order","parent_id");
  CREATE INDEX "inspiration_packages_gallery_order_idx" ON "payload"."inspiration_packages_gallery" USING btree ("_order");
  CREATE INDEX "inspiration_packages_gallery_parent_id_idx" ON "payload"."inspiration_packages_gallery" USING btree ("_parent_id");
  CREATE INDEX "inspiration_packages_gallery_image_idx" ON "payload"."inspiration_packages_gallery" USING btree ("image_id");
  ALTER TABLE "payload"."inspiration_packages" ADD CONSTRAINT "inspiration_packages_hero_image_id_media_library_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "payload"."media_library"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_library_fk" FOREIGN KEY ("media_library_id") REFERENCES "payload"."media_library"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "inspiration_packages_hero_image_idx" ON "payload"."inspiration_packages" USING btree ("hero_image_id");
  CREATE INDEX "payload_locked_documents_rels_media_library_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("media_library_id");
  ALTER TABLE "payload"."inspiration_packages" DROP COLUMN "hero_image_url";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."media_library" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."media_library_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."inspiration_packages_gallery" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "payload"."media_library" CASCADE;
  DROP TABLE "payload"."media_library_texts" CASCADE;
  DROP TABLE "payload"."inspiration_packages_gallery" CASCADE;
  ALTER TABLE "payload"."inspiration_packages" DROP CONSTRAINT "inspiration_packages_hero_image_id_media_library_id_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_media_library_fk";
  
  DROP INDEX "payload"."inspiration_packages_hero_image_idx";
  DROP INDEX "payload"."payload_locked_documents_rels_media_library_id_idx";
  ALTER TABLE "payload"."inspiration_packages" ADD COLUMN "hero_image_url" varchar;
  ALTER TABLE "payload"."inspiration_packages" DROP COLUMN "duration";
  ALTER TABLE "payload"."inspiration_packages" DROP COLUMN "hero_image_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "media_library_id";
  DROP TYPE "payload"."enum_media_library_source";
  DROP TYPE "payload"."enum_media_library_review_status";
  DROP TYPE "payload"."enum_inspiration_packages_duration";`)
}
