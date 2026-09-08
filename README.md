[![Moraine Roblox Datamining](https://github.com/ImElio/Moraine-asset/blob/main/roblox/banner_roblox.png?raw=true)](https://github.com/ImElio/Moraine-asset/blob/main/roblox/banner_roblox.png)

# Roblox Player Datamining

Automated Roblox datamining archive maintained by Moraine.

This repository contains independently observed Windows Player data. The extraction and publication infrastructure is maintained separately from this data archive.

## Archive layout

- [`2026/`](2026/) contains chronological event records under `YYYY/MM/DD/HH-MM-SSZ_event/`.
- [`current/`](current/) contains the latest canonical state for every observed surface.
- [`LATEST.md`](LATEST.md) points to the most recent observed event.
- [`events.jsonl`](events.jsonl) is the append-only machine-readable event index.
- [`docs/`](docs/) documents provenance, event semantics, and interpretation rules.
- Git history preserves earlier canonical contents and source-level changes.

## Observed surfaces

Player observations include build metadata, official InExperience and UniversalApp OTA artifacts, Lua packages, native static metadata, FastVariables, LIVE settings, web assets, and provenance records.

Readable source is preserved only where an official artifact exposes it. Compiled Luau remains identified as compiled material and is not presented as original readable source.

## Interpretation

The summary convention is `+` added, `~` changed, and `-` removed. The presence of an identifier, flag, endpoint, source module, configuration value, or other artifact does not confirm that a feature is enabled, publicly available, or planned for release.

Read [the methodology](docs/METHODOLOGY.md) for provenance and event details, and [SECURITY.md](SECURITY.md) before reporting sensitive material.
