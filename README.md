# StrataScale — Enterprise Cloud Migration & FinOps Assessment Workbench

StrataScale is a light-mode technical decision workbench (**Architectural Cloud Ledger**) built with Next.js 15, TypeScript, Tailwind CSS, ExcelJS, and PptxGenJS. It enables enterprise cloud architects and FinOps leads to evaluate multi-application migration portfolios, resolve topological dependency waves with cycle diagnostics, model 36-month FinOps & carbon-aware TCO cashflows, and generate executive-ready `.xlsx` workbooks and `.pptx` steering decks with zero external database dependencies.

---

## Architecture Overview

```
src/
├── app/
│   ├── api/
│   │   ├── export/
│   │   │   ├── xlsx/route.ts       # Multi-sheet .xlsx generator (ExcelJS + live formulas)
│   │   │   └── pptx/route.ts       # 5-slide .pptx Executive Steering Deck (PptxGenJS)
│   │   └── ingest/route.ts         # Multipart .csv/.xlsx parser + .xlsx template download
│   ├── globals.css
│   ├── layout.tsx                  # Plus Jakarta Sans + IBM Plex Mono typography
│   └── page.tsx
├── components/
│   ├── StrataScaleWorkbench.tsx    # Collapsible desktop rail, mobile drawer, sticky actions, footer
│   ├── PortfolioMatrixView.tsx     # 6R ledger summary, filterable matrix, inspector & editor
│   ├── DependencyDagView.tsx       # Interactive SVG Wave Blueprint & Tarjan SCC cycle viewer
│   ├── FinopsSimulatorView.tsx     # Commitment mix, utilization, region carbon & 36-mo SVG chart
│   ├── IngestionSchemaView.tsx     # Drag/drop upload, CSV tester & interactive column mapper
│   └── DispositionBadge.tsx
├── data/
│   └── portfolios.ts               # 3 realistic seeded portfolios (14, 12, and 16 workloads)
├── lib/
│   ├── migrationEngine.ts          # Weighted 6R scorer, Tarjan SCC, Kahn wave sequencer
│   ├── finopsEngine.ts             # Right-sizing, wave-phased cashflows, break-even & CO2e
│   ├── ingestion.ts                # RFC-4180 CSV parser, ExcelJS reader/template, validation
│   └── exporters/
│       ├── xlsxExporter.ts         # 4-sheet workbook builder with live formulas
│       └── pptxExporter.ts         # 5-slide deck builder with native tables & charts
└── types/
    └── stratascale.ts
```

---

## Core Algorithmic Design

### 1. Multi-Criteria Weighted 6R Disposition Engine (`src/lib/migrationEngine.ts`)
Each workload is evaluated deterministically across six cloud strategies (`Rehost`, `Replatform`, `Refactor`, `Repurchase`, `Retire`, `Retain`) using weighted signals:
- **Retire**: driven by decommission candidate flag, very low business value, and sub-15% CPU/RAM zombie utilization.
- **Retain**: driven by regulatory residency locks, mainframe coupling, and strict compliance regimes (`PCI-DSS`, `HIPAA`, `ISO-27001`).
- **Repurchase**: driven by commercial SaaS equivalence on non-differentiating capabilities.
- **Rehost**: prioritized for End-of-Life (EOL) OS mitigation, tight DB coupling, and rapid cutover risk reduction.
- **Replatform**: balances moderate-to-high readiness with managed database/container efficiency.
- **Refactor**: rewards high business differentiation, stateless or loose DB coupling, and high cloud readiness.

Confidence percentage is computed from the score margin between the top and runner-up strategies, accompanied by human-readable rationale tags and Fibonacci-scaled complexity points (1–21).

### 2. Topological Wave Sequencing & Cycle Detection (`src/lib/migrationEngine.ts`)
- **Tarjan's Strongly Connected Components (SCC)**: traverses the directed prerequisite graph (`upstream -> dependent`) in $O(V + E)$ to detect multi-node cycles and self-loops, bundling cyclic workloads into explicit SCC remediation groups (`SCC-1`, `SCC-2`, ...) and flagging downstream dependents.
- **Condensation DAG + Kahn's Topological Sort**: collapses any cyclic SCCs into super-nodes and executes level-by-level Kahn's wave peeling to produce earliest valid execution waves (`Wave 1 .. Wave N`).

### 3. FinOps & Carbon-Aware Sizing Model (`src/lib/finopsEngine.ts`)
- **Right-Sizing**: scales allocated vCPUs and RAM dynamically against the target utilization slider (`40%–85%`), constrained with safe operational floors/headroom bounds.
- **Commitment Mix**: blends On-Demand (`1.00x`), 1-Yr Savings Plan (`0.68x`), and 3-Yr Reserved (`0.44x`) pricing across regional cost multipliers (`us-east-1`, `eu-central-1`, `ap-south-1`).
- **Wave-Phased 36-Month Cashflow**: simulates dual-run baseline spend before each workload's topological wave cutover month, one-time migration engineering labor (plus contingency buffer), and steady-state cloud spend to compute 3-year Net TCO Savings and Break-Even Month.
- **Regional Carbon Accounting**: compares legacy on-premises facility power (`PUE 1.67`, `0.560 kgCO2e/kWh`) against right-sized hyperscale workloads using regional PUE (`1.15–1.38`) and grid carbon intensity (`0.311–0.708 kgCO2e/kWh`) to quantify annual emissions abatement (`tCO2e/yr`).

---

## Executive Deliverable Exports

- **`POST /api/export/xlsx`**: Generates a 4-sheet workbook (`Executive Summary`, `6R Workload Matrix`, `Wave Plan`, `3-Year FinOps Cashflow`) with live Excel formulas (`SUM`, `COUNTA`, `COUNTIF`, `SUMIF`, `AVERAGE`, cumulative sums, and net savings deltas).
- **`POST /api/export/pptx`**: Generates a 5-slide widescreen executive briefing deck (`Title Slide`, `Portfolio 6R Breakdown`, `Dependency Wave Roadmap`, `3-Year FinOps TCO & Break-Even`, `Risk & EOL Mitigation Summary`) using native PowerPoint tables and charts.

---

## Local Setup & Verification

```bash
# 1. Install dependencies
npm install

# 2. Run Vitest unit & API integration suite
npm test

# 3. Run strict TypeScript check
npx tsc --noEmit

# 4. Build production Next.js bundle
npm run build

# 5. Start production server (http://localhost:3000)
npm start
```

### Environment & Deployment Notes
- **Zero External Database**: All seeded portfolios, CSV/XLSX ingestion, graph topology algorithms, FinOps modeling, and binary `.xlsx`/`.pptx` generation run deterministically in-memory and via stateless Node.js API routes.
- **Vercel Deployment**: Ready for immediate deployment to Vercel with no environment variables required. `next.config.ts` configures `serverExternalPackages: ['exceljs', 'pptxgenjs']` for clean serverless Node.js execution.
