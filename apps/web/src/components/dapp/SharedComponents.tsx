'use client';

import React, { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import { TerraQuraLogoFull } from '@/components/ui/TerraQuraLogo';
import {
  LayoutDashboard, Coins, Store, Radio, Shield,
  Wallet, ChevronDown, X, CheckCircle, AlertTriangle, Info,
  AlertCircle, ExternalLink, Copy, Menu,
  BarChart3, FileCheck, Award, Search, Check,
} from 'lucide-react';

// ─── Utility ──────────────────────────
function truncateAddress(addr: string) {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

// ─── CopyButton ──────────────────────
export function CopyButton({ text, className = '' }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className={`inline-flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition ${className}`}
      onClick={() => { copyToClipboard(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
    >
      {copied ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

// ─── GlassCard ──────────────────────
export function GlassCard({ children, className = '', ...props }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-2xl ${className}`} {...props}>
      {children}
    </div>
  );
}

// ─── StatusBadge ────────────────────
const STATUS_COLORS: Record<string, string> = {
  operational: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  verified: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  error: 'bg-red-500/10 text-red-400 border-red-500/20',
  paused: 'bg-red-500/10 text-red-400 border-red-500/20',
  retired: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  info: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
};

export function StatusBadge({ status, className = '' }: { status: string; className?: string }) {
  const color = STATUS_COLORS[status.toLowerCase()] || STATUS_COLORS.info;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-full border ${color} ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      {status}
    </span>
  );
}

// ─── LiveDot ────────────────────────
export function LiveDot({ color = 'emerald' }: { color?: 'emerald' | 'red' | 'amber' }) {
  const colors = { emerald: 'bg-emerald-400', red: 'bg-red-400', amber: 'bg-amber-400' };
  return (
    <span className="relative flex h-2 w-2">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${colors[color]} opacity-75`} />
      <span className={`relative inline-flex rounded-full h-2 w-2 ${colors[color]}`} />
    </span>
  );
}

// ─── MetricCard ─────────────────────
export function MetricCard({ label, value, unit, icon: Icon, trend, className = '' }: {
  label: string;
  value: string | number;
  unit?: string;
  icon?: React.ElementType;
  trend?: { value: number; label: string };
  className?: string;
}) {
  return (
    <GlassCard className={`p-5 ${className}`}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs text-white/40 uppercase tracking-wider font-medium">{label}</p>
          <p className="text-2xl font-bold text-white tabular-nums">
            {value}
            {unit && <span className="text-sm text-white/40 ml-1 font-normal">{unit}</span>}
          </p>
        </div>
        {Icon && (
          <div className="p-2 bg-emerald-500/10 rounded-xl">
            <Icon className="w-5 h-5 text-emerald-400" />
          </div>
        )}
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1.5">
          <span className={`text-xs font-medium ${trend.value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend.value >= 0 ? '+' : ''}{trend.value}%
          </span>
          <span className="text-xs text-white/30">{trend.label}</span>
        </div>
      )}
    </GlassCard>
  );
}

// ─── SectionHeader ──────────────────
export function SectionHeader({ title, description, badge, action }: {
  title: string;
  description?: string;
  badge?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          {badge}
        </div>
        {description && <p className="text-sm text-white/50 mt-1">{description}</p>}
      </div>
      {action}
    </div>
  );
}

// ─── Tabs ───────────────────────────
export function Tabs({ tabs, activeTab, onChange }: {
  tabs: { id: string; label: string; icon?: React.ElementType; count?: number }[];
  activeTab: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 p-1 bg-white/[0.03] rounded-xl border border-white/[0.06] overflow-x-auto">
      {tabs.map(tab => {
        const Icon = tab.icon;
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              isActive
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'text-white/50 hover:text-white/70 hover:bg-white/[0.03] border border-transparent'
            }`}
          >
            {Icon && <Icon className="w-4 h-4" />}
            {tab.label}
            {tab.count !== undefined && (
              <span className={`px-1.5 py-0.5 text-[10px] rounded-full ${isActive ? 'bg-emerald-500/20' : 'bg-white/10'}`}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── WalletButton ───────────────────
export function WalletButton() {
  const { wallet, addNotification, openConnectModal, disconnectWallet } = useApp();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  if (!wallet.connected) {
    return (
      <button
        onClick={openConnectModal}
        className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-sm font-medium hover:bg-emerald-500/20 transition-all"
      >
        <Wallet className="w-4 h-4" />
        Connect Wallet
      </button>
    );
  }

  if (wallet.isWrongNetwork) {
    return (
      <button className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-sm font-medium">
        <AlertTriangle className="w-4 h-4" />
        Wrong Network
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm hover:bg-white/[0.08] transition-all"
      >
        <div className="w-2 h-2 rounded-full bg-emerald-400" />
        <span className="text-white/80 font-mono text-xs">{truncateAddress(wallet.address)}</span>
        <span className="text-white/40 text-xs">{wallet.balance.toFixed(4)} AETH</span>
        <ChevronDown className="w-3 h-3 text-white/40" />
      </button>

      {dropdownOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-64 bg-midnight-900 border border-white/[0.08] rounded-xl shadow-2xl z-50 p-3 space-y-2">
            <div className="px-2 py-1">
              <p className="text-[10px] text-white/30 uppercase tracking-wider">Connected</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-white/70 font-mono">{truncateAddress(wallet.address)}</p>
                <CopyButton text={wallet.address} />
              </div>
            </div>
            <div className="px-2 py-1">
              <p className="text-[10px] text-white/30 uppercase tracking-wider">Balance</p>
              <p className="text-sm text-white font-medium mt-0.5">{wallet.balance.toFixed(6)} AETH</p>
            </div>
            <hr className="border-white/[0.06]" />
            <button
              onClick={() => { disconnectWallet(); setDropdownOpen(false); addNotification({ type: 'info', title: 'Wallet disconnected' }); }}
              className="w-full text-left px-2 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded-lg transition"
            >
              Disconnect
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Navigation Items ───────────────
const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/credits', label: 'Credits', icon: Coins },
  { href: '/dashboard/marketplace', label: 'Marketplace', icon: Store },
  { href: '/dashboard/oracle', label: 'Oracle', icon: Radio },
  { href: '/dashboard/governance', label: 'Governance', icon: Shield },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/compliance', label: 'Compliance', icon: FileCheck },
  { href: '/dashboard/retirement', label: 'Retirement', icon: Award },
];

// ─── TopNav ─────────────────────────
export function TopNav() {
  const pathname = usePathname();
  const { realTime } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-midnight-950/80 backdrop-blur-xl border-b border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="shrink-0">
            <TerraQuraLogoFull imageHeight={32} />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map(item => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'text-white/50 hover:text-white/70 hover:bg-white/[0.03]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Block height indicator */}
            {realTime.blockHeight > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-white/[0.03] rounded-lg">
                <LiveDot />
                <span className="text-[11px] text-white/40 font-mono">#{realTime.blockHeight.toLocaleString()}</span>
              </div>
            )}
            <WalletButton />

            {/* Mobile menu button */}
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 text-white/50 hover:text-white/70">
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <nav className="md:hidden py-3 border-t border-white/[0.06] space-y-1">
            {NAV_ITEMS.map(item => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${
                    isActive ? 'bg-emerald-500/10 text-emerald-400' : 'text-white/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </header>
  );
}

// ─── Footer ─────────────────────────
export function DAppFooter() {
  return (
    <footer className="border-t border-white/[0.06] py-6 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-xs text-white/30">
          TerraQura &middot; Powered by Aethelred Protocol &middot; Apache 2.0
        </p>
        <div className="flex items-center gap-4 text-xs text-white/30">
          <Link href="/terms" className="hover:text-white/50 transition">Terms</Link>
          <Link href="/privacy" className="hover:text-white/50 transition">Privacy</Link>
          <Link href="/developers" className="hover:text-white/50 transition">Developers</Link>
          <a href="https://explorer.aethelred.network" target="_blank" rel="noopener noreferrer" className="hover:text-white/50 transition flex items-center gap-1">
            Explorer <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </footer>
  );
}

// ─── Toast Container ────────────────
const TOAST_ICONS: Record<string, React.ElementType> = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const TOAST_COLORS: Record<string, string> = {
  success: 'border-emerald-500/30 bg-emerald-500/5',
  error: 'border-red-500/30 bg-red-500/5',
  warning: 'border-amber-500/30 bg-amber-500/5',
  info: 'border-cyan-500/30 bg-cyan-500/5',
};

const TOAST_ICON_COLORS: Record<string, string> = {
  success: 'text-emerald-400',
  error: 'text-red-400',
  warning: 'text-amber-400',
  info: 'text-cyan-400',
};

export function ToastContainer() {
  const { notifications, removeNotification } = useApp();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-[100] space-y-2 max-w-sm">
      {notifications.map(n => {
        const Icon = TOAST_ICONS[n.type] || Info;
        return (
          <div
            key={n.id}
            className={`flex items-start gap-3 p-4 rounded-xl border backdrop-blur-sm shadow-xl animate-in slide-in-from-right ${TOAST_COLORS[n.type]}`}
          >
            <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${TOAST_ICON_COLORS[n.type]}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">{n.title}</p>
              {n.message && <p className="text-xs text-white/50 mt-0.5">{n.message}</p>}
            </div>
            <button onClick={() => removeNotification(n.id)} className="text-white/30 hover:text-white/60">
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── EmptyState ─────────────────────
export function EmptyState({ icon: Icon, title, description, action }: {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="p-4 bg-white/[0.03] rounded-2xl mb-4">
        <Icon className="w-8 h-8 text-white/20" />
      </div>
      <h3 className="text-lg font-semibold text-white/60 mb-1">{title}</h3>
      <p className="text-sm text-white/30 max-w-md">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ─── Skeleton ─────────────────────
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-white/[0.06] rounded ${className}`} />
  );
}

// ─── ConnectWalletPrompt ─────────────────────
export function ConnectWalletPrompt({ message = 'Connect your wallet to access this feature' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="p-4 bg-white/[0.03] rounded-2xl mb-4">
        <svg className="w-8 h-8 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
        </svg>
      </div>
      <p className="text-sm text-white/40">{message}</p>
    </div>
  );
}

// ─── ProgressBar ───────────────────
export function ProgressBar({ value, color = 'emerald', size = 'md', className = '' }: {
  value: number;
  color?: 'emerald' | 'amber' | 'red' | 'cyan';
  size?: 'sm' | 'md';
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const colorMap = {
    emerald: 'bg-emerald-400',
    amber: 'bg-amber-400',
    red: 'bg-red-400',
    cyan: 'bg-cyan-400',
  };
  const heightMap = { sm: 'h-1.5', md: 'h-2.5' };
  return (
    <div className={`w-full bg-white/[0.06] rounded-full overflow-hidden ${heightMap[size]} ${className}`}>
      <div
        className={`${colorMap[color]} ${heightMap[size]} rounded-full transition-all duration-500`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

// ─── SparklineChart ────────────────
export function SparklineChart({ data, color = '#34d399', height = 32, className = '' }: {
  data: number[];
  color?: string;
  height?: number;
  className?: string;
}) {
  if (data.length === 0) return null;
  const max = Math.max(...data, 1);
  return (
    <div className={`flex items-end gap-px ${className}`} style={{ height }}>
      {data.map((val, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-sm min-w-[2px] transition-all"
          style={{
            height: `${(val / max) * 100}%`,
            backgroundColor: color,
            opacity: 0.5 + (val / max) * 0.5,
          }}
        />
      ))}
    </div>
  );
}

// ─── DataTable ─────────────────────
export function DataTable({ columns, data, onRowClick, className = '' }: {
  columns: { key: string; label: string; align?: 'left' | 'right' | 'center' }[];
  data: Record<string, unknown>[];
  onRowClick?: (row: Record<string, unknown>) => void;
  className?: string;
}) {
  const alignClass = (align?: string) => {
    if (align === 'right') return 'text-right';
    if (align === 'center') return 'text-center';
    return 'text-left';
  };

  const isMonoValue = (val: unknown) => {
    if (typeof val === 'number') return true;
    if (typeof val === 'string' && val.startsWith('0x')) return true;
    return false;
  };

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/[0.06]">
            {columns.map(col => (
              <th key={col.key} className={`px-4 py-3 text-[11px] text-white/40 uppercase tracking-wider font-medium ${alignClass(col.align)}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              onClick={() => onRowClick?.(row)}
              className={`border-b border-white/[0.03] transition-colors ${
                onRowClick ? 'cursor-pointer hover:bg-white/[0.03]' : ''
              }`}
            >
              {columns.map(col => {
                const val = row[col.key];
                return (
                  <td
                    key={col.key}
                    className={`px-4 py-3 text-sm text-white/70 ${alignClass(col.align)} ${
                      isMonoValue(val) ? 'font-mono' : ''
                    }`}
                  >
                    {val === null || val === undefined ? '—' : String(val)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── ExpandableCard ────────────────
export function ExpandableCard({ header, children, defaultOpen = false, className = '' }: {
  header: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <GlassCard className={`overflow-hidden ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-white/[0.02] transition"
      >
        <div className="flex-1">{header}</div>
        <ChevronDown className={`w-4 h-4 text-white/40 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="px-5 pb-5 border-t border-white/[0.06] pt-4">
          {children}
        </div>
      )}
    </GlassCard>
  );
}

// ─── StepWizard ────────────────────
export function StepWizard({ steps, currentStep, className = '' }: {
  steps: string[];
  currentStep: number;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-0 ${className}`}>
      {steps.map((label, idx) => {
        const isCompleted = idx < currentStep;
        const isActive = idx === currentStep;
        const isFuture = idx > currentStep;
        return (
          <div key={idx} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-all ${
                  isCompleted
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                    : isActive
                    ? 'bg-emerald-500/10 border-emerald-400 text-emerald-400'
                    : 'bg-white/[0.05] border-white/[0.1] text-white/30'
                }`}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : idx + 1}
              </div>
              <span className={`text-[10px] mt-1.5 whitespace-nowrap ${
                isActive ? 'text-emerald-400 font-medium' : isFuture ? 'text-white/30' : 'text-white/50'
              }`}>
                {label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`w-12 h-0.5 mx-1 mt-[-14px] ${
                isCompleted ? 'bg-emerald-500/40' : 'bg-white/[0.1]'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── FilterBar ─────────────────────
export function FilterBar({ children, className = '' }: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-3 p-3 bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-xl ${className}`}>
      {children}
    </div>
  );
}

// ─── RangeFilter ───────────────────
export function RangeFilter({ label, min, max, value, onChange }: {
  label: string;
  min: number;
  max: number;
  value: [number, number];
  onChange: (val: [number, number]) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-white/40 whitespace-nowrap">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value[0]}
        onChange={(e) => onChange([Number(e.target.value), value[1]])}
        className="w-20 px-2 py-1.5 bg-white/[0.05] border border-white/[0.08] rounded-lg text-xs text-white/70 font-mono focus:outline-none focus:border-emerald-500/30"
      />
      <span className="text-xs text-white/30">to</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value[1]}
        onChange={(e) => onChange([value[0], Number(e.target.value)])}
        className="w-20 px-2 py-1.5 bg-white/[0.05] border border-white/[0.08] rounded-lg text-xs text-white/70 font-mono focus:outline-none focus:border-emerald-500/30"
      />
    </div>
  );
}

// ─── SelectFilter ──────────────────
export function SelectFilter({ label, options, value, onChange }: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-white/40 whitespace-nowrap">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-2 py-1.5 bg-white/[0.05] border border-white/[0.08] rounded-lg text-xs text-white/70 focus:outline-none focus:border-emerald-500/30 appearance-none cursor-pointer"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value} className="bg-midnight-900 text-white">
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── SearchInput ───────────────────
export function SearchInput({ placeholder, value, onChange, className = '' }: {
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-9 pr-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white/70 placeholder-white/30 focus:outline-none focus:border-emerald-500/30 transition"
      />
    </div>
  );
}

// ─── CertificateCard ───────────────
export function CertificateCard({ tokenId, co2Amount, retiredAt, beneficiary, reason, dacUnit, txHash, vintage }: {
  tokenId: number;
  co2Amount: number;
  retiredAt: string;
  beneficiary: string;
  reason: string;
  dacUnit: string;
  txHash: string;
  vintage: number;
}) {
  return (
    <div className="relative bg-gradient-to-br from-emerald-500/[0.04] to-white/[0.02] border-2 border-emerald-500/20 rounded-2xl p-6 overflow-hidden">
      {/* Watermark */}
      <div className="absolute top-4 right-4 text-emerald-500/[0.07] text-6xl font-black select-none pointer-events-none">
        TQ
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 bg-emerald-500/10 rounded-xl">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">Carbon Retirement Certificate</h3>
          <p className="text-[10px] text-white/30 uppercase tracking-wider">TerraQura Verified</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between">
          <span className="text-xs text-white/40">Token ID</span>
          <span className="text-xs text-white/70 font-mono">#{tokenId}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-xs text-white/40">CO2 Retired</span>
          <span className="text-sm font-bold text-emerald-400">{co2Amount.toFixed(2)} kg</span>
        </div>
        <div className="flex justify-between">
          <span className="text-xs text-white/40">Retired At</span>
          <span className="text-xs text-white/70">{retiredAt}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-xs text-white/40">Beneficiary</span>
          <span className="text-xs text-white/70">{beneficiary}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-xs text-white/40">Reason</span>
          <span className="text-xs text-white/70">{reason}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-xs text-white/40">DAC Unit</span>
          <span className="text-xs text-white/70 font-mono">{dacUnit}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-xs text-white/40">Vintage</span>
          <span className="text-xs text-white/70">{vintage}</span>
        </div>

        <hr className="border-white/[0.06]" />

        <div className="flex items-center justify-between">
          <span className="text-[10px] text-white/30 font-mono">{truncateAddress(txHash)}</span>
          <CopyButton text={txHash} />
        </div>
      </div>
    </div>
  );
}

// ─── Countdown ─────────────────────
export function Countdown({ targetTimestamp, className = '' }: {
  targetTimestamp: number;
  className?: string;
}) {
  // Fixed "now" to avoid hydration mismatch — never uses live time
  const FIXED_NOW = 1710700000000;
  const diff = Math.max(0, targetTimestamp - FIXED_NOW);
  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (diff === 0) {
    return <span className={`text-xs text-emerald-400 font-medium ${className}`}>Expired</span>;
  }

  return (
    <span className={`text-xs text-white/70 font-mono tabular-nums ${className}`}>
      {days}d {hours}h {minutes}m
    </span>
  );
}

// ─── HeatmapGrid ───────────────────
export function HeatmapGrid({ data, maxValue, columns, colorScale = 'green' }: {
  data: { value: number; label?: string }[];
  maxValue: number;
  columns: number;
  colorScale?: 'green' | 'red' | 'blue';
}) {
  const scaleColors = {
    green: (intensity: number) => `rgba(52, 211, 153, ${0.05 + intensity * 0.85})`,
    red: (intensity: number) => `rgba(248, 113, 113, ${0.05 + intensity * 0.85})`,
    blue: (intensity: number) => `rgba(96, 165, 250, ${0.05 + intensity * 0.85})`,
  };

  const getColor = scaleColors[colorScale];

  return (
    <div
      className="grid gap-1"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {data.map((cell, idx) => {
        const intensity = maxValue > 0 ? Math.min(1, cell.value / maxValue) : 0;
        return (
          <div
            key={idx}
            className="aspect-square rounded-sm transition-colors"
            style={{ backgroundColor: getColor(intensity) }}
            title={cell.label ? `${cell.label}: ${cell.value}` : String(cell.value)}
          />
        );
      })}
    </div>
  );
}

// Re-export navigation items for sidebar
export { NAV_ITEMS };
