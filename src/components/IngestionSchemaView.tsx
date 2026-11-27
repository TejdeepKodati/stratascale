'use client';

import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
} from 'lucide-react';
import { WORKLOAD_SCHEMA_SPECS, workloadsToCsv } from '@/lib/ingestion';
import type {
  CanonicalWorkloadField,
  ColumnMapping,
  IngestionResult,
  Workload,
} from '@/types/stratascale';

interface IngestionSchemaViewProps {
  activeWorkloads: Workload[];
  activePortfolioName: string;
  onApplyCustomPortfolio: (name: string, workloads: Workload[]) => void;
}

const SAMPLE_CUSTOM_CSV = `App Code,Service Name,Business Unit,OS Release,Is EOL,Compliance,Cores,Memory GB,Disk TB,CPU %,DB Coupling,Monthly Spend ($),Depends On
CST-01,Core Auth Gateway,Security,Ubuntu 22.04 LTS,false,ISO-27001,16,64,1.2,52,Loose,9200,
CST-02,Legacy Claims Batch,Claims,Windows Server 2012 R2,true,HIPAA,24,96,8.0,28,Tight,18400,CST-01
CST-03,Patient Intake API,Digital,Ubuntu 22.04 LTS,false,HIPAA,20,80,2.5,71,None,12600,CST-01; CST-02
CST-04,Vendor Timesheet App,Back-Office,Windows Server 2016,false,Standard,8,32,1.0,16,Loose,6800,CST-01
CST-05,Deprecated Fax Bridge,Legacy,CentOS 7.9,true,Standard,4,16,0.5,6,None,4100,CST-02`;

