# StrataScale Design Specification

## Visual Concept: Architectural Cloud Ledger
StrataScale is a light-mode technical decision workbench modeled after engineering specification sheets and cloud architecture blueprints. Rather than marketing cards or decorative gradients, it uses hairline borders, tabular numeric alignment, high-contrast neutral paper surfaces, and calm precision cobalt accents to let technology consultants evaluate multi-application migration portfolios, dependency DAGs, and 3-year FinOps cashflows side by side.

## Color Palette & Semantic Roles
| Semantic Role | Hex | Usage |
| --- | --- | --- |
| Canvas Surface | `#F8FAFC` | Primary application background |
| Paper Surface | `#FFFFFF` | Analytical tables, wave timeline, and TCO model panels |
| Muted Surface | `#EEF2F6` | Sidebar rail background and table header bands |
| Primary Ink | `#0F172A` | Headings, table figures, primary labels |
| Muted Ink | `#475569` | Secondary captions, column descriptions, footer credit |
| Hairline Border | `#CBD5E1` / `#E2E8F0` | Structural grid lines and input borders |
| Primary Accent | `#0369A1` | Active navigation item, primary export actions, focus rings |
| Success / Savings | `#047857` | Positive 3-year TCO delta, valid DAG waves, Rehost/Retire badges |
| Warning / Caution | `#B45309` | Refactor complexity flags, coupled dependencies |
| Danger / Blocker | `#DC2626` | Dependency cycles, EOL OS risk, high migration risk |

## Typography
- **Display & UI Sans**: `Plus Jakarta Sans` (Google Fonts, fallback `system-ui, sans-serif`) for clear executive legibility across headings, navigation labels, and dense tables.
- **Tabular Monospace**: `IBM Plex Mono` (Google Fonts, fallback `monospace`) with `tabular-nums` for workload IDs, wave indices, monthly FinOps spend, and break-even metrics.

## Layout & Navigation Model
- **Desktop (>=1024px)**: Persistent collapsible left vertical navigation rail (`240px`) switching between four workspace views (`Portfolio Matrix`, `Dependency DAG`, `FinOps Simulator`, `Ingestion & Schema`) paired with a sticky top action bar (`Dataset Selector`, `Export .xlsx`, `Export .pptx`).
- **Mobile (<1024px)**: Left rail collapses cleanly into a slide-over drawer triggered by a top menu button without obscuring content; sticky action controls wrap into compact horizontal rows with zero horizontal overflow.
- **Attribution Credit**: Positioned cleanly at the bottom-right of the persistent workspace footer: exact text `made with ♥ by Tejdeep` linking to `https://github.com/TejdeepKodati/stratascale`, styled in `#475569` muted ink with `#0369A1` hover underline.

## Rationale
Enterprise migration and FinOps reviews happen during live client workshops and executive steering meetings where readability on projectors, unambiguous tabular numbers, and immediate access to `.xlsx`/`.pptx` deliverables matter far more than ambient decoration. A cool paper ledger with left-rail workflow switching supports rapid back-and-forth between workload scoring, topological wave sequencing, and TCO sensitivity modeling.
