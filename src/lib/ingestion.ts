import ExcelJS from 'exceljs';
import type {
  CanonicalWorkloadField,
  ColumnMapping,
  ComplianceTier,
  CriticalityTier,
  DbCouplingLevel,
  IngestionResult,
  Workload,
} from '@/types/stratascale';

export interface SchemaFieldSpec {
  field: CanonicalWorkloadField;
  label: string;
  required: boolean;
  type: string;
  description: string;
  example: string;
}

export const WORKLOAD_SCHEMA_SPECS: SchemaFieldSpec[] = [
  {
    field: 'id',
    label: 'Workload ID',
    required: true,
    type: 'string',
    description: 'Unique tabular workload identifier',
    example: 'APP-01',
  },
  {
    field: 'name',
    label: 'Application Name',
    required: true,
    type: 'string',
    description: 'Human-readable service or application title',
    example: 'Checkout Order Engine',
  },
  {
    field: 'domain',
    label: 'Business Domain',
    required: false,
    type: 'string',
    description: 'Capability area or business unit',
    example: 'Digital Storefront',
  },
  {
    field: 'environment',
    label: 'Environment',
    required: false,
    type: 'Production | Staging | DR',
    description: 'Runtime environment tier',
    example: 'Production',
  },
  {
    field: 'os',
    label: 'Operating System',
    required: false,
    type: 'string',
    description: 'Host OS release version',
    example: 'RHEL 7.9',
  },
  {
    field: 'eolOs',
    label: 'EOL OS Flag',
    required: false,
    type: 'boolean',
    description: 'True if OS is End-of-Life or extended support',
    example: 'true',
  },
  {
    field: 'complianceTier',
    label: 'Compliance Tier',
    required: false,
    type: 'PCI-DSS | HIPAA | ISO-27001 | SOC2 | Standard',
    description: 'Primary regulatory compliance regime',
    example: 'PCI-DSS',
  },
  {
    field: 'criticality',
    label: 'Criticality',
    required: false,
    type: 'Tier-1 | Tier-2 | Tier-3',
    description: 'Availability / recovery criticality',
    example: 'Tier-1',
  },
  {
    field: 'vcpus',
    label: 'Allocated vCPUs',
    required: false,
    type: 'number',
    description: 'Provisioned logical CPU cores',
    example: '16',
  },
  {
    field: 'ramGb',
    label: 'Allocated RAM (GB)',
    required: false,
    type: 'number',
    description: 'Provisioned memory in GiB',
    example: '64',
  },
  {
    field: 'storageTb',
    label: 'Storage (TB)',
    required: false,
    type: 'number',
    description: 'Allocated block/file storage in TB',
    example: '4.5',
  },
  {
    field: 'cpuUtilPct',
    label: 'CPU Utilization (%)',
    required: false,
    type: 'number (1-100)',
    description: 'Observed P95/avg CPU utilization percentage',
    example: '42',
  },
  {
    field: 'ramUtilPct',
    label: 'RAM Utilization (%)',
    required: false,
    type: 'number (1-100)',
    description: 'Observed memory utilization percentage',
    example: '55',
  },
  {
    field: 'monthlyEgressGb',
    label: 'Monthly Egress (GB)',
    required: false,
    type: 'number',
    description: 'Outbound network transfer volume per month',
    example: '450',
  },
  {
    field: 'dbCoupling',
    label: 'DB Coupling',
    required: false,
    type: 'None | Loose | Tight | Mainframe',
    description: 'Statefulness and database schema coupling',
    example: 'Tight',
  },
  {
    field: 'hasSaasEquivalent',
    label: 'SaaS Equivalent',
    required: false,
    type: 'boolean',
    description: 'Commercial SaaS replacement exists',
    example: 'false',
  },
  {
    field: 'cloudReadinessScore',
    label: 'Cloud Readiness (1-100)',
    required: false,
    type: 'number',
    description: 'Container/stateless modernization readiness',
    example: '72',
  },
  {
    field: 'businessValueScore',
    label: 'Business Value (1-100)',
    required: false,
    type: 'number',
    description: 'Strategic business differentiation score',
    example: '80',
  },
  {
    field: 'regulatoryResidencyLock',
    label: 'Residency Lock',
    required: false,
    type: 'boolean',
    description: 'Hard hardware/residency retention constraint',
    example: 'false',
  },
  {
    field: 'decommissionCandidate',
    label: 'Decommission Candidate',
    required: false,
    type: 'boolean',
    description: 'Scheduled for sunset / archival retirement',
    example: 'false',
  },
  {
    field: 'monthlyOnPremCostUsd',
    label: 'Monthly On-Prem Cost ($)',
    required: true,
    type: 'number',
    description: 'Current monthly infrastructure + license spend USD',
    example: '14200',
  },
  {
    field: 'dependencies',
    label: 'Upstream Dependencies',
    required: false,
    type: 'string (semicolon/comma/pipe list)',
    description: 'IDs of upstream prerequisite workloads',
    example: 'APP-01; APP-02',
  },
  {
    field: 'notes',
    label: 'Architecture Notes',
    required: false,
    type: 'string',
    description: 'Context or migration caveats',
    example: 'Legacy .NET Framework service',
  },
];

