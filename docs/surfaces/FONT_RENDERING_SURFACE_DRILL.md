# Font and Rendering Surface Drill

Status: v0.1 canonical capture  
Canonical program: Devine Intelligence Wargames  
Surface family: Font, rendering, document, browser, and publishing pipelines  
Primary topics: 7, 9, 10, 18, 20  
Primary agents: Scout, Whisper, Warden, Shade, Sapper-Sim, Scribe, Herald, Veil, EvalAngelica  
Implementation state: prose capture only; schema/example/CI backlog

## Purpose

This document captures the Font and Rendering surface as a first-class Wargames defensive surface.

Fonts and rendering systems cross several security-relevant boundaries: browser, document, UI, storage, cloud rendering, PDF pipelines, font caches, and publishing systems. They are useful defensive sensors because the pipeline has a consistent structure and emits measurable signals without requiring exploit development.

The goal is to observe, profile, constrain, and validate rendering-surface behavior using safe, inert, lab-bounded shapes. This document does not authorize malformed payload generation, exploit development, live impersonation, or offensive use.

## Why this surface matters

Fonts traverse a predictable processing chain:

```text
Container -> Decompressor -> Validator -> Table Parser -> Shaper -> Rasterizer -> Cache -> Consumer
```

At each step, Wargames can capture safe signals:

- metadata;
- table structure;
- offsets and cross-references;
- cmap density;
- GSUB / GPOS fan-out;
- variation axes;
- shaping time;
- raster time;
- cache churn;
- sanitizer verdicts;
- policy bypass attempts;
- document/render pipeline drift.

These signals are valuable for defensive posture, supply-chain validation, rendering hardening, and cross-surface anomaly detection.

## Intake vectors across H1–H7

### H1 — Mobile

- APK assets containing TTF/OTF;
- WebView `@font-face` use;
- embedded PDF fonts in mobile apps;
- mobile document renderers.

### H2 — Network / Browser

- `font/woff2`, `font/otf`, `font/ttf` over HTTPS;
- CSS `@font-face`;
- SVG-in-OpenType references;
- `data:` font URLs;
- CSP `font-src` events.

### H3 — Host

- `fc-cache` events;
- user fonts under local font directories;
- system update font changes;
- printer-driver font paths;
- fontconfig cache churn.

### H4 — Browser Engine

- HarfBuzz / Graphite / CoreText shaping;
- FreeType / Skia / DirectWrite rasterization;
- glyph cache behavior;
- canvas and WebGL-linked rendering behavior;
- service-worker font fetch boundaries.

### H5 — Cloud

- PDF renderers;
- thumbnailers;
- Ghostscript / MuPDF-like render pipelines;
- server-side HTML-to-PDF;
- document preview services.

### H6 — Storage

- embedded fonts in DOCX / PPTX / PDF / EPUB;
- dedup caches;
- quarantine stores;
- document revision stores.

### H7 — Boot / Perimeter

- update channels shipping font libraries;
- sandbox flags for render helpers;
- module and package provenance;
- measured-state validation for rendering services where applicable.

## Processing chain

```text
Container(woff2/otf/ttf/pdf)
  -> Decompressor
  -> OTS / validator
  -> Table parse(cmap, glyf, gvar, GSUB, GPOS, fvar, STAT, COLR, CPAL, kern, name)
  -> Shaper(HarfBuzz or platform equivalent)
  -> Rasterizer(FreeType / Skia / platform equivalent)
  -> Glyph cache(fontconfig or equivalent)
  -> Consumer(app, browser, document viewer, renderer)
```

## LSA dimensions

The Font and Rendering surface uses the following LSA-10 dimensions:

- L1 container metadata: MIME, size bucket, compression ratio;
- L2 table inventory and table lengths;
- L3 offset consistency and cross-reference integrity;
- L4 cmap density, sparsity, and codepoint lanes;
- L5 GSUB / GPOS rule count, fan-out, and recursion depth;
- L6 variation axes: `fvar`, `STAT`, `gvar` deltas;
- L7 color and layer behavior: `COLR`, `CPAL`, palette/layer counts;
- L8 shaping time per 1k glyphs;
- L9 raster time and cache churn;
- L10 validator / sanitizer verdict.

## LSI prime anchors

The recommended LSI anchors are:

