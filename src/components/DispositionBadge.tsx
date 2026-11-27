import type { Disposition6R, RiskLevel } from '@/types/stratascale';

const DISPOSITION_STYLES: Record<Disposition6R, string> = {
  Rehost: 'border-[#047857]/30 bg-[#ECFDF5] text-[#047857]',
  Retire: 'border-[#047857]/30 bg-[#ECFDF5] text-[#047857]',
  Replatform: 'border-[#0369A1]/30 bg-[#F0F9FF] text-[#0369A1]',
  Refactor: 'border-[#B45309]/30 bg-[#FFFBEB] text-[#B45309]',
  Repurchase: 'border-[#CBD5E1] bg-[#EEF2F6] text-[#0F172A]',
  Retain: 'border-[#CBD5E1] bg-[#F8FAFC] text-[#475569]',
};

const RISK_STYLES: Record<RiskLevel, string> = {
  Low: 'border-[#CBD5E1] bg-[#F8FAFC] text-[#475569]',
  Medium: 'border-[#B45309]/30 bg-[#FFFBEB] text-[#B45309]',
  High: 'border-[#DC2626]/30 bg-[#FEF2F2] text-[#DC2626]',
};

export function DispositionBadge({ disposition }: { disposition: Disposition6R }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold tracking-tight ${DISPOSITION_STYLES[disposition]}`}
    >
      {disposition}
    </span>
  );
}

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium ${RISK_STYLES[risk]}`}
    >
      {risk}
    </span>
  );
}
