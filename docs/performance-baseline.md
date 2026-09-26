# Home Hero performance baseline

Measured on 26 September 2026 using an Expo web export with the local demo data path.

| Metric | Before | First optimization pass |
| --- | ---: | ---: |
| Export directory size | 6.0 MB | 2.0 MB |
| JavaScript bundle | 2,073,063 bytes | 1,644,172 bytes |
| Gzipped JavaScript | 569,147 bytes | 435,657 bytes |
| Exported assets | 37 | 19 |
| Bundled modules | 866 | 812 |

## Changes in the first pass

- Import Ionicons through its direct entry point so unused icon-family fonts are excluded.
- Run independent Supabase reads in parallel batches instead of a long serial waterfall.
- Disable demo household storage hydration, persistence, and its one-second deadline timer when the Supabase backend is active.
- Avoid recreating the local review timer interval on every one-second update.

## Verification

- TypeScript check passes.
- Expo web export succeeds.
- All Hero and Party Leader tabs render at 390 px without horizontal overflow.
- Desktop layout renders at 1200 px without horizontal overflow.
- No console errors appeared during the navigation regression sweep.

## Next performance work

1. Deploy this pass to staging and measure authenticated Party Leader and Hero loading with real household data.
2. Load catalog and administration data only when its tab is opened.
3. Add lightweight caching for rarely changing quest, reward, badge, and level definitions.
4. Profile large household lists and introduce virtualization if real data shows a rendering bottleneck.
5. Re-measure after the rebrand assets are integrated and ensure logo/image files do not regress startup size.