- p5 tableset;
- p7 cmap lanes;
- p11 GSUB / GPOS depth;
- p13 variation axes;
- p17 shaping time;
- p19 raster churn;
- p23 OTS / sanitizer verdict;
- p29 cache churn;
- p31 CSP / policy gate.

Related topic anchors:

- Topic 7: virtual display and rendering guards;
- Topic 9: header typing and Omega scoring;
- Topic 10: JA3 / QUIC / qlog enrichment for fetch context;
- Topic 18: publishing and provenance;
- Topic 20: topology / co-occurrence motifs.

## Seven-phase drill

### V1 — Observe

Task:

- mirror font fetch metadata where authorized;
- record CSP `font-src` behavior;
- collect validator verdicts;
- produce table maps for benign corpus;
- attach boundary events for `font_load`, `document_open`, and related content actions.

Gates:

- read-only;
- no writes outside own workdir;
- no malformed samples;
- no payload execution;
- alpha-bound CPU and memory ceilings.

Outputs:

- `font.observe.jsonl`;
- boundary events for font/content actions;
- `font.table.map.jsonl` where applicable.

### V2 — Profile

Task:

- time shaping on benign corpus;
- time rasterization on benign corpus;
- log GSUB / GPOS depth;
- profile cache churn;
- baseline normal table combinations.

Gates:

- P95 shaping at or below baseline times configured multiplier;
- no sanitizer warnings for promoted corpus;
- no retention of sensitive document content.

Outputs:

- `font.profile.jsonl`;
- `font.baseline.report.json`.

### V3 — Cloak / Enforce

Task:

- enforce or recommend CSP `font-src` policy;
- deny remote fonts except allowlisted sources where policy requires;
- require clean validator pass before cache use;
- route policy diffs through Warden.

Gates:

- Warden can LIMIT on sanitizer failure;
- Warden can LIMIT on CSP bypass;
- client-facing changes require proper approval path.

Outputs:

- `font.policy.pack.json`;
- `font.policy.diff.json`;
- proof refs.

### V4 — Swap / Synthetic Stress

Task:

- generate inert stress shapes using valid, sanitizer-passing samples only;
- exercise oversized but valid tables;
- exercise high but benign GSUB fan-out;
- exercise dense cmap lanes;
- throttle via random-phased cadence.

Gates:

- no malformed payload distribution;
- no exploit samples;
- validator must pass;
- resource ceiling applies;
- Michael Heller signoff required if the drill is elevated beyond standing lab-safe policy.

Outputs:

- `font.swap.proof.json`;
- Omega drift chart;
- detector-training metadata.

### V5 — ALIGN

Task:

- minimize font set;
- strip unused tables where appropriate;
- pin allowlisted WOFF2 / OTF artifacts by digest;
- disable risky optional paths where policy requires;
- freeze printer font ingestion when needed.

Gates:

- validator pass;
- CSP verified;
- cache churn reduced versus baseline;
- rollback plan present.

Outputs:

- `font.align.report.json`;
- `font.digest.allowlist.json`.

### V6 — Train and Threshold

Task:

- train detectors on table, shape, timing, and policy features;
- lock Omega bands for font events;
- run false-positive checks;
- wire drift guard to SPEC.

Gates:

- false-positive rate at or below configured threshold;
- drift guard linked;
- redaction state declared.

Outputs:

- `font.detector.thresholds.json`;
- `font.training.report.json`.

### V7 — Promote and Diffuse

Task:

- Scribe seals the pack;
- Preceptor or authorized governance promotes if gates pass;
- OFIF may expose client-facing summary where appropriate;
- Bridge-Steward may diffuse proof leaves only when BridgeMode gates are green.

Gates:

- proof pack present;
- redaction state declared;
- FROST / quorum where required;
- Michael Heller signoff for BridgeMode or sensitive release until delegated policy exists.

Outputs:

- `font.v7.bundle.json`;
- signed assurance summary;
- OFIF client-facing digest where approved.

## Agent roles

- Scout: V1 and V2 observation/profile.
- Whisper: V3 egress and policy recommendation for browser/network font fetches.
- Warden: V3/V5/V7 policy gate and LIMIT authority.
- Shade: V4 safe synthetic stress shapes.
- Sapper-Sim: benign response-chain validation.
- Scribe: proof capture and sealing.
- Herald: cadence and phase orchestration.
- Veil: DLP and redaction on logs and reports.
- EvalAngelica: threshold and learning-quality review.