const FIELD_ALIASES: Record<CanonicalWorkloadField, string[]> = {
  id: ['id', 'workloadid', 'appid', 'applicationid', 'code', 'appcode'],
  name: [
    'name',
    'appname',
    'applicationname',
    'workloadname',
    'servicename',
    'application',
    'service',
    'workload',
  ],
  domain: ['domain', 'businessdomain', 'capability', 'portfolio', 'unit', 'businessunit'],
  environment: ['environment', 'env', 'tier', 'stage'],
  os: ['os', 'operatingsystem', 'osversion', 'osrelease', 'platformos'],
  eolOs: ['eolos', 'eol', 'iseol', 'endofsupport', 'eolflag'],
  complianceTier: ['compliancetier', 'compliance', 'regulatory', 'regulation'],
  criticality: ['criticality', 'businesscriticality', 'priority', 'tiercriticality'],
  vcpus: ['vcpus', 'vcpu', 'cores', 'cpucores', 'cpus'],
  ramGb: ['ramgb', 'ram', 'memorygb', 'memory'],
  storageTb: ['storagetb', 'storage', 'disktb'],
  cpuUtilPct: ['cpuutilpct', 'cpuutil', 'cpuutilization', 'avgcpu', 'cpu'],
  ramUtilPct: ['ramutilpct', 'ramutil', 'ramutilization', 'memutil', 'memoryutilization'],
  monthlyEgressGb: ['monthlyegressgb', 'egressgb', 'egress', 'networkegress'],
  dbCoupling: ['dbcoupling', 'databasecoupling', 'coupling', 'dbdependency'],
  hasSaasEquivalent: ['hassaasequivalent', 'saas', 'saasfit', 'saasavailable'],
  cloudReadinessScore: ['cloudreadinessscore', 'cloudreadiness', 'readiness', 'readinessscore'],
  businessValueScore: ['businessvaluescore', 'businessvalue', 'value', 'strategicvalue'],
  regulatoryResidencyLock: ['regulatoryresidencylock', 'residencylock', 'retainlock', 'onpremlock'],
  decommissionCandidate: ['decommissioncandidate', 'decommission', 'retire', 'sunset'],
  monthlyOnPremCostUsd: [
    'monthlyonpremcostusd',
    'monthlyonpremcost',
    'monthlycost',
    'onpremcost',
    'costusd',
    'monthlyspend',
    'monthlyspendusd',
    'spend',
  ],
  dependencies: ['dependencies', 'dependson', 'upstream', 'upstreamids', 'prereqs'],
  notes: ['notes', 'comments', 'description', 'remarks'],
};

function normalizeHeaderKey(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function autoDetectColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const normalizedToRaw = new Map<string, string>();
  for (const h of headers) {
    const trimmed = h.trim();
    if (trimmed) {
      normalizedToRaw.set(normalizeHeaderKey(trimmed), trimmed);
    }
  }

  for (const spec of WORKLOAD_SCHEMA_SPECS) {
    const aliases = FIELD_ALIASES[spec.field];
    for (const alias of aliases) {
      const match = normalizedToRaw.get(alias);
      if (match) {
        mapping[spec.field] = match;
        break;
      }
    }
  }

  return mapping;
}

/**
 * RFC-4180 compliant CSV parser supporting quoted commas, doubled quotes, and CRLF/LF.
 */
