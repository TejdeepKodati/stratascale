import { describe, expect, it } from 'vitest';
import { SEEDED_PORTFOLIOS } from '@/data/portfolios';
import {
  buildTemplateXlsxBuffer,
  mapAndValidateRows,
  parseCsvText,
  parseXlsxBufferToRows,
} from '@/lib/ingestion';

describe('CSV & XLSX Portfolio Ingestion & Schema Mapper', () => {
  it('parses RFC-4180 CSV with quoted fields and maps aliased headers', () => {
    const csv = [
      'App Code,"Service Name",OS Release,Monthly Spend ($),Depends On',
      'X-01,"Auth, Identity & SSO",Ubuntu 22.04 LTS,"$9,400",',
      'X-02,"Legacy Billing, Core",Windows Server 2012 R2,18500,X-01; X-99',
    ].join('\n');

    const parsed = parseCsvText(csv);
    expect(parsed.headers).toEqual([
      'App Code',
      'Service Name',
      'OS Release',
      'Monthly Spend ($)',
      'Depends On',
    ]);
    expect(parsed.rows).toHaveLength(2);

    const result = mapAndValidateRows(parsed.headers, parsed.rows);
    expect(result.errors).toHaveLength(0);
    expect(result.workloads).toHaveLength(2);
    expect(result.workloads[0].id).toBe('X-01');
    expect(result.workloads[0].name).toBe('Auth, Identity & SSO');
    expect(result.workloads[0].monthlyOnPremCostUsd).toBe(9400);
    expect(result.workloads[1].eolOs).toBe(true); // inferred from Windows Server 2012 R2
    expect(result.workloads[1].dependencies).toEqual(['X-01', 'X-99']);
    expect(result.warnings.some((w) => w.includes('X-99'))).toBe(true);
  });

  it('reports duplicate workload IDs as schema errors', () => {
    const csv = [
      'id,name,monthlyOnPremCostUsd',
      'DUP-1,Service One,5000',
      'DUP-1,Service Two,7000',
    ].join('\n');

    const parsed = parseCsvText(csv);
    const result = mapAndValidateRows(parsed.headers, parsed.rows);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.workloads).toHaveLength(1);
  });

  it('round-trips generated .xlsx template through parseXlsxBufferToRows cleanly', async () => {
    const sample = SEEDED_PORTFOLIOS[0].workloads.slice(0, 5);
    const bytes = await buildTemplateXlsxBuffer(sample);

    // Verify PK zip magic header
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);

    const parsed = await parseXlsxBufferToRows(bytes);
    const result = mapAndValidateRows(parsed.headers, parsed.rows);

    expect(result.errors).toHaveLength(0);
    expect(result.workloads).toHaveLength(5);
    expect(result.workloads[0].id).toBe(sample[0].id);
    expect(result.workloads[2].dependencies).toEqual(sample[2].dependencies);
  });
});