export function IngestionSchemaView({
  activeWorkloads,
  activePortfolioName,
  onApplyCustomPortfolio,
}: IngestionSchemaViewProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [sourceLabel, setSourceLabel] = useState<string>('Custom Uploaded Portfolio');
  const [csvDraft, setCsvDraft] = useState<string>('');
  const [pendingResult, setPendingResult] = useState<IngestionResult | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [appliedBanner, setAppliedBanner] = useState<string | null>(null);

  async function ingestFile(file: File, customMapping?: ColumnMapping) {
    setLoading(true);
    setUploadError(null);
    setAppliedBanner(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (customMapping) {
        formData.append('mapping', JSON.stringify(customMapping));
      }
      const res = await fetch('/api/ingest', {
        method: 'POST',
        body: formData,
      });
      const json = (await res.json()) as IngestionResult & { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? 'Failed to ingest uploaded file.');
      }
      setSourceLabel(file.name.replace(/\.(csv|xlsx|xlsm)$/i, ''));
      setPendingResult(json);
      setMapping(json.appliedMapping);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setLoading(false);
    }
  }

  async function ingestCsvText(text: string, label: string, customMapping?: ColumnMapping) {
    if (!text.trim()) return;
    setLoading(true);
    setUploadError(null);
    setAppliedBanner(null);
    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText: text, mapping: customMapping }),
      });
      const json = (await res.json()) as IngestionResult & { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? 'Failed to parse CSV payload.');
      }
      setSourceLabel(label);
      setPendingResult(json);
      setMapping(json.appliedMapping);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'CSV parsing failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRemapChange(field: CanonicalWorkloadField, headerValue: string) {
    const nextMapping: ColumnMapping = { ...mapping };
    if (!headerValue) {
      delete nextMapping[field];
    } else {
      nextMapping[field] = headerValue;
    }
    setMapping(nextMapping);

    if (pendingResult?.rawRows && pendingResult.detectedHeaders.length > 0) {
      setLoading(true);
      try {
        const res = await fetch('/api/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            headers: pendingResult.detectedHeaders,
            rawRows: pendingResult.rawRows,
            mapping: nextMapping,
          }),
        });
        const json = (await res.json()) as IngestionResult;
        if (res.ok) {
          setPendingResult(json);
        }
      } finally {
        setLoading(false);
      }
    }
  }

  function handleDownloadActiveCsv() {
    const csv = workloadsToCsv(activeWorkloads);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activePortfolioName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handleApplyToWorkbench() {
    if (!pendingResult || pendingResult.workloads.length === 0) return;
    onApplyCustomPortfolio(sourceLabel || 'Custom Portfolio', pendingResult.workloads);
    setAppliedBanner(
      `Loaded ${pendingResult.workloads.length} workloads from "${sourceLabel}" into active assessment workbench.`
    );
  }

  return (
    <div className="space-y-4">
      {/* Template Download & File Upload Section */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <section className="rounded-md border border-[#CBD5E1] bg-[#FFFFFF] p-4 lg:col-span-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] pb-3">
            <div>
              <h2 className="text-sm font-bold text-[#0F172A]">
                Portfolio File Ingestion (.CSV / .XLSX)
              </h2>
              <p className="text-xs text-[#475569]">
                Upload enterprise CMDB exports or fill in the StrataScale Excel template.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href="/api/ingest?template=xlsx"
                download="stratascale-portfolio-template.xlsx"
                className="inline-flex items-center gap-1.5 rounded border border-[#0369A1] bg-[#F0F9FF] px-2.5 py-1.5 text-xs font-semibold text-[#0369A1] hover:bg-[#E0F2FE]"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Download Template .xlsx
              </a>
              <button
                type="button"
                onClick={handleDownloadActiveCsv}
                className="inline-flex items-center gap-1.5 rounded border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-1.5 text-xs font-medium text-[#475569] hover:text-[#0F172A]"
              >
                <Download className="h-3.5 w-3.5" />
                Export Active .csv
              </button>
            </div>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) void ingestFile(file);
            }}
            className={`mt-4 flex flex-col items-center justify-center rounded border-2 border-dashed px-4 py-8 text-center transition-colors ${
              dragOver
                ? 'border-[#0369A1] bg-[#F0F9FF]'
                : 'border-[#CBD5E1] bg-[#F8FAFC]'
            }`}
          >
            <Upload className="h-6 w-6 text-[#0369A1]" />
            <p className="mt-2 text-xs font-semibold text-[#0F172A]">
              Drop a <span className="tabular-mono">.csv</span> or{' '}
              <span className="tabular-mono">.xlsx</span> inventory workbook here
            </p>
            <p className="mt-1 text-[11px] text-[#475569]">
              Automatically detects common column aliases and validates schema constraints
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xlsm"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void ingestFile(file);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              disabled={loading}
              onClick={() => fileInputRef.current?.click()}
              className="mt-3 rounded border border-[#0369A1] bg-[#0369A1] px-3.5 py-1.5 text-xs font-semibold text-[#FFFFFF] hover:bg-[#025582] disabled:opacity-60"
            >
              {loading ? 'Parsing Workbook...' : 'Select .csv or .xlsx File'}
            </button>
          </div>

          {uploadError && (
            <div className="mt-3 flex items-start gap-2 rounded border border-[#DC2626]/40 bg-[#FEF2F2] p-2.5 text-xs text-[#DC2626]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}
        </section>

        {/* Direct CSV Paste & Alias Mapper Test */}
        <section className="rounded-md border border-[#CBD5E1] bg-[#FFFFFF] p-4 lg:col-span-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] pb-3">
            <div>
              <h2 className="text-sm font-bold text-[#0F172A]">
                Quick CSV Stream &amp; Header Alias Tester
              </h2>
              <p className="text-xs text-[#475569]">
                Paste CSV rows with custom column headers to verify schema mapping.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setCsvDraft(SAMPLE_CUSTOM_CSV);
                void ingestCsvText(SAMPLE_CUSTOM_CSV, 'Healthcare Claims Sample');
              }}
              className="rounded border border-[#CBD5E1] bg-[#F8FAFC] px-2.5 py-1 text-xs font-medium text-[#0369A1] hover:border-[#0369A1]"
            >
              Load Sample Custom-Header CSV
            </button>
          </div>

          <textarea
            value={csvDraft}
            onChange={(e) => setCsvDraft(e.target.value)}
            rows={7}
            placeholder="Paste CSV headers and workload rows here..."
            aria-label="Paste CSV content"
            className="tabular-mono mt-3 w-full rounded border border-[#CBD5E1] bg-[#F8FAFC] p-2.5 text-[11px] text-[#0F172A] focus:border-[#0369A1] focus:bg-[#FFFFFF] focus:outline-none"
          />

          <div className="mt-2.5 flex items-center justify-between">
            <span className="text-[11px] text-[#475569]">
              Supports comma, semicolon, or pipe-delimited dependency lists.
            </span>
            <button
              type="button"
              disabled={loading || !csvDraft.trim()}
              onClick={() => void ingestCsvText(csvDraft, 'Pasted CSV Portfolio')}
              className="rounded border border-[#0F172A] bg-[#0F172A] px-3 py-1.5 text-xs font-semibold text-[#FFFFFF] hover:bg-[#1E293B] disabled:opacity-50"
            >
              Parse &amp; Validate CSV
            </button>
          </div>
        </section>
      </div>

      {appliedBanner && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-md border border-[#047857]/40 bg-[#ECFDF5] px-4 py-2.5 text-xs font-semibold text-[#047857]"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{appliedBanner}</span>
        </div>
      )}

      {/* Column Mapping & Validation Diagnostics */}
      {pendingResult && (
        <section className="overflow-hidden rounded-md border border-[#CBD5E1] bg-[#FFFFFF]">
          <div className="flex flex-col gap-2 border-b border-[#E2E8F0] bg-[#EEF2F6] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
                Schema Validation &amp; Column Mapping ({sourceLabel})
              </h3>
              <p className="text-[11px] text-[#475569]">
                Detected{' '}
                <strong className="tabular-mono text-[#0F172A]">
                  {pendingResult.detectedHeaders.length}
                </strong>{' '}
                source columns and validated{' '}
                <strong className="tabular-mono text-[#047857]">
                  {pendingResult.workloads.length}
                </strong>{' '}
                of{' '}
                <strong className="tabular-mono text-[#0F172A]">
                  {pendingResult.rawRowCount}
                </strong>{' '}
                rows.
              </p>
            </div>

            <button
              type="button"
              disabled={pendingResult.workloads.length === 0 || pendingResult.errors.length > 0}
              onClick={handleApplyToWorkbench}
              className="rounded border border-[#047857] bg-[#047857] px-3.5 py-1.5 text-xs font-semibold text-[#FFFFFF] hover:bg-[#065F46] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Apply &amp; Recompute Portfolio ({pendingResult.workloads.length} apps)
            </button>
          </div>

          <div className="grid grid-cols-1 divide-y divide-[#E2E8F0] lg:grid-cols-12 lg:divide-x lg:divide-y-0">
            <div className="p-4 lg:col-span-7">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#475569]">
                Interactive Column Mapping Overrides
              </div>
              <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {WORKLOAD_SCHEMA_SPECS.slice(0, 14).map((spec) => (
                  <label
                    key={spec.field}
                    className="flex items-center justify-between gap-2 rounded border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1.5 text-xs"
                  >
                    <span className="truncate font-medium text-[#0F172A]">
                      {spec.label}
                      {spec.required && <span className="text-[#DC2626]"> *</span>}
                    </span>
                    <select
                      value={mapping[spec.field] ?? ''}
                      onChange={(e) => void handleRemapChange(spec.field, e.target.value)}
                      aria-label={`Map column for ${spec.label}`}
                      className="max-w-[150px] rounded border border-[#CBD5E1] bg-[#FFFFFF] px-1.5 py-1 text-[11px] text-[#0F172A] focus:border-[#0369A1] focus:outline-none"
                    >
                      <option value="">(Default)</option>
                      {pendingResult.detectedHeaders.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2.5 p-4 lg:col-span-5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#475569]">
                Validation Log
              </div>
              {pendingResult.errors.length === 0 && pendingResult.warnings.length === 0 ? (
                <div className="flex items-center gap-2 rounded border border-[#047857]/30 bg-[#ECFDF5] p-3 text-xs text-[#047857]">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Zero schema errors or warnings. Ready for immediate recomputation.</span>
                </div>
              ) : (
                <div className="max-h-56 space-y-1.5 overflow-y-auto text-xs">
                  {pendingResult.errors.map((err, i) => (
                    <div
                      key={`err-${i}`}
                      className="flex items-start gap-2 rounded border border-[#DC2626]/30 bg-[#FEF2F2] p-2 text-[#DC2626]"
                    >
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{err}</span>
                    </div>
                  ))}
                  {pendingResult.warnings.map((warn, i) => (
                    <div
                      key={`warn-${i}`}
                      className="flex items-start gap-2 rounded border border-[#B45309]/30 bg-[#FFFBEB] p-2 text-[#B45309]"
                    >
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{warn}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Canonical Schema Reference Table */}
      <section className="overflow-hidden rounded-md border border-[#CBD5E1] bg-[#FFFFFF]">
        <div className="border-b border-[#E2E8F0] bg-[#EEF2F6] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#0F172A]">
          StrataScale Canonical Ingestion Schema ({WORKLOAD_SCHEMA_SPECS.length} Fields)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#CBD5E1] bg-[#F8FAFC] text-[11px] font-semibold uppercase tracking-wide text-[#475569]">
                <th className="px-3 py-2">Field Key</th>
                <th className="px-3 py-2">Label</th>
                <th className="px-3 py-2">Required</th>
                <th className="px-3 py-2">Type / Domain</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Example</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {WORKLOAD_SCHEMA_SPECS.map((spec) => (
                <tr key={spec.field} className="hover:bg-[#F8FAFC]">
                  <td className="tabular-mono px-3 py-2 font-semibold text-[#0369A1]">
                    {spec.field}
                  </td>
                  <td className="px-3 py-2 font-medium text-[#0F172A]">{spec.label}</td>
                  <td className="px-3 py-2">
                    {spec.required ? (
                      <span className="rounded border border-[#DC2626]/30 bg-[#FEF2F2] px-1.5 py-0.5 text-[10px] font-semibold text-[#DC2626]">
                        Required
                      </span>
                    ) : (
                      <span className="text-[#475569]">Optional</span>
                    )}
                  </td>
                  <td className="tabular-mono px-3 py-2 text-[11px] text-[#475569]">
                    {spec.type}
                  </td>
                  <td className="px-3 py-2 text-[#475569]">{spec.description}</td>
                  <td className="tabular-mono px-3 py-2 text-[11px] text-[#0F172A]">
                    {spec.example}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