export function parseCsvText(csvText: string): {
  headers: string[];
  rows: Array<Record<string, string>>;
} {
  const clean = csvText.replace(/^\uFEFF/, '');
  const records: string[][] = [];
  let currentField = '';
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    const next = clean[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentField += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentField += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (ch === '\r' && next === '\n') {
        currentRow.push(currentField.trim());
        if (currentRow.some((cell) => cell !== '')) {
          records.push(currentRow);
        }
        currentRow = [];
        currentField = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        currentRow.push(currentField.trim());
        if (currentRow.some((cell) => cell !== '')) {
          records.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        currentField += ch;
      }
    }
  }

  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((cell) => cell !== '')) {
      records.push(currentRow);
    }
  }

  if (records.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = records[0].map((h, idx) => h || `Column_${idx + 1}`);
  const rows: Array<Record<string, string>> = [];
  for (let r = 1; r < records.length; r++) {
    const rec = records[r];
    const rowObj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      rowObj[headers[c]] = (rec[c] ?? '').trim();
    }
    if (Object.values(rowObj).some((v) => v !== '')) {
      rows.push(rowObj);
    }
  }

  return { headers, rows };
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  if (typeof value === 'object') {
    if ('result' in value && value.result !== undefined) {
      return String(value.result).trim();
    }
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join('').trim();
    }
    if ('text' in value && typeof value.text === 'string') {
      return value.text.trim();
    }
  }
  return String(value).trim();
}

export async function parseXlsxBufferToRows(buffer: Buffer | Uint8Array): Promise<{
  headers: string[];
  rows: Array<Record<string, string>>;
}> {
  const workbook = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buffer as any);

  const worksheet =
    workbook.getWorksheet('Workloads') ??
    workbook.worksheets.find((ws) => ws.rowCount > 1) ??
    workbook.worksheets[0];

  if (!worksheet || worksheet.rowCount === 0) {
    return { headers: [], rows: [] };
  }

  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber - 1] = cellToString(cell.value) || `Column_${colNumber}`;
  });

  const cleanHeaders = headers.filter((h) => Boolean(h));
  if (cleanHeaders.length === 0) {
    return { headers: [], rows: [] };
  }

  const rows: Array<Record<string, string>> = [];
  for (let r = 2; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    const obj: Record<string, string> = {};
    let hasAnyValue = false;
    for (let c = 0; c < headers.length; c++) {
      const header = headers[c];
      if (!header) continue;
      const val = cellToString(row.getCell(c + 1).value);
      obj[header] = val;
      if (val !== '') hasAnyValue = true;
    }
    if (hasAnyValue) {
      rows.push(obj);
    }
  }

  return { headers: cleanHeaders, rows };
}

function parseBool(val: string | undefined, fallback = false): boolean {
  if (!val) return fallback;
  const s = val.trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'eol'].includes(s)) return true;
  if (['false', '0', 'no', 'n'].includes(s)) return false;
  return fallback;
}

