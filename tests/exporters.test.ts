import ExcelJS from 'exceljs';
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { POST as exportPptxPost } from '@/app/api/export/pptx/route';
import { POST as exportXlsxPost } from '@/app/api/export/xlsx/route';
import { GET as ingestTemplateGet, POST as ingestPost } from '@/app/api/ingest/route';
import { SEEDED_PORTFOLIOS } from '@/data/portfolios';
import { DEFAULT_FINOPS_ASSUMPTIONS } from '@/lib/finopsEngine';

describe('Binary Deliverable Exporters & Ingest API Routes', () => {
  it('POST /api/export/xlsx streams a valid 4-sheet workbook with real Excel formulas', async () => {
    const payload = {
      portfolioName: SEEDED_PORTFOLIOS[0].name,
      workloads: SEEDED_PORTFOLIOS[0].workloads,
      assumptions: DEFAULT_FINOPS_ASSUMPTIONS,
    };

    const req = new NextRequest('http://localhost:3000/api/export/xlsx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const res = await exportXlsxPost(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    const buf = new Uint8Array(await res.arrayBuffer());
    expect(buf[0]).toBe(0x50); // 'P'
    expect(buf[1]).toBe(0x4b); // 'K'

    const wb = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(buf as any);

    const sheetNames = wb.worksheets.map((ws) => ws.name);
    expect(sheetNames).toEqual([
      'Executive Summary',
      '6R Workload Matrix',
      'Wave Plan',
      '3-Year FinOps Cashflow',
    ]);

    const summary = wb.getWorksheet('Executive Summary')!;
    const formulaVal = summary.getCell('B5').value as { formula?: string };
    expect(formulaVal?.formula).toContain('COUNTA');

    const matrix = wb.getWorksheet('6R Workload Matrix')!;
    const deltaFormula = matrix.getCell('Q2').value as { formula?: string };
    expect(deltaFormula?.formula).toBe('N2-P2');

    const cashflow = wb.getWorksheet('3-Year FinOps Cashflow')!;
    const cashTotal = cashflow.getCell('C38').value as { formula?: string };
    expect(cashTotal?.formula).toBe('SUM(C2:C37)');
  });

  it('POST /api/export/pptx streams a valid 5-slide Steering Committee deck with PK header', async () => {
    const payload = {
      portfolioName: SEEDED_PORTFOLIOS[1].name,
      workloads: SEEDED_PORTFOLIOS[1].workloads,
      assumptions: DEFAULT_FINOPS_ASSUMPTIONS,
    };

    const req = new NextRequest('http://localhost:3000/api/export/pptx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const res = await exportPptxPost(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain(
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    );

    const buf = new Uint8Array(await res.arrayBuffer());
    expect(buf[0]).toBe(0x50); // 'P'
    expect(buf[1]).toBe(0x4b); // 'K'
    expect(buf.byteLength).toBeGreaterThan(25_000);

    // Inspect ZIP entries in the PPTX binary to assert all 5 slides exist
    const rawAscii = Buffer.from(buf).toString('latin1');
    for (let i = 1; i <= 5; i++) {
      expect(rawAscii).toContain(`ppt/slides/slide${i}.xml`);
    }
    expect(rawAscii).not.toContain('ppt/slides/slide6.xml');
  });

  it('GET /api/ingest?template=xlsx and POST /api/ingest work end-to-end', async () => {
    const tplReq = new NextRequest(
      'http://localhost:3000/api/ingest?template=xlsx'
    );
    const tplRes = await ingestTemplateGet(tplReq);
    expect(tplRes.status).toBe(200);
    const tplBuf = new Uint8Array(await tplRes.arrayBuffer());
    expect(tplBuf[0]).toBe(0x50);
    expect(tplBuf[1]).toBe(0x4b);

    const csvReq = new NextRequest('http://localhost:3000/api/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        csvText:
          'id,name,monthlyOnPremCostUsd,dependencies\nT-1,Gateway,5000,\nT-2,API,8000,T-1',
      }),
    });
    const csvRes = await ingestPost(csvReq);
    expect(csvRes.status).toBe(200);
    const json = (await csvRes.json()) as {
      workloads: Array<{ id: string }>;
      errors: string[];
    };
    expect(json.errors).toHaveLength(0);
    expect(json.workloads.map((w) => w.id)).toEqual(['T-1', 'T-2']);
  });
});
