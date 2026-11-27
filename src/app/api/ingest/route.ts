import { NextRequest, NextResponse } from 'next/server';
import { SEEDED_PORTFOLIOS } from '@/data/portfolios';
import {
  buildTemplateXlsxBuffer,
  mapAndValidateRows,
  parseCsvText,
  parseXlsxBufferToRows,
  workloadsToCsv,
} from '@/lib/ingestion';
import type { ColumnMapping, Workload } from '@/types/stratascale';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const format = request.nextUrl.searchParams.get('template') ?? 'xlsx';
  const sampleWorkloads = SEEDED_PORTFOLIOS[0].workloads.slice(0, 5);

  if (format === 'csv') {
    const csv = workloadsToCsv(sampleWorkloads);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="stratascale-portfolio-template.csv"',
      },
    });
  }

  const xlsxBytes = await buildTemplateXlsxBuffer(sampleWorkloads);
  return new NextResponse(Buffer.from(xlsxBytes), {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="stratascale-portfolio-template.xlsx"',
      'Content-Length': String(xlsxBytes.byteLength),
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');
      const mappingRaw = formData.get('mapping');

      if (!file || typeof file === 'string') {
        return NextResponse.json(
          { error: 'Missing uploaded file in multipart form field "file".' },
          { status: 400 }
        );
      }

      let customMapping: ColumnMapping | undefined;
      if (typeof mappingRaw === 'string' && mappingRaw.trim()) {
        customMapping = JSON.parse(mappingRaw) as ColumnMapping;
      }

      const fileName = file.name.toLowerCase();
      const arrayBuffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);

      let parsed: { headers: string[]; rows: Array<Record<string, string>> };
      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xlsm')) {
        parsed = await parseXlsxBufferToRows(uint8);
      } else if (fileName.endsWith('.csv') || fileName.endsWith('.txt')) {
        const text = new TextDecoder('utf-8').decode(uint8);
        parsed = parseCsvText(text);
      } else {
        return NextResponse.json(
          { error: 'Unsupported file extension. Please upload a .csv or .xlsx file.' },
          { status: 400 }
        );
      }

      const result = mapAndValidateRows(parsed.headers, parsed.rows, customMapping);
      return NextResponse.json(result, { status: 200 });
    }

    // JSON payload mode: supports csvText + mapping, rawRows + mapping, or direct workloads
    const body = (await request.json()) as {
      csvText?: string;
      headers?: string[];
      rawRows?: Array<Record<string, string>>;
      mapping?: ColumnMapping;
      workloads?: Workload[];
    };

    if (typeof body.csvText === 'string') {
      const parsed = parseCsvText(body.csvText);
      const result = mapAndValidateRows(parsed.headers, parsed.rows, body.mapping);
      return NextResponse.json(result, { status: 200 });
    }

    if (Array.isArray(body.rawRows) && Array.isArray(body.headers)) {
      const result = mapAndValidateRows(body.headers, body.rawRows, body.mapping);
      return NextResponse.json(result, { status: 200 });
    }

    if (Array.isArray(body.workloads)) {
      return NextResponse.json(
        {
          workloads: body.workloads,
          detectedHeaders: [],
          appliedMapping: {},
          rawRowCount: body.workloads.length,
          warnings: [],
          errors: [],
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { error: 'Provide either multipart file (.csv/.xlsx) or JSON csvText.' },
      { status: 400 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to ingest portfolio dataset.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
