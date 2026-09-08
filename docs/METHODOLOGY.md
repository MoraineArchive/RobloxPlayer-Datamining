[![Moraine Roblox Datamining](https://github.com/ImElio/Moraine-asset/blob/main/roblox/banner_roblox.png?raw=true)](https://github.com/ImElio/Moraine-asset/blob/main/roblox/banner_roblox.png)

# Datamining Methodology

## Official observations

Canonical data is retrieved from Roblox-operated endpoints and public artifacts. Every surface records provenance, source URLs where safe to retain, hashes, target identity, observation mode, and the time it was observed.

`observedAt` is the collection time, not a claim about when Roblox authored or released the material. The build GUID identifies a client artifact. LIVE settings are checked independently because they can change without a new build GUID.

## Source fidelity

Readable official text is retained with its upstream names, formatting, identifiers, and comments, apart from deterministic byte-order-mark removal and line-ending normalization. Compiled or derived material is labeled by its observation method and is never represented as original readable source.

## Events

A baseline records initial state and is not presented as an update. A later canonical difference creates one chronological event and updates `current/`, `LATEST.md`, and `events.jsonl`. No observed difference produces no event, no rewrite, and no commit.

Human-readable summaries use `+` for additions, `~` for changes, and `-` for removals. Machine-readable reports use `added`, `changed`, and `removed` fields.

## Sensitive material

Potential credentials, tokens, private keys, and similar strings are quarantined by the private extraction infrastructure. Published output contains redacted metadata or hashes instead of the suspected value. Findings are observations for research and do not prove product intent or availability.
