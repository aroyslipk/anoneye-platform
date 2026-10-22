-- Demo fixtures never need database support beyond ordinary rows: a demo
-- observation is an ordinary snapshot whose `source` begins with
-- "Anoneye demo seed". This migration only documents that intent and adds a
-- guard so production deployments cannot silently keep demo rows around.
--
-- Run manually in a real deployment before going live:
--   delete from public.metric_snapshots where source ilike 'Anoneye demo seed%';

comment on column public.metric_snapshots.source is
  'Data source label. Rows beginning with "Anoneye demo seed" are synthetic fixtures and must be removed before production use.';
