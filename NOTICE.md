# NOTICE

This software is a modified version of **action-board**.

- Upstream: https://github.com/team-mirai-volunteer/action-board
- Upstream commit: 1b269081aaee4a145a125af46d5c90b88d9e5a4e (2026-08-22)
- License: GNU Affero General Public License v3.0 (see `LICENSE`)

## Modifications (2026-10)

Modified in 2026-10 by the operators of this repository:

- Extracted only the poster board map feature into a standalone Next.js app.
- Replaced the authentication with anonymous sign-in plus an invite code; no email addresses are collected.
- Moved authorization into Postgres (row level security and security definer functions); the app holds no service role key.
- Made status updates transactional (row lock, update and history insert in one function).
- Escaped board names and addresses in map tooltips.
- Added a database-controlled public window (automatic hiding outside the period).
- Reduced the statuses to six and changed the wording of `error_wrong_poster`.
- Removed all upstream branding, missions, rankings and other features.

## Files derived from upstream

| File | Upstream |
|---|---|
| `src/features/poster-map/components/poster-map.tsx` | `src/features/map-poster/components/poster-map-with-cluster.tsx` |
| `src/features/poster-map/components/poster-map-app.tsx` | `src/features/map-poster/components/detailed-poster-map-client.tsx`, `poster-map-page-client-optimized.tsx` (page composition) |
| `src/features/poster-map/components/board-filter.tsx` | `src/features/map-poster/components/poster-board-filter.tsx` |
| `src/features/poster-map/components/board-search.tsx` | `src/features/map-poster/components/poster-board-search.tsx` |
| `src/features/poster-map/components/board-info.tsx` | `src/features/map-poster/components/detailed-poster-map-client.tsx` (board info and copy buttons) |
| `src/features/poster-map/components/update-dialog.tsx` | `src/features/map-poster/components/detailed-poster-map-client.tsx` (update dialog) |
| `src/features/poster-map/components/help-dialog.tsx` | `src/features/map-poster/components/detailed-poster-map-client.tsx` (help dialog) |
| `src/features/poster-map/components/summary-bar.tsx` | `src/features/map-poster/components/poster-map-page-client-optimized.tsx` (progress summary) |
| `src/features/poster-map/components/poster-map.css` | `src/features/map-poster/styles/poster-map.css`, `poster-map-filter.css` |
| `src/features/poster-map/marker-icons.ts` | `src/features/map-poster/utils/marker-icons.ts` |
| `src/features/poster-map/status.ts` | `src/features/map-poster/config/status-config.ts` |
| `src/features/poster-map/filter.ts` | `src/features/map-poster/utils/poster-filter-logic.ts` |
| `src/features/poster-map/use-board-filter.ts` | `src/features/map-poster/hooks/use-poster-board-filter.ts` |
| `src/features/poster-map/search.ts` | `src/features/map-poster/utils/poster-search-logic.ts` |
| `src/features/poster-map/actions.ts` | `src/features/map-poster/actions/poster-boards.ts` |
| `src/features/poster-map/volunteer-service.ts` | `src/features/map-poster/services/poster-boards.ts`, `use-cases/update-board-status.ts` |
| `src/proxy.ts`, `src/lib/supabase/proxy.ts` | `src/proxy.ts`, `src/lib/supabase/middleware.ts` |
| `src/lib/supabase/server.ts` | `src/lib/supabase/server.ts` |

All other files were written for this repository and are also licensed under AGPL-3.0.

## Data

`data/sangin-2025/*.csv` are copied without modification from upstream
`poster_data/data/sangin-2025/福岡県/福岡市_normalized*.csv`
(poster board list for Fukuoka City, originally published by the Fukuoka City Election Administration Commission).
Normalization is applied at import time by `scripts/lib/normalize-boards.ts`.
