import { NextRequest, NextResponse } from 'next/server';
import { SEEDED_PORTFOLIOS } from '@/data/portfolios';
import { generatePortfolioPptxBuffer } from '@/lib/exporters/pptxExporter';
import { DEFAULT_FINOPS_ASSUMPTIONS, runFinopsSimulation } from '@/lib/finopsEngine';
import { analyzePortfolioMigration } from '@/lib/migrationEngine';
import type { ExportRequestPayload } from '@/types/stratascale';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    let payload: Partial<ExportRequestPayload> = {};
    try {
      payload = (await request.json()) as Partial<ExportRequestPayload>;
    } catch {
      payload = {};
    }

    const workloads =
      Array.isArray(payload.workloads) && payload.workloads.length > 0
        ? payload.workloads
        : SEEDED_PORTFOLIOS[0].workloads;
    const portfolioName =
      typeof payload.portfolioName === 'string' && payload.portfolioName.trim()
        ? payload.portfolioName.trim()
        : SEEDED_PORTFOLIOS[0].name;
    const assumptions = payload.assumptions ?? DEFAULT_FINOPS_ASSUMPTIONS;

    const analysis = analyzePortfolioMigration(workloads);
    const finops = runFinopsSimulation(analysis, assumptions);
    const pptxBytes = await generatePortfolioPptxBuffer(portfolioName, analysis, finops);

    const safeSlug = portfolioName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    return new NextResponse(Buffer.from(pptxBytes), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="stratascale-${safeSlug || 'steering-deck'}.pptx"`,
        'Content-Length': String(pptxBytes.byteLength),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate PPTX export.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
