import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'StrataScale | Enterprise Cloud Migration & FinOps Assessment Workbench',
  description:
    'Architectural Cloud Ledger for multi-application 6R disposition, Tarjan/Kahn dependency wave sequencing, and 3-year FinOps & carbon-aware TCO modeling.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F8FAFC] text-[#0F172A] antialiased">
        {children}
      </body>
    </html>
  );
}
