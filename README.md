# Roblox Player Datamining

Long-term public archive of independently observed Windows Player builds, OTA packages, native metadata, LIVE settings and public web assets. The extractor never launches Roblox.

## Latest

See [LATEST.md](LATEST.md)

## Current state

Browse [current/](current/)

## Historical datamining

Browse by year:

- [2026](2026/)

Later years (`2027/`, `2028/`, ...) will appear directly at the repository root the same way, alongside `2026/`, as they happen — never nested under an `archive/` wrapper.

### What each top-level thing is

- **`2026/`** (and later years) — historical observed events by month/day/time: `YYYY/MM/DD/HH-MM-SSZ_<event>/`. `2026/09/07/BASELINE/` is the initial repository baseline, not a Roblox update.
- **`current/`** — complete current extracted state. Modified in place on every real upstream change.
- **`LATEST.md`** — the most recent event, or the baseline before any post-publication event exists.
- **`dataminer/`** — implementation of the automated datamining engine (`src/`, `tests/`, `tools/`).
- **Git history** — exact previous contents and line-level source diffs. `2026/.../<event>/` never stores a full copy of a canonical tree; Git already preserves that.

## Player source warning

Current official Player InExperience and UniversalApp OTA scripts are distributed as **compiled Luau bytecode**. This repository records instance hierarchy, localization, compiled-script counts and bytecode hashes, but does not present reconstructed third-party `.luau` as official current Roblox source. Readable third-party reconstructed history is never treated as official current Player source. `HistoricalSources/` remains local, ignored reference material — it is never committed and never appears under `current/` or a year archive.

## Surfaces

- [Build](current/Build/) — version, packages and file manifest.
- [InExperience](current/InExperience/) and [UniversalApp](current/UniversalApp/) — independently discovered official OTA state.
- [LuaPackages](current/LuaPackages/) — readable package text where public artifacts expose it, plus explicit compiled-script metadata.
- [Native](current/Native/) — static analysis of `RobloxPlayerBeta.exe`, retained as text; the executable stays in the ignored cache.
- [FastVariables](current/FastVariables/) — C++ literal identifiers and Lua observations kept separate from LIVE values.
- [LiveSettings](current/LiveSettings/) — current `PCDesktopClient` values, checked independently of the build GUID.
- [Web](current/Web/) — public JavaScript discovered from configured Player pages.
- [Provenance](current/Provenance/) — surface identities, source URLs and SHA-256 hashes.

## Run locally

Node.js 24 or newer is required. The implementation lives in [`dataminer/`](dataminer/); commands are documented from the repository root:

```powershell
npm ci --prefix dataminer
npm --prefix dataminer run typecheck
npm --prefix dataminer test
npm --prefix dataminer run check
```

(Equivalently, `cd dataminer` and drop `--prefix dataminer`/`npm --prefix dataminer`.) The generated data always lands at the repository root — `current/`, `2026/`, `LATEST.md`, `events.jsonl` — never inside `dataminer/`.

Run `npm --prefix dataminer run check` again to verify a no-op. No observable change means no new year/month/day directory, no `LATEST.md` rewrite, and no commit. A run containing a new build and its related surfaces creates one build event. Independent changes later that day create additional events — a GitHub Actions workflow ([.github/workflows/datamine.yml](.github/workflows/datamine.yml)) runs this every 15 minutes and commits/pushes only when something real changed.

The summary convention is fixed everywhere — `LATEST.md`, event `summary.md`/`diff.md`/`findings.md`, CLI output, commit bodies: `+` added, `~` changed, `-` removed. Machine-readable JSON uses `added`, `changed` and `removed` fields.

The presence of an identifier, flag, source module, API, string, endpoint, configuration value or other artifact does not confirm that a feature is enabled, publicly available, or planned for release.

## Security and contributions

Read [SECURITY.md](SECURITY.md) before reporting sensitive material. Contributions should preserve provenance, deterministic output and the distinction between observed artifacts and confirmed features.