## Immediate controls

Recommended defensive controls:

- validator/sanitizer pass before cache or use;
- reject non-allowlisted remote fonts where policy requires;
- CSP `font-src` discipline;
- WAF or gateway hash/prefix checks where appropriate;
- rate-limit unusual font churn;
- isolated helper process for shaper/rasterizer;
- no network from render helpers unless explicitly required;
- tmpfs-only or restricted scratch space;
- noexec/nodev/nosuid font caches where feasible;
- purge cache on validator failure;
- preflight embedded fonts in PDFs and office documents;
- reject service-worker font fetches outside approved origin policy;
- strip duplicate privileged headers in related browser/network fetch context.

## Omega score for font events

Conceptual score:

```text
Omega_font =
  0.35 * table_rarity
+ 0.25 * cmap_sparsity
+ 0.20 * shape_time_z
+ 0.10 * cache_churn_z
+ 0.10 * policy_bypass_flag
```

Bands:

- Omega high: quarantine, rerender, or require review depending on policy.
- Omega medium: keep text where safe, deny remote fetch where needed, route for review.
- Omega low: cache and allowlist if other gates pass.

This score is a feature and triage signal, not a standalone proof of maliciousness.

## Boundary Hypergraph mapping

Relevant boundary verbs:

- `font_load`;
- `document_open`;
- `canvas_render`;
- `file_read`;
- `file_write`;
- `module_load`;
- `config_change`;
- `request` / `response` for remote font fetches.

Artifacts:

- `FontFile`;
- `Document`;
- `BrowserState`;
- `ConfigFile`;
- `BinaryModule`;
- `LogRecord`.

Negative evidence examples:

- expected sanitizer record missing;
- expected cache purge record missing after validator failure;
- expected CSP violation record missing after denied font fetch;
- expected module signature record missing for rendering helper.

## DEFENSE mode

DEFENSE mode uses this surface for:

- rendering attack-surface reduction;
- safe anomaly detection;
- supply-chain verification;
- browser/document hardening;
- detector training with inert samples;
- proof-backed assurance.

## LEARNING mode

LEARNING mode uses this surface for:

- teaching table structures and render pipeline boundaries;
- LSA/LSI feature learning;
- parser/validator corpus generation;
- safe detector examples;
- publishing pipeline reproducibility lessons.

LEARNING outputs must be redacted and must not include unsafe sample material.

## OFIF / Orion output

OFIF may expose:

- rendering posture summary;
- font policy status;
- sanitizer pass/fail summary;
- supply-chain drift summary;
- recommended remediation;
- assurance packet.

OFIF should not expose raw font internals, sensitive documents, or internal detector details unless explicitly approved and redacted.

## Failure modes

- corpus bias toward one script or locale;
- host-sensitive timing noise;
- divergent renderer behavior;
- sanitizer drift;
- false positives from legitimate complex fonts;
- overbroad CSP breakage;
- cache churn misattribution;
- PDF renderer variance.

## Refinements

- Add Hebrew, Arabic, CJK, and other script families to reduce corpus bias.
- Isolate CPU cores and governors for timing tests.
- Standardize two reference renderers and record deltas.
- Pin HarfBuzz / FreeType or equivalent library versions for benchmark comparability.
- Fail CI on render-library bumps without V2/V6 re-baselining.

## Required follow-ups

Schemas:

- `font-observation.schema.json`;
- `font-profile.schema.json`;
- `font-policy-pack.schema.json`;
- `font-swap-proof.schema.json`;
- `font-detector-thresholds.schema.json`.

Examples:

- benign font load boundary event;
- sanitizer failure finding;
- negative evidence for missing validator record;
- font Omega high example;
- OFIF rendering posture summary.

CI checks:

- no unsafe sample files;
- all examples synthetic or benign;
- every font policy pack has rollback posture;
- every promoted threshold pack has false-positive evidence;
- client-facing output has redaction state.

## Completion definition

This surface is implementation-backed only when it has schemas, examples, CI validation, synthetic/benign fixtures, proof-shape validation, and dashboard representation. Until then, this document is canonical prose capture, not runtime implementation.