function parseNumber(val: string | undefined, fallback: number): number {
  if (!val) return fallback;
  const cleaned = val.replace(/[$,%\s,]/g, '');
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeCompliance(val: string | undefined): ComplianceTier {
  const s = (val ?? '').trim().toUpperCase();
  if (s.includes('PCI')) return 'PCI-DSS';
  if (s.includes('HIPAA')) return 'HIPAA';
  if (s.includes('ISO')) return 'ISO-27001';
  if (s.includes('SOC')) return 'SOC2';
  return 'Standard';
}

function normalizeCriticality(val: string | undefined): CriticalityTier {
  const s = (val ?? '').trim().toUpperCase();
  if (s.includes('1') || s === 'HIGH' || s === 'CRITICAL') return 'Tier-1';
  if (s.includes('3') || s === 'LOW') return 'Tier-3';
  return 'Tier-2';
}

function normalizeDbCoupling(val: string | undefined): DbCouplingLevel {
  const s = (val ?? '').trim().toLowerCase();
  if (s.includes('mainframe') || s.includes('cobol') || s.includes('aix')) return 'Mainframe';
  if (s.includes('tight') || s.includes('high')) return 'Tight';
  if (s.includes('none') || s.includes('stateless')) return 'None';
  return 'Loose';
}

function normalizeEnvironment(val: string | undefined): 'Production' | 'Staging' | 'DR' {
  const s = (val ?? '').trim().toLowerCase();
  if (s.includes('stag') || s.includes('uat') || s.includes('dev')) return 'Staging';
  if (s === 'dr' || s.includes('disaster')) return 'DR';
  return 'Production';
}

function inferEolFromOs(osName: string): boolean {
  const lower = osName.toLowerCase();
  return (
    lower.includes('2008') ||
    lower.includes('2012') ||
    lower.includes('rhel 6') ||
    lower.includes('rhel 7') ||
    lower.includes('centos 6') ||
    lower.includes('centos 7') ||
    lower.includes('sles 11') ||
    lower.includes('sles 12') ||
    lower.includes('ubuntu 16') ||
    lower.includes('ubuntu 18')
  );
}

export function mapAndValidateRows(
  headers: string[],
  rawRows: Array<Record<string, string>>,
  customMapping?: ColumnMapping
): IngestionResult {
  const autoMapping = autoDetectColumnMapping(headers);
  const appliedMapping: ColumnMapping = { ...autoMapping, ...customMapping };
  const warnings: string[] = [];
  const errors: string[] = [];

  if (rawRows.length === 0) {
    errors.push('No data rows detected in uploaded dataset.');
    return {
      workloads: [],
      detectedHeaders: headers,
      appliedMapping,
      rawRowCount: 0,
      warnings,
      errors,
      rawRows,
    };
  }

  if (!appliedMapping.id) {
    errors.push('Missing column mapping for required field "Workload ID" (id).');
  }
  if (!appliedMapping.name) {
    errors.push('Missing column mapping for required field "Application Name" (name).');
  }
  if (!appliedMapping.monthlyOnPremCostUsd) {
    warnings.push(
      'No "Monthly On-Prem Cost" column mapped; defaulting missing spend rows to $8,500/mo.'
    );
  }

  const workloads: Workload[] = [];
  const seenIds = new Set<string>();

  rawRows.forEach((row, index) => {
    const rowNum = index + 2;
    const rawId = appliedMapping.id ? (row[appliedMapping.id] ?? '').trim() : '';
    const rawName = appliedMapping.name ? (row[appliedMapping.name] ?? '').trim() : '';

    if (!rawId && !rawName) return;

    const id = rawId || `APP-${String(index + 1).padStart(2, '0')}`;
    const name = rawName || `Unnamed Workload ${id}`;

    if (seenIds.has(id)) {
      errors.push(`Row ${rowNum}: Duplicate workload ID "${id}" skipped.`);
      return;
    }
    seenIds.add(id);

    const os = (appliedMapping.os ? row[appliedMapping.os] : '') || 'Ubuntu 22.04 LTS';
    const eolRaw = appliedMapping.eolOs ? row[appliedMapping.eolOs] : '';
    const eolOs = eolRaw ? parseBool(eolRaw) : inferEolFromOs(os);

    const rawCost = appliedMapping.monthlyOnPremCostUsd
      ? parseNumber(row[appliedMapping.monthlyOnPremCostUsd], -1)
      : 8500;
    let monthlyOnPremCostUsd = rawCost;
    if (rawCost < 0) {
      warnings.push(`Row ${rowNum} (${id}): Invalid or missing monthly cost; defaulted to $8,500.`);
      monthlyOnPremCostUsd = 8500;
    }

    const depRaw = appliedMapping.dependencies ? row[appliedMapping.dependencies] ?? '' : '';
    const dependencies = depRaw
      .split(/[;,|]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s !== '-');

    const vcpus = Math.max(1, Math.round(parseNumber(appliedMapping.vcpus ? row[appliedMapping.vcpus] : undefined, 8)));
    const ramGb = Math.max(2, Math.round(parseNumber(appliedMapping.ramGb ? row[appliedMapping.ramGb] : undefined, 32)));
    const storageTb = Math.max(0.1, parseNumber(appliedMapping.storageTb ? row[appliedMapping.storageTb] : undefined, 2.0));
    const cpuUtilPct = Math.min(100, Math.max(1, Math.round(parseNumber(appliedMapping.cpuUtilPct ? row[appliedMapping.cpuUtilPct] : undefined, 45))));
    const ramUtilPct = Math.min(100, Math.max(1, Math.round(parseNumber(appliedMapping.ramUtilPct ? row[appliedMapping.ramUtilPct] : undefined, 52))));
    const monthlyEgressGb = Math.max(0, Math.round(parseNumber(appliedMapping.monthlyEgressGb ? row[appliedMapping.monthlyEgressGb] : undefined, 250)));
    const cloudReadinessScore = Math.min(100, Math.max(1, Math.round(parseNumber(appliedMapping.cloudReadinessScore ? row[appliedMapping.cloudReadinessScore] : undefined, 55))));
    const businessValueScore = Math.min(100, Math.max(1, Math.round(parseNumber(appliedMapping.businessValueScore ? row[appliedMapping.businessValueScore] : undefined, 60))));

    workloads.push({
      id,
      name,
      domain: (appliedMapping.domain ? row[appliedMapping.domain] : '') || 'Core Enterprise',
      environment: normalizeEnvironment(
        appliedMapping.environment ? row[appliedMapping.environment] : undefined
      ),
      os,
      eolOs,
      complianceTier: normalizeCompliance(
        appliedMapping.complianceTier ? row[appliedMapping.complianceTier] : undefined
      ),
      criticality: normalizeCriticality(
        appliedMapping.criticality ? row[appliedMapping.criticality] : undefined
      ),
      vcpus,
      ramGb,
      storageTb,
      cpuUtilPct,
      ramUtilPct,
      monthlyEgressGb,
      dbCoupling: normalizeDbCoupling(
        appliedMapping.dbCoupling ? row[appliedMapping.dbCoupling] : undefined
      ),
      hasSaasEquivalent: parseBool(
        appliedMapping.hasSaasEquivalent ? row[appliedMapping.hasSaasEquivalent] : undefined,
        false
      ),
      cloudReadinessScore,
      businessValueScore,
      regulatoryResidencyLock: parseBool(
        appliedMapping.regulatoryResidencyLock
          ? row[appliedMapping.regulatoryResidencyLock]
          : undefined,
        false
      ),
      decommissionCandidate: parseBool(
        appliedMapping.decommissionCandidate
          ? row[appliedMapping.decommissionCandidate]
          : undefined,
        false
      ),
      monthlyOnPremCostUsd,
      dependencies,
      notes: appliedMapping.notes ? row[appliedMapping.notes] : undefined,
    });
  });

  // Check dangling dependencies across parsed workloads
  const finalIds = new Set(workloads.map((w) => w.id));
  for (const w of workloads) {
    for (const dep of w.dependencies) {
      if (!finalIds.has(dep)) {
        warnings.push(
          `Workload ${w.id} references unknown upstream dependency "${dep}" (will be flagged in DAG diagnostics).`
        );
      }
    }
  }

  return {
    workloads,
    detectedHeaders: headers,
    appliedMapping,
    rawRowCount: rawRows.length,
    warnings,
    errors,
    rawRows,
  };
}

export function workloadsToCsv(workloads: Workload[]): string {
  const headers = WORKLOAD_SCHEMA_SPECS.map((s) => s.field);
  const escape = (val: string) =>
    /[",\n\r]/.test(val) ? `"${val.replace(/"/g, '""')}"` : val;

  const lines = [headers.join(',')];
  for (const w of workloads) {
    const row = headers.map((field) => {
      if (field === 'dependencies') {
        return escape(w.dependencies.join('; '));
      }
      const val = w[field];
      return escape(val === undefined ? '' : String(val));
    });
    lines.push(row.join(','));
  }
  return lines.join('\n');
}

export async function buildTemplateXlsxBuffer(sampleWorkloads: Workload[]): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'StrataScale Assessment Workbench';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Workloads', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheet.columns = WORKLOAD_SCHEMA_SPECS.map((spec) => ({
    header: spec.field,
    key: spec.field,
    width: Math.max(16, spec.field.length + 4),
  }));

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F172A' },
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'left' };
  headerRow.height = 24;

  for (const w of sampleWorkloads) {
    sheet.addRow({
      ...w,
      dependencies: w.dependencies.join('; '),
    });
  }

  const schemaSheet = workbook.addWorksheet('Schema & Instructions');
  schemaSheet.columns = [
    { header: 'Column Key', key: 'field', width: 24 },
    { header: 'Label', key: 'label', width: 26 },
    { header: 'Required', key: 'required', width: 12 },
    { header: 'Type / Allowed Values', key: 'type', width: 34 },
    { header: 'Description', key: 'description', width: 46 },
    { header: 'Example', key: 'example', width: 24 },
  ];
  const schemaHeader = schemaSheet.getRow(1);
  schemaHeader.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  schemaHeader.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0369A1' },
  };
  for (const spec of WORKLOAD_SCHEMA_SPECS) {
    schemaSheet.addRow({
      field: spec.field,
      label: spec.label,
      required: spec.required ? 'Yes' : 'No',
      type: spec.type,
      description: spec.description,
      example: spec.example,
    });
  }

  const raw = await workbook.xlsx.writeBuffer();
  return new Uint8Array(raw);
}
