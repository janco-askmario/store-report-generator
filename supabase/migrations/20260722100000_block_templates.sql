-- Store Report Generator — saved block templates
--
-- Most audits repeat the same handful of findings. The house set of templates
-- lives in code (lib/block-templates.ts) so the copy is versioned and reviewable
-- and cannot be deleted by accident; this table is only for the ones the team
-- saves themselves out of a report they are writing.

create table if not exists public.block_templates (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  -- Which section the template belongs to. A Good template must not show up in
  -- the Bad picker, so this is constrained rather than free text.
  kind       text not null check (kind in ('good', 'bad')),
  title      text not null default '',
  -- The full block body. Kept as one string, matching `Block.paragraph`: a
  -- template saved from a real block has no reliable way to be split back into
  -- its parts, so the built-ins compose their two halves at definition time
  -- instead and everything downstream sees one field.
  paragraph  text not null default '',
  icon       text not null default 'diamond'
);

-- The picker reads one section's templates, newest first.
create index if not exists block_templates_kind_idx
  on public.block_templates (kind, created_at desc);

alter table public.block_templates enable row level security;

-- Same shared-workspace model as public.reports: templates are a team asset, so
-- anyone signed in can use, add and remove them. `created_by` is attribution
-- only and does not gate access.
drop policy if exists "Authenticated users can read block templates" on public.block_templates;
create policy "Authenticated users can read block templates"
  on public.block_templates for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can create block templates" on public.block_templates;
create policy "Authenticated users can create block templates"
  on public.block_templates for insert
  to authenticated
  with check ((select auth.uid()) = created_by);

drop policy if exists "Authenticated users can delete block templates" on public.block_templates;
create policy "Authenticated users can delete block templates"
  on public.block_templates for delete
  to authenticated
  using (true);
