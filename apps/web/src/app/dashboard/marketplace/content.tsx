'use client';

import { useState, useCallback, useMemo } from 'react';
import { formatEther } from 'viem';
import { useApp } from '@/contexts/AppContext';
import { Package, BarChart3, Handshake, Zap, Eye, Search, ArrowUpDown, Download, TrendingUp, TrendingDown, Bell } from 'lucide-react';
import {
  usePlatformStats,
  useWatchMarketplaceSales,
  type ContractEventLog,
} from '@/hooks/useContractData';
import { CONTRACTS } from '@/lib/contracts';
import {
  TopNav,
  DAppFooter,
  ToastContainer,
  GlassCard,
  MetricCard,
  StatusBadge,
  SectionHeader,
  Tabs,
  EmptyState,
  LiveDot,
  ConnectWalletPrompt,
} from '@/components/dapp/SharedComponents';

// ============================================
// Deterministic seeded random
// ============================================

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

function seededInt(seed: number, min: number, max: number): number {
  return Math.floor(seededRandom(seed) * (max - min + 1)) + min;
}

function seededChoice<T>(seed: number, arr: T[]): T {
  return arr[seededInt(seed, 0, arr.length - 1)]!;
}

function seededFloat(seed: number, min: number, max: number, decimals: number = 2): number {
  const val = seededRandom(seed) * (max - min) + min;
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

// ============================================
// Mock addresses
// ============================================

const SELLER_ADDRESSES = [
  '0x7F6A87fE3191FFBFa06D37939F3a3a4341159ABc',
  '0x3A5bD2c78e9E2a9fBc88D5e7D8e4a1f9C6b7D3E2',
  '0x9B2c4D6e8F0a1B3c5D7e9F0A2B4c6D8e0F1A3B5',
  '0x1A2B3c4D5e6F7a8B9c0D1e2F3a4B5c6D7e8F9A0B',
  '0xC4D6e8F0a1B3c5D7e9F0A2B4c6D8e0F1A3B5C7D9',
  '0xE8F0a1B3c5D7e9F0A2B4c6D8e0F1A3B5C7D9E1F3',
  '0xF1A2B3C4D5E6F7a8b9c0D1E2F3A4B5C6D7E8F9a0',
  '0xA9B8C7D6E5F4a3b2c1D0E9F8A7B6C5D4E3F2a1b0',
];

const BUYER_ADDRESSES = [
  '0xA1B2C3D4e5F6a7B8c9D0e1F2a3B4C5D6e7F8a9B0',
  '0xB2C3D4e5F6a7B8c9D0e1F2a3B4C5D6e7F8a9B0C1',
  '0xC3D4e5F6a7B8c9D0e1F2a3B4C5D6e7F8a9B0C1D2',
  '0xD4e5F6a7B8c9D0e1F2a3B4C5D6e7F8a9B0C1D2E3',
  '0xe5F6a7B8c9D0e1F2a3B4C5D6e7F8a9B0C1D2E3F4',
  '0xF6a7B8c9D0e1F2a3B4C5D6e7F8a9B0C1D2E3F4a5',
  '0xa7B8c9D0e1F2a3B4C5D6e7F8a9B0C1D2E3F4a5B6',
  '0xb8c9D0e1F2a3B4C5D6e7F8a9B0C1D2E3F4a5B6C7',
];

// ============================================
// Interfaces
// ============================================

interface MockListing {
  listingId: number;
  tokenId: number;
  seller: string;
  co2AmountKg: number;
  pricePerUnit: bigint;
  amount: number;
  isActive: boolean;
  createdAt: number;
  purityPercentage: number;
  sourceVerified: boolean;
  logicVerified: boolean;
  mintVerified: boolean;
  reputationScore: number;
  timeSinceListed: number; // hours
  viewCount: number;
  status: 'active' | 'expired' | 'sold';
}

interface MockTradeEvent {
  id: number;
  type: 'purchase' | 'sale';
  buyer: string;
  seller: string;
  tokenId: number;
  amount: number;
  totalPrice: bigint;
  timestamp: number;
  txHash: string;
  co2AmountKg: number;
}

interface MockOffer {
  offerId: number;
  listingId: number;
  tokenId: number;
  offerer: string;
  pricePerUnit: bigint;
  quantity: number;
  expiresAt: number;
  status: 'Pending' | 'Accepted' | 'Rejected' | 'Expired' | 'Countered';
  counterPrice?: bigint;
  createdAt: number;
}

interface MockWatchlistItem {
  tokenId: number;
  seller: string;
  lastPrice: bigint;
  alertAbove: bigint;
  alertBelow: bigint;
  priceChange: number; // percentage
  addedAt: number;
  co2AmountKg: number;
  purity: number;
}

interface MockPortfolioToken {
  tokenId: number;
  balance: number;
  co2AmountKg: number;
  purity: number;
  dacUnitId: string;
}

// ============================================
// Generate 15 mock listings
// ============================================

const MOCK_LISTINGS: MockListing[] = Array.from({ length: 15 }, (_, i) => {
  const seed = i * 137 + 42;
  const tokenIds = [1, 2, 5, 8, 13, 21, 34, 42, 55, 67, 78, 89, 96, 103, 117];
  const co2Amounts = [1250, 980, 750, 1800, 3200, 2400, 560, 4100, 890, 1600, 2100, 1350, 680, 5200, 920];
  const prices = [45, 38, 32, 52, 65, 55, 28, 72, 35, 48, 42, 39, 26, 85, 31];
  const amounts = [10, 5, 20, 3, 25, 15, 8, 30, 12, 7, 18, 9, 22, 2, 14];
  const purities = [97, 95, 93, 96, 98, 97, 91, 99, 94, 96, 95, 92, 90, 99, 93];
  const seller = SELLER_ADDRESSES[seededInt(seed + 1, 0, SELLER_ADDRESSES.length - 1)]!;
  const srcVerified = seededRandom(seed + 2) > 0.1;
  const logVerified = seededRandom(seed + 3) > 0.2;
  const mntVerified = seededRandom(seed + 4) > 0.25;

  return {
    listingId: i + 1,
    tokenId: tokenIds[i]!,
    seller,
    co2AmountKg: co2Amounts[i]!,
    pricePerUnit: BigInt(prices[i]!) * 1000000000000000n, // prices in finney
    amount: amounts[i]!,
    isActive: true,
    createdAt: 1770000000 + i * 43200,
    purityPercentage: purities[i]!,
    sourceVerified: srcVerified,
    logicVerified: logVerified,
    mintVerified: mntVerified,
    reputationScore: seededInt(seed + 5, 72, 99),
    timeSinceListed: seededInt(seed + 6, 1, 720),
    viewCount: seededInt(seed + 7, 5, 340),
    status: 'active' as const,
  };
});

// ============================================
// Generate 25 mock trades
// ============================================

const MOCK_TRADES: MockTradeEvent[] = Array.from({ length: 25 }, (_, i) => {
  const seed = i * 251 + 73;
  const tradeTypes: Array<'purchase' | 'sale'> = ['purchase', 'sale'];
  const tokenId = seededInt(seed, 1, 120);
  const amount = seededInt(seed + 1, 1, 15);
  const pricePerUnit = seededInt(seed + 2, 25, 90);
  const totalPrice = BigInt(pricePerUnit) * BigInt(amount) * 1000000000000000n;
  const hexChars = '0123456789abcdef';
  let txHash = '0x';
  for (let j = 0; j < 64; j++) {
    txHash += hexChars[seededInt(seed + j + 100, 0, 15)]!;
  }

  return {
    id: i + 1,
    type: seededChoice(seed + 3, tradeTypes),
    buyer: BUYER_ADDRESSES[seededInt(seed + 4, 0, BUYER_ADDRESSES.length - 1)]!,
    seller: SELLER_ADDRESSES[seededInt(seed + 5, 0, SELLER_ADDRESSES.length - 1)]!,
    tokenId,
    amount,
    totalPrice,
    timestamp: 1770400000 - i * 14400,
    txHash,
    co2AmountKg: seededInt(seed + 6, 200, 5000),
  };
});

// ============================================
// Generate 5 mock offers
// ============================================

const MOCK_OFFERS: MockOffer[] = Array.from({ length: 5 }, (_, i) => {
  const seed = i * 317 + 59;
  const statuses: MockOffer['status'][] = ['Pending', 'Accepted', 'Rejected', 'Expired', 'Countered'];
  const listing = MOCK_LISTINGS[seededInt(seed, 0, MOCK_LISTINGS.length - 1)]!;
  const priceDelta = seededFloat(seed + 1, -0.02, 0.01, 4);
  const basePrice = Number(listing.pricePerUnit) / 1e18;
  const offerPrice = Math.max(0.01, basePrice + priceDelta);
  const status = statuses[i]!;

  return {
    offerId: i + 1,
    listingId: listing.listingId,
    tokenId: listing.tokenId,
    offerer: BUYER_ADDRESSES[seededInt(seed + 2, 0, BUYER_ADDRESSES.length - 1)]!,
    pricePerUnit: BigInt(Math.round(offerPrice * 1e18)),
    quantity: seededInt(seed + 3, 1, Math.min(listing.amount, 10)),
    expiresAt: 1770500000 + seededInt(seed + 4, 86400, 604800),
    status,
    counterPrice: status === 'Countered' ? BigInt(Math.round((offerPrice + 0.005) * 1e18)) : undefined,
    createdAt: 1770400000 - seededInt(seed + 5, 3600, 172800),
  };
});

// ============================================
// Generate 5 mock watchlist items
// ============================================

const MOCK_WATCHLIST: MockWatchlistItem[] = Array.from({ length: 5 }, (_, i) => {
  const seed = i * 443 + 31;
  const tokenIds = [1, 13, 42, 67, 103];
  const prices = [45, 65, 72, 48, 85];
  return {
    tokenId: tokenIds[i]!,
    seller: SELLER_ADDRESSES[seededInt(seed, 0, SELLER_ADDRESSES.length - 1)]!,
    lastPrice: BigInt(prices[i]!) * 1000000000000000n,
    alertAbove: BigInt(prices[i]! + seededInt(seed + 1, 5, 15)) * 1000000000000000n,
    alertBelow: BigInt(Math.max(10, prices[i]! - seededInt(seed + 2, 5, 15))) * 1000000000000000n,
    priceChange: seededFloat(seed + 3, -8, 12, 2),
    addedAt: 1770300000 + seededInt(seed + 4, 0, 86400),
    co2AmountKg: seededInt(seed + 5, 500, 5000),
    purity: seededInt(seed + 6, 90, 99),
  };
});

// ============================================
// Mock portfolio tokens for listing wizard
// ============================================

const MOCK_PORTFOLIO: MockPortfolioToken[] = [
  { tokenId: 201, balance: 50, co2AmountKg: 2500, purity: 97, dacUnitId: 'DAC-EU-001' },
  { tokenId: 202, balance: 25, co2AmountKg: 1200, purity: 95, dacUnitId: 'DAC-US-012' },
  { tokenId: 203, balance: 100, co2AmountKg: 4800, purity: 99, dacUnitId: 'DAC-AS-007' },
  { tokenId: 204, balance: 12, co2AmountKg: 680, purity: 91, dacUnitId: 'DAC-EU-003' },
  { tokenId: 205, balance: 35, co2AmountKg: 1750, purity: 94, dacUnitId: 'DAC-AF-002' },
];

// ============================================
// Analytics mock data (30 days)
// ============================================

const ANALYTICS_PRICE_HISTORY = Array.from({ length: 30 }, (_, i) => {
  const seed = i * 197 + 11;
  return {
    day: i + 1,
    avgPrice: seededFloat(seed, 0.030, 0.070, 4),
    volume: seededInt(seed + 1, 50, 800),
    trades: seededInt(seed + 2, 3, 45),
  };
});

const ANALYTICS_TOP_BUYERS = Array.from({ length: 5 }, (_, i) => {
  const seed = i * 293 + 17;
  return {
    address: BUYER_ADDRESSES[i]!,
    totalVolume: seededFloat(seed, 2.0, 25.0, 3),
    trades: seededInt(seed + 1, 5, 60),
    co2Acquired: seededInt(seed + 2, 5000, 80000),
  };
});

const ANALYTICS_TOP_SELLERS = Array.from({ length: 5 }, (_, i) => {
  const seed = i * 349 + 23;
  return {
    address: SELLER_ADDRESSES[i]!,
    totalVolume: seededFloat(seed, 3.0, 30.0, 3),
    trades: seededInt(seed + 1, 8, 70),
    co2Sold: seededInt(seed + 2, 8000, 100000),
  };
});

// Market depth: count of listings at each price bracket
const MARKET_DEPTH = Array.from({ length: 10 }, (_, i) => {
  const seed = i * 131 + 7;
  const price = 0.025 + i * 0.01;
  return {
    price: Number(price.toFixed(3)),
    bids: seededInt(seed, 1, 20),
    asks: seededInt(seed + 1, 1, 25),
  };
});

// ============================================
// Helpers
// ============================================

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatHoursAgo(hours: number): string {
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function timeAgo(timestamp: number): string {
  const ref = 1770450000; // deterministic reference time
  const diff = ref - timestamp;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function weiToEth(wei: bigint): string {
  return formatEther(wei);
}

// ============================================
// Listing Card (enhanced)
// ============================================

function ListingCard({ listing, showWatchlistButton }: { listing: MockListing; showWatchlistButton?: boolean }) {
  const { wallet } = useApp();
  const allVerified = listing.sourceVerified && listing.logicVerified && listing.mintVerified;

  return (
    <GlassCard className="p-5 hover:border-white/[0.12] transition-all group">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-white font-mono font-bold">Token #{listing.tokenId}</span>
            <StatusBadge status={allVerified ? 'Verified' : 'Pending'} />
          </div>
          <div className="flex items-center gap-2">
            <p className="text-white/30 text-xs font-mono">{truncateAddress(listing.seller)}</p>
            <span className="text-[10px] text-amber-400/70 font-mono" title="Seller reputation">
              Rep: {listing.reputationScore}
            </span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-white/20 text-xs font-mono block">{formatHoursAgo(listing.timeSinceListed)}</span>
          <span className="text-white/15 text-[10px] font-mono flex items-center justify-end gap-1 mt-0.5">
            <Eye className="w-3 h-3" /> {listing.viewCount}
          </span>
        </div>
      </div>

      {/* Data */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-xs">
          <span className="text-white/40">CO2 Captured</span>
          <span className="text-emerald-400 font-mono">{listing.co2AmountKg.toLocaleString()} kg</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-white/40">Available</span>
          <span className="text-white/70 font-mono">{listing.amount} units</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-white/40">Price / Unit</span>
          <span className="text-cyan-400 font-mono font-bold">{weiToEth(listing.pricePerUnit)} AETH</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-white/40">Purity</span>
          <span className="text-blue-400 font-mono">{listing.purityPercentage}%</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-white/40">Total Value</span>
          <span className="text-white/50 font-mono">{weiToEth(listing.pricePerUnit * BigInt(listing.amount))} AETH</span>
        </div>
      </div>

      {/* Verification mini-badges */}
      <div className="flex gap-1.5 mb-4">
        <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${listing.sourceVerified ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/[0.04] text-white/30'}`}>SRC</span>
        <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${listing.logicVerified ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/[0.04] text-white/30'}`}>LOG</span>
        <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${listing.mintVerified ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/[0.04] text-white/30'}`}>MNT</span>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            wallet.connected
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
              : 'bg-white/[0.04] text-white/40 border border-white/[0.08] hover:bg-white/[0.06]'
          }`}
        >
          {wallet.connected ? 'Buy Credits' : 'Connect to Buy'}
        </button>
        {showWatchlistButton && (
          <button className="px-3 py-2.5 rounded-xl text-sm border border-white/[0.08] text-white/40 hover:bg-white/[0.06] hover:text-white/60 transition-all" title="Add to Watchlist">
            <Eye className="w-4 h-4" />
          </button>
        )}
      </div>
    </GlassCard>
  );
}

// ============================================
// Active Listings Tab (enhanced)
// ============================================

type SortOption = 'price-asc' | 'price-desc' | 'co2' | 'newest' | 'purity';
type VerificationFilter = 'all' | 'verified' | 'pending';

function ActiveListingsTab() {
  const { stats } = usePlatformStats();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [verificationFilter, setVerificationFilter] = useState<VerificationFilter>('all');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [co2Min, setCo2Min] = useState('');
  const [co2Max, setCo2Max] = useState('');
  const [minPurity, setMinPurity] = useState('');

  const filteredListings = useMemo(() => {
    let result = [...MOCK_LISTINGS];

    // Search by tokenId or seller address
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (l) =>
          l.tokenId.toString().includes(q) ||
          l.seller.toLowerCase().includes(q)
      );
    }

    // Verification filter
    if (verificationFilter === 'verified') {
      result = result.filter((l) => l.sourceVerified && l.logicVerified && l.mintVerified);
    } else if (verificationFilter === 'pending') {
      result = result.filter((l) => !(l.sourceVerified && l.logicVerified && l.mintVerified));
    }

    // Price range
    if (priceMin) {
      const min = parseFloat(priceMin);
      if (!isNaN(min)) result = result.filter((l) => Number(weiToEth(l.pricePerUnit)) >= min);
    }
    if (priceMax) {
      const max = parseFloat(priceMax);
      if (!isNaN(max)) result = result.filter((l) => Number(weiToEth(l.pricePerUnit)) <= max);
    }

    // CO2 range
    if (co2Min) {
      const min = parseInt(co2Min);
      if (!isNaN(min)) result = result.filter((l) => l.co2AmountKg >= min);
    }
    if (co2Max) {
      const max = parseInt(co2Max);
      if (!isNaN(max)) result = result.filter((l) => l.co2AmountKg <= max);
    }

    // Min purity
    if (minPurity) {
      const min = parseInt(minPurity);
      if (!isNaN(min)) result = result.filter((l) => l.purityPercentage >= min);
    }

    // Sorting
    switch (sortBy) {
      case 'price-asc':
        result.sort((a, b) => (a.pricePerUnit < b.pricePerUnit ? -1 : 1));
        break;
      case 'price-desc':
        result.sort((a, b) => (a.pricePerUnit > b.pricePerUnit ? -1 : 1));
        break;
      case 'co2':
        result.sort((a, b) => b.co2AmountKg - a.co2AmountKg);
        break;
      case 'newest':
        result.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case 'purity':
        result.sort((a, b) => b.purityPercentage - a.purityPercentage);
        break;
    }

    return result;
  }, [searchQuery, sortBy, verificationFilter, priceMin, priceMax, co2Min, co2Max, minPurity]);

  return (
    <div>
      {/* Platform info */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <MetricCard
          label="Active Listings"
          value={stats ? Number(stats.nextListingId - 1n).toString() : MOCK_LISTINGS.length.toString()}
        />
        <MetricCard
          label="Platform Fee"
          value={stats ? `${Number(stats.platformFeeBps) / 100}%` : '2.5%'}
        />
        <MetricCard
          label="Marketplace"
          value={stats ? (stats.marketplacePaused ? 'Paused' : 'Live') : 'Live'}
        />
        <MetricCard
          label="Total Volume"
          value="142.7"
          unit="AETH"
        />
      </div>

      {/* Marketplace status */}
      {stats?.marketplacePaused && (
        <div className="mb-6 p-4 rounded-xl border border-red-500/20 bg-red-500/[0.05]">
          <div className="flex items-center gap-2">
            <LiveDot color="red" />
            <p className="text-red-400 text-sm font-semibold">Marketplace is currently paused. Trading is temporarily disabled.</p>
          </div>
        </div>
      )}

      {/* Search and filter bar */}
      <GlassCard className="p-4 mb-6">
        <div className="flex flex-col gap-4">
          {/* Row 1: Search + Sort */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                placeholder="Search by Token ID or seller address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/30 transition-colors"
              />
            </div>
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-white/30" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white/70 px-3 py-2.5 focus:outline-none focus:border-emerald-500/30 appearance-none cursor-pointer"
              >
                <option value="newest">Newest</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="co2">CO2 Amount</option>
                <option value="purity">Purity</option>
              </select>
            </div>
          </div>

          {/* Row 2: Advanced filters */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-white/30 uppercase tracking-wider">Price Range (AETH)</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.001"
                  placeholder="Min"
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  className="w-20 px-2 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white placeholder-white/25 focus:outline-none focus:border-emerald-500/30"
                />
                <span className="text-white/20 text-xs">-</span>
                <input
                  type="number"
                  step="0.001"
                  placeholder="Max"
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  className="w-20 px-2 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white placeholder-white/25 focus:outline-none focus:border-emerald-500/30"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-white/30 uppercase tracking-wider">CO2 Range (kg)</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  placeholder="Min"
                  value={co2Min}
                  onChange={(e) => setCo2Min(e.target.value)}
                  className="w-20 px-2 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white placeholder-white/25 focus:outline-none focus:border-emerald-500/30"
                />
                <span className="text-white/20 text-xs">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={co2Max}
                  onChange={(e) => setCo2Max(e.target.value)}
                  className="w-20 px-2 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white placeholder-white/25 focus:outline-none focus:border-emerald-500/30"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-white/30 uppercase tracking-wider">Min Purity %</label>
              <input
                type="number"
                min="0"
                max="100"
                placeholder="e.g. 95"
                value={minPurity}
                onChange={(e) => setMinPurity(e.target.value)}
                className="w-20 px-2 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white placeholder-white/25 focus:outline-none focus:border-emerald-500/30"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-white/30 uppercase tracking-wider">Verification</label>
              <select
                value={verificationFilter}
                onChange={(e) => setVerificationFilter(e.target.value as VerificationFilter)}
                className="bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white/70 px-2 py-1.5 focus:outline-none focus:border-emerald-500/30 appearance-none cursor-pointer"
              >
                <option value="all">All</option>
                <option value="verified">Verified Only</option>
                <option value="pending">Pending Only</option>
              </select>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Results count */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-white/40 text-xs font-mono">
          Showing {filteredListings.length} of {MOCK_LISTINGS.length} listings
        </p>
      </div>

      {/* Listings grid */}
      {filteredListings.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No Matching Listings"
          description="Try adjusting your search criteria or filters to find carbon credits."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredListings.map((listing) => (
            <ListingCard key={listing.listingId} listing={listing} showWatchlistButton />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// My Listings Tab (with wizard)
// ============================================

function MyListingsTab() {
  const { wallet } = useApp();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [selectedToken, setSelectedToken] = useState<MockPortfolioToken | null>(null);
  const [listingPrice, setListingPrice] = useState('');
  const [minPurchase, setMinPurchase] = useState('1');
  const [expiration, setExpiration] = useState('7d');
  const [wizardComplete, setWizardComplete] = useState(false);

  if (!wallet.connected) {
    return <ConnectWalletPrompt message="Connect your wallet to view and manage your marketplace listings." />;
  }

  const myListings = MOCK_LISTINGS.filter(
    (l) => l.seller.toLowerCase() === wallet.address.toLowerCase()
  );

  // Extended listings with statuses for demo
  const myListingsWithStatus: (MockListing & { displayStatus: 'active' | 'expired' | 'sold' })[] = [
    ...myListings.map((l) => ({ ...l, displayStatus: 'active' as const })),
    // Add some mock expired/sold listings
    {
      ...MOCK_LISTINGS[0]!,
      listingId: 100,
      tokenId: 150,
      seller: wallet.address,
      displayStatus: 'sold' as const,
      isActive: false,
    },
    {
      ...MOCK_LISTINGS[1]!,
      listingId: 101,
      tokenId: 162,
      seller: wallet.address,
      displayStatus: 'expired' as const,
      isActive: false,
    },
  ];

  const platformFee = 0.025;
  const priceNum = parseFloat(listingPrice) || 0;
  const feeAmount = priceNum * platformFee;
  const youReceive = priceNum - feeAmount;

  function resetWizard() {
    setWizardStep(1);
    setSelectedToken(null);
    setListingPrice('');
    setMinPurchase('1');
    setExpiration('7d');
    setWizardComplete(false);
    setWizardOpen(false);
  }

  function handleWizardNext() {
    if (wizardStep === 3) {
      setWizardComplete(true);
      setWizardStep(4);
    } else {
      setWizardStep(wizardStep + 1);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <p className="text-white/50 text-xs font-mono uppercase tracking-widest">Your Listings</p>
        <button
          onClick={() => { setWizardOpen(true); setWizardStep(1); setWizardComplete(false); }}
          className="px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-sm font-semibold hover:bg-emerald-500/30 transition-all"
        >
          + Create Listing
        </button>
      </div>

      {/* Listing creation wizard */}
      {wizardOpen && (
        <GlassCard className="p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-white font-semibold">Create New Listing</h3>
            <button onClick={resetWizard} className="text-white/30 hover:text-white/60 text-xs">Cancel</button>
          </div>

          {/* Step indicators */}
          <div className="flex items-center gap-2 mb-6">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  wizardStep >= step
                    ? wizardComplete && step === 4
                      ? 'bg-emerald-500/30 text-emerald-400 border border-emerald-500/40'
                      : wizardStep === step
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-emerald-500/10 text-emerald-400/60 border border-emerald-500/20'
                    : 'bg-white/[0.04] text-white/30 border border-white/[0.08]'
                }`}>
                  {wizardComplete && step < 4 ? '\u2713' : step}
                </div>
                {step < 4 && <div className={`w-8 h-px ${wizardStep > step ? 'bg-emerald-500/30' : 'bg-white/[0.08]'}`} />}
              </div>
            ))}
          </div>

          {/* Step 1: Select Token */}
          {wizardStep === 1 && (
            <div>
              <p className="text-sm text-white/60 mb-4">Select a carbon credit token from your portfolio to list on the marketplace.</p>
              <div className="space-y-2">
                {MOCK_PORTFOLIO.map((token) => (
                  <button
                    key={token.tokenId}
                    onClick={() => { setSelectedToken(token); handleWizardNext(); }}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left ${
                      selectedToken?.tokenId === token.tokenId
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.1]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-mono font-bold text-sm">Token #{token.tokenId}</span>
                        <span className="text-[10px] text-white/30 font-mono">{token.dacUnitId}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-emerald-400/70">{token.co2AmountKg.toLocaleString()} kg CO2</span>
                        <span className="text-xs text-blue-400/70">Purity: {token.purity}%</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-white/70 font-mono text-sm font-bold">{token.balance}</span>
                      <span className="text-white/30 text-xs block">units</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Set Price */}
          {wizardStep === 2 && selectedToken && (
            <div>
              <p className="text-sm text-white/60 mb-4">
                Configure pricing for Token #{selectedToken.tokenId} ({selectedToken.balance} units available).
              </p>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">Price per Unit (AETH)</label>
                  <input
                    type="number"
                    step="0.001"
                    placeholder="e.g. 0.045"
                    value={listingPrice}
                    onChange={(e) => setListingPrice(e.target.value)}
                    className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/25 focus:outline-none focus:border-emerald-500/30"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">Minimum Purchase Amount</label>
                  <input
                    type="number"
                    min="1"
                    max={selectedToken.balance}
                    value={minPurchase}
                    onChange={(e) => setMinPurchase(e.target.value)}
                    className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/25 focus:outline-none focus:border-emerald-500/30"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">Listing Expiration</label>
                  <select
                    value={expiration}
                    onChange={(e) => setExpiration(e.target.value)}
                    className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white/70 focus:outline-none focus:border-emerald-500/30 appearance-none cursor-pointer"
                  >
                    <option value="1d">1 Day</option>
                    <option value="3d">3 Days</option>
                    <option value="7d">7 Days</option>
                    <option value="14d">14 Days</option>
                    <option value="30d">30 Days</option>
                    <option value="never">No Expiration</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setWizardStep(1)} className="px-4 py-2.5 rounded-xl border border-white/[0.08] text-white/50 text-sm hover:bg-white/[0.04] transition-all">Back</button>
                  <button
                    onClick={handleWizardNext}
                    disabled={!listingPrice || parseFloat(listingPrice) <= 0}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-sm font-semibold hover:bg-emerald-500/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Review Listing
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {wizardStep === 3 && selectedToken && (
            <div>
              <p className="text-sm text-white/60 mb-4">Review your listing details before submitting.</p>
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 space-y-3 mb-5">
                <div className="flex justify-between text-sm">
                  <span className="text-white/40">Token</span>
                  <span className="text-white font-mono">#{selectedToken.tokenId}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/40">DAC Unit</span>
                  <span className="text-white/70 font-mono">{selectedToken.dacUnitId}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/40">Units Available</span>
                  <span className="text-white/70 font-mono">{selectedToken.balance}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/40">Price per Unit</span>
                  <span className="text-cyan-400 font-mono font-bold">{listingPrice} AETH</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/40">Min Purchase</span>
                  <span className="text-white/70 font-mono">{minPurchase} units</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/40">Expiration</span>
                  <span className="text-white/70 font-mono">{expiration === 'never' ? 'No Expiration' : expiration}</span>
                </div>
                <hr className="border-white/[0.06]" />
                <div className="flex justify-between text-sm">
                  <span className="text-white/40">Platform Fee (2.5%)</span>
                  <span className="text-amber-400/70 font-mono">{feeAmount.toFixed(6)} AETH</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/40">You Receive per Unit</span>
                  <span className="text-emerald-400 font-mono font-bold">{youReceive.toFixed(6)} AETH</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/40">Max Revenue (all sold)</span>
                  <span className="text-emerald-400 font-mono">{(youReceive * selectedToken.balance).toFixed(4)} AETH</span>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setWizardStep(2)} className="px-4 py-2.5 rounded-xl border border-white/[0.08] text-white/50 text-sm hover:bg-white/[0.04] transition-all">Back</button>
                <button
                  onClick={handleWizardNext}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-sm font-semibold hover:bg-emerald-500/30 transition-all"
                >
                  Confirm & List
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Success */}
          {wizardStep === 4 && wizardComplete && (
            <div className="text-center py-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <span className="text-3xl text-emerald-400">{'\u2713'}</span>
              </div>
              <h4 className="text-white font-semibold text-lg mb-2">Listing Created Successfully</h4>
              <p className="text-white/40 text-sm mb-1">
                Token #{selectedToken?.tokenId} has been listed on the marketplace.
              </p>
              <p className="text-white/30 text-xs font-mono mb-6">
                Transaction would be submitted to the Aethelred network.
              </p>
              <button onClick={resetWizard} className="px-6 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-sm font-semibold hover:bg-emerald-500/30 transition-all">
                Done
              </button>
            </div>
          )}
        </GlassCard>
      )}

      {/* Existing listings */}
      {myListingsWithStatus.length === 0 && !wizardOpen ? (
        <EmptyState
          icon={Package}
          title="No Active Listings"
          description="You haven't listed any carbon credits for sale yet. Create a listing to start trading."
          action={
            <button
              onClick={() => setWizardOpen(true)}
              className="px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-sm font-semibold hover:bg-emerald-500/30 transition-all"
            >
              Create Your First Listing
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {myListingsWithStatus.map((listing) => (
            <GlassCard key={`ml-${listing.listingId}`} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-mono font-bold">Token #{listing.tokenId}</span>
                    <StatusBadge status={listing.displayStatus === 'active' ? 'Active' : listing.displayStatus === 'sold' ? 'Retired' : 'Paused'} />
                  </div>
                </div>
              </div>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">CO2 Captured</span>
                  <span className="text-emerald-400 font-mono">{listing.co2AmountKg.toLocaleString()} kg</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">Price / Unit</span>
                  <span className="text-cyan-400 font-mono font-bold">{weiToEth(listing.pricePerUnit)} AETH</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">Available</span>
                  <span className="text-white/70 font-mono">{listing.amount} units</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">Status</span>
                  <span className={`font-mono text-xs ${listing.displayStatus === 'active' ? 'text-emerald-400' : listing.displayStatus === 'sold' ? 'text-cyan-400' : 'text-amber-400'}`}>
                    {listing.displayStatus.charAt(0).toUpperCase() + listing.displayStatus.slice(1)}
                  </span>
                </div>
              </div>
              {listing.displayStatus === 'active' && (
                <div className="flex gap-2">
                  <button className="flex-1 py-2 rounded-xl text-xs font-semibold bg-white/[0.04] text-white/50 border border-white/[0.08] hover:bg-white/[0.06] transition-all">
                    Edit Price
                  </button>
                  <button className="flex-1 py-2 rounded-xl text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all">
                    Cancel
                  </button>
                </div>
              )}
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// Trade History Tab (enhanced)
// ============================================

function TradeHistoryTab() {
  const [liveEvents, setLiveEvents] = useState<ContractEventLog[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'purchase' | 'sale'>('all');
  const [dateRange, setDateRange] = useState<'all' | '24h' | '7d' | '30d'>('all');

  const onSale = useCallback((log: ContractEventLog) => {
    setLiveEvents((prev) => [log, ...prev].slice(0, 50));
  }, []);

  useWatchMarketplaceSales(onSale);

  const filteredTrades = useMemo(() => {
    let result = [...MOCK_TRADES];

    if (filterType !== 'all') {
      result = result.filter((t) => t.type === filterType);
    }

    if (dateRange !== 'all') {
      const ref = 1770450000;
      const cutoffs: Record<string, number> = { '24h': 86400, '7d': 604800, '30d': 2592000 };
      const cutoff = ref - (cutoffs[dateRange] || 0);
      result = result.filter((t) => t.timestamp >= cutoff);
    }

    return result;
  }, [filterType, dateRange]);

  // Stats
  const totalVolume = MOCK_TRADES.reduce((sum, t) => sum + Number(formatEther(t.totalPrice)), 0);
  const avgPrice = totalVolume / MOCK_TRADES.reduce((sum, t) => sum + t.amount, 0);
  const totalCo2Traded = MOCK_TRADES.reduce((sum, t) => sum + t.co2AmountKg, 0);

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Total Trades" value={MOCK_TRADES.length.toString()} />
        <MetricCard label="Total Volume" value={totalVolume.toFixed(2)} unit="AETH" />
        <MetricCard label="Avg Price/Unit" value={avgPrice.toFixed(4)} unit="AETH" />
        <MetricCard label="CO2 Traded" value={(totalCo2Traded / 1000).toFixed(1)} unit="tCO2" />
      </div>

      {/* Live events indicator */}
      {liveEvents.length > 0 && (
        <GlassCard className="p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <LiveDot color="emerald" />
            <p className="text-emerald-400 text-xs font-semibold">Live Events ({liveEvents.length})</p>
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {liveEvents.map((evt, i) => (
              <div key={i} className="flex items-center gap-3 text-xs">
                <span className="text-emerald-400 font-mono">Purchase</span>
                <span className="text-white/30 font-mono truncate">{evt.transactionHash.slice(0, 16)}...</span>
                <span className="text-white/20 font-mono">Block {evt.blockNumber.toString()}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <p className="text-white/50 text-xs font-mono uppercase tracking-widest">Recent Trades</p>
        <div className="flex-1" />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as 'all' | 'purchase' | 'sale')}
          className="bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white/70 px-2 py-1.5 focus:outline-none appearance-none cursor-pointer"
        >
          <option value="all">All Types</option>
          <option value="purchase">Purchases</option>
          <option value="sale">Sales</option>
        </select>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value as 'all' | '24h' | '7d' | '30d')}
          className="bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white/70 px-2 py-1.5 focus:outline-none appearance-none cursor-pointer"
        >
          <option value="all">All Time</option>
          <option value="24h">Last 24h</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
        </select>
        <button className="flex items-center gap-1 px-3 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white/50 hover:bg-white/[0.06] transition-all">
          <Download className="w-3 h-3" />
          Export CSV
        </button>
      </div>

      {/* Trade table */}
      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left py-3 px-4 text-white/40 text-xs font-mono uppercase tracking-widest font-normal">Type</th>
                <th className="text-left py-3 px-4 text-white/40 text-xs font-mono uppercase tracking-widest font-normal">Token</th>
                <th className="text-left py-3 px-4 text-white/40 text-xs font-mono uppercase tracking-widest font-normal">Buyer</th>
                <th className="text-left py-3 px-4 text-white/40 text-xs font-mono uppercase tracking-widest font-normal">Seller</th>
                <th className="text-right py-3 px-4 text-white/40 text-xs font-mono uppercase tracking-widest font-normal">Amount</th>
                <th className="text-right py-3 px-4 text-white/40 text-xs font-mono uppercase tracking-widest font-normal">CO2</th>
                <th className="text-right py-3 px-4 text-white/40 text-xs font-mono uppercase tracking-widest font-normal">Total Price</th>
                <th className="text-right py-3 px-4 text-white/40 text-xs font-mono uppercase tracking-widest font-normal">Time</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrades.map((trade) => (
                <tr key={trade.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-4">
                    <span className={`text-xs font-mono font-semibold ${trade.type === 'purchase' ? 'text-emerald-400' : 'text-cyan-400'}`}>
                      {trade.type === 'purchase' ? 'BUY' : 'SELL'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-white font-mono">#{trade.tokenId}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-white/50 font-mono text-xs">{truncateAddress(trade.buyer)}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-white/50 font-mono text-xs">{truncateAddress(trade.seller)}</span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="text-white/70 font-mono">{trade.amount}</span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="text-emerald-400/60 font-mono text-xs">{trade.co2AmountKg.toLocaleString()} kg</span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="text-cyan-400 font-mono font-bold">{formatEther(trade.totalPrice)} AETH</span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="text-white/30 font-mono text-xs">{timeAgo(trade.timestamp)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredTrades.length === 0 && (
          <div className="py-12 text-center text-white/30 text-sm">No trades found for the selected filters.</div>
        )}
      </GlassCard>
    </div>
  );
}

// ============================================
// Analytics Tab
// ============================================

function AnalyticsTab() {
  // VWAP calc
  const totalWeightedPrice = ANALYTICS_PRICE_HISTORY.reduce((sum, d) => sum + d.avgPrice * d.volume, 0);
  const totalVol = ANALYTICS_PRICE_HISTORY.reduce((sum, d) => sum + d.volume, 0);
  const vwap = totalWeightedPrice / totalVol;
  const totalTrades30d = ANALYTICS_PRICE_HISTORY.reduce((sum, d) => sum + d.trades, 0);
  const maxVolume = Math.max(...ANALYTICS_PRICE_HISTORY.map((d) => d.volume));
  const maxBarHeight = 120;
  const maxDepth = Math.max(...MARKET_DEPTH.map((d) => Math.max(d.bids, d.asks)));

  return (
    <div>
      {/* Top metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <MetricCard label="VWAP (30d)" value={vwap.toFixed(4)} unit="AETH" />
        <MetricCard label="Price per tCO2" value={(vwap * 1000).toFixed(2)} unit="AETH/tCO2" />
        <MetricCard label="30d Volume" value={totalVol.toLocaleString()} unit="units" />
        <MetricCard label="30d Trades" value={totalTrades30d.toString()} />
      </div>

      {/* Comparison callout */}
      <GlassCard className="p-4 mb-6 border-emerald-500/10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-xl">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm text-white/80">
              <span className="text-emerald-400 font-semibold">TerraQura avg: {vwap.toFixed(4)} AETH/tCO2</span>
              {' '}vs{' '}
              <span className="text-white/50">Verra avg: $12/tCO2</span>
            </p>
            <p className="text-xs text-white/30 mt-0.5">On-chain carbon credits offer transparent, verifiable pricing with lower intermediary costs.</p>
          </div>
        </div>
      </GlassCard>

      {/* 30-day price history (CSS bar chart) */}
      <GlassCard className="p-5 mb-6">
        <h3 className="text-sm text-white/60 font-semibold uppercase tracking-wider mb-4">30-Day Price History</h3>
        <div className="flex items-end gap-1" style={{ height: `${maxBarHeight + 30}px` }}>
          {ANALYTICS_PRICE_HISTORY.map((d) => {
            const barH = Math.max(4, (d.avgPrice / 0.08) * maxBarHeight);
            return (
              <div key={d.day} className="flex-1 flex flex-col items-center group relative">
                <div
                  className="w-full bg-emerald-500/30 rounded-t-sm hover:bg-emerald-500/50 transition-colors cursor-default"
                  style={{ height: `${barH}px` }}
                  title={`Day ${d.day}: ${d.avgPrice.toFixed(4)} AETH | Vol: ${d.volume}`}
                />
                {d.day % 5 === 0 && (
                  <span className="text-[8px] text-white/20 mt-1">{d.day}</span>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between mt-2 text-[10px] text-white/20">
          <span>Day 1</span>
          <span>Day 30</span>
        </div>
      </GlassCard>

      {/* Daily volume chart */}
      <GlassCard className="p-5 mb-6">
        <h3 className="text-sm text-white/60 font-semibold uppercase tracking-wider mb-4">Daily Volume (30 Days)</h3>
        <div className="flex items-end gap-1" style={{ height: `${maxBarHeight + 30}px` }}>
          {ANALYTICS_PRICE_HISTORY.map((d) => {
            const barH = Math.max(4, (d.volume / maxVolume) * maxBarHeight);
            return (
              <div key={d.day} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full bg-cyan-500/30 rounded-t-sm hover:bg-cyan-500/50 transition-colors cursor-default"
                  style={{ height: `${barH}px` }}
                  title={`Day ${d.day}: ${d.volume} units | ${d.trades} trades`}
                />
                {d.day % 5 === 0 && (
                  <span className="text-[8px] text-white/20 mt-1">{d.day}</span>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between mt-2 text-[10px] text-white/20">
          <span>Day 1</span>
          <span>Day 30</span>
        </div>
      </GlassCard>

      {/* Market depth */}
      <GlassCard className="p-5 mb-6">
        <h3 className="text-sm text-white/60 font-semibold uppercase tracking-wider mb-4">Market Depth</h3>
        <div className="space-y-2">
          {MARKET_DEPTH.map((d) => (
            <div key={d.price} className="flex items-center gap-3 text-xs">
              <span className="text-white/50 font-mono w-16 text-right">{d.price.toFixed(3)}</span>
              <div className="flex-1 flex items-center gap-1">
                <div className="flex-1 flex justify-end">
                  <div
                    className="bg-emerald-500/30 rounded-l-sm h-4"
                    style={{ width: `${(d.bids / maxDepth) * 100}%` }}
                    title={`${d.bids} bids`}
                  />
                </div>
                <div className="w-px h-4 bg-white/10" />
                <div className="flex-1">
                  <div
                    className="bg-red-500/30 rounded-r-sm h-4"
                    style={{ width: `${(d.asks / maxDepth) * 100}%` }}
                    title={`${d.asks} asks`}
                  />
                </div>
              </div>
              <div className="flex gap-3 w-24">
                <span className="text-emerald-400/60 font-mono">{d.bids}B</span>
                <span className="text-red-400/60 font-mono">{d.asks}A</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-6 mt-3 text-[10px]">
          <span className="flex items-center gap-1"><span className="w-3 h-2 bg-emerald-500/30 rounded-sm" /> Bids</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 bg-red-500/30 rounded-sm" /> Asks</span>
        </div>
      </GlassCard>

      {/* Top buyers and sellers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard className="p-5">
          <h3 className="text-sm text-white/60 font-semibold uppercase tracking-wider mb-4">Top Buyers (30d)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left py-2 text-white/30 font-normal">Address</th>
                  <th className="text-right py-2 text-white/30 font-normal">Volume (AETH)</th>
                  <th className="text-right py-2 text-white/30 font-normal">Trades</th>
                  <th className="text-right py-2 text-white/30 font-normal">CO2 (kg)</th>
                </tr>
              </thead>
              <tbody>
                {ANALYTICS_TOP_BUYERS.map((b, i) => (
                  <tr key={i} className="border-b border-white/[0.03]">
                    <td className="py-2 font-mono text-white/50">{truncateAddress(b.address)}</td>
                    <td className="py-2 text-right font-mono text-cyan-400">{b.totalVolume.toFixed(3)}</td>
                    <td className="py-2 text-right font-mono text-white/50">{b.trades}</td>
                    <td className="py-2 text-right font-mono text-emerald-400/60">{b.co2Acquired.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <h3 className="text-sm text-white/60 font-semibold uppercase tracking-wider mb-4">Top Sellers (30d)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left py-2 text-white/30 font-normal">Address</th>
                  <th className="text-right py-2 text-white/30 font-normal">Volume (AETH)</th>
                  <th className="text-right py-2 text-white/30 font-normal">Trades</th>
                  <th className="text-right py-2 text-white/30 font-normal">CO2 (kg)</th>
                </tr>
              </thead>
              <tbody>
                {ANALYTICS_TOP_SELLERS.map((s, i) => (
                  <tr key={i} className="border-b border-white/[0.03]">
                    <td className="py-2 font-mono text-white/50">{truncateAddress(s.address)}</td>
                    <td className="py-2 text-right font-mono text-cyan-400">{s.totalVolume.toFixed(3)}</td>
                    <td className="py-2 text-right font-mono text-white/50">{s.trades}</td>
                    <td className="py-2 text-right font-mono text-emerald-400/60">{s.co2Sold.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

// ============================================
// Offers Tab
// ============================================

function OffersTab() {
  const { wallet } = useApp();
  const [offerPrice, setOfferPrice] = useState('');
  const [offerQty, setOfferQty] = useState('');
  const [offerExpiry, setOfferExpiry] = useState('3d');

  if (!wallet.connected) {
    return <ConnectWalletPrompt message="Connect your wallet to view and manage offers on your listings." />;
  }

  // Bid/ask spread visualization
  const bidPrices = MOCK_OFFERS.filter((o) => o.status === 'Pending' || o.status === 'Countered')
    .map((o) => Number(formatEther(o.pricePerUnit)));
  const askPrices = MOCK_LISTINGS.slice(0, 5).map((l) => Number(formatEther(l.pricePerUnit)));
  const allPrices = [...bidPrices, ...askPrices].sort((a, b) => a - b);
  const spreadMin = allPrices.length > 0 ? allPrices[0]! : 0;
  const spreadMax = allPrices.length > 0 ? allPrices[allPrices.length - 1]! : 1;
  const spreadRange = spreadMax - spreadMin || 0.001;

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Pending Offers" value={MOCK_OFFERS.filter((o) => o.status === 'Pending').length.toString()} />
        <MetricCard label="Accepted" value={MOCK_OFFERS.filter((o) => o.status === 'Accepted').length.toString()} />
        <MetricCard label="Countered" value={MOCK_OFFERS.filter((o) => o.status === 'Countered').length.toString()} />
        <MetricCard label="Total Offers" value={MOCK_OFFERS.length.toString()} />
      </div>

      {/* Make offer form */}
      <GlassCard className="p-5 mb-6">
        <h3 className="text-sm text-white/60 font-semibold uppercase tracking-wider mb-4">Make an Offer</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="text-[10px] text-white/30 uppercase tracking-wider block mb-1">Price per Unit (AETH)</label>
            <input
              type="number"
              step="0.001"
              placeholder="0.045"
              value={offerPrice}
              onChange={(e) => setOfferPrice(e.target.value)}
              className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/25 focus:outline-none focus:border-emerald-500/30"
            />
          </div>
          <div>
            <label className="text-[10px] text-white/30 uppercase tracking-wider block mb-1">Quantity</label>
            <input
              type="number"
              min="1"
              placeholder="5"
              value={offerQty}
              onChange={(e) => setOfferQty(e.target.value)}
              className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/25 focus:outline-none focus:border-emerald-500/30"
            />
          </div>
          <div>
            <label className="text-[10px] text-white/30 uppercase tracking-wider block mb-1">Expiration</label>
            <select
              value={offerExpiry}
              onChange={(e) => setOfferExpiry(e.target.value)}
              className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white/70 focus:outline-none focus:border-emerald-500/30 appearance-none cursor-pointer"
            >
              <option value="1h">1 Hour</option>
              <option value="6h">6 Hours</option>
              <option value="1d">1 Day</option>
              <option value="3d">3 Days</option>
              <option value="7d">7 Days</option>
            </select>
          </div>
          <div className="flex items-end">
            <button className="w-full px-4 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-sm font-semibold hover:bg-emerald-500/30 transition-all">
              Submit Offer
            </button>
          </div>
        </div>
      </GlassCard>

      {/* Bid/Ask Spread Visualization */}
      <GlassCard className="p-5 mb-6">
        <h3 className="text-sm text-white/60 font-semibold uppercase tracking-wider mb-4">Bid / Ask Spread</h3>
        <div className="relative h-12 bg-white/[0.02] rounded-lg overflow-hidden">
          {/* Bid markers */}
          {bidPrices.map((p, i) => {
            const pos = ((p - spreadMin) / spreadRange) * 100;
            return (
              <div
                key={`bid-${i}`}
                className="absolute top-0 h-full w-1 bg-emerald-500/50"
                style={{ left: `${Math.min(pos, 99)}%` }}
                title={`Bid: ${p.toFixed(4)} AETH`}
              />
            );
          })}
          {/* Ask markers */}
          {askPrices.map((p, i) => {
            const pos = ((p - spreadMin) / spreadRange) * 100;
            return (
              <div
                key={`ask-${i}`}
                className="absolute top-0 h-full w-1 bg-red-500/50"
                style={{ left: `${Math.min(pos, 99)}%` }}
                title={`Ask: ${p.toFixed(4)} AETH`}
              />
            );
          })}
        </div>
        <div className="flex items-center justify-between mt-2 text-[10px] text-white/20">
          <span>{spreadMin.toFixed(4)} AETH</span>
          <div className="flex gap-4">
            <span className="flex items-center gap-1"><span className="w-3 h-2 bg-emerald-500/50 rounded-sm" /> Bids</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 bg-red-500/50 rounded-sm" /> Asks</span>
          </div>
          <span>{spreadMax.toFixed(4)} AETH</span>
        </div>
      </GlassCard>

      {/* Pending offers on your listings */}
      <p className="text-white/50 text-xs font-mono uppercase tracking-widest mb-4">Offers on Your Listings</p>
      <div className="space-y-3">
        {MOCK_OFFERS.map((offer) => {
          const statusColors: Record<string, string> = {
            Pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
            Accepted: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
            Rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
            Expired: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
            Countered: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
          };

          return (
            <GlassCard key={offer.offerId} className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-mono text-sm font-bold">Token #{offer.tokenId}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full border ${statusColors[offer.status]}`}>
                        {offer.status}
                      </span>
                    </div>
                    <p className="text-white/30 text-xs font-mono">From: {truncateAddress(offer.offerer)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs text-white/40">Offered Price</p>
                    <p className="text-cyan-400 font-mono font-bold text-sm">{formatEther(offer.pricePerUnit)} AETH</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-white/40">Qty</p>
                    <p className="text-white/70 font-mono text-sm">{offer.quantity}</p>
                  </div>
                  {offer.counterPrice && (
                    <div className="text-right">
                      <p className="text-xs text-white/40">Counter</p>
                      <p className="text-amber-400 font-mono font-bold text-sm">{formatEther(offer.counterPrice)} AETH</p>
                    </div>
                  )}
                  {offer.status === 'Pending' && (
                    <div className="flex gap-2">
                      <button className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold hover:bg-emerald-500/30 transition-all">
                        Accept
                      </button>
                      <button className="px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs font-semibold hover:bg-cyan-500/20 transition-all">
                        Counter
                      </button>
                      <button className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-semibold hover:bg-red-500/20 transition-all">
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// Gasless Tab
// ============================================

function GaslessTab() {
  const gaslessAddress = CONTRACTS.gaslessMarketplace;
  const totalGaslessTrades = 1247; // seeded deterministic value
  const gasSavedAeth = 3.741; // seeded deterministic value

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Gasless Trades" value={totalGaslessTrades.toLocaleString()} />
        <MetricCard label="Gas Saved" value={gasSavedAeth.toFixed(3)} unit="AETH" />
        <MetricCard label="Relayer Status" value="Online" />
        <MetricCard label="Avg Confirmation" value="~4s" />
      </div>

      {/* Contract info */}
      <GlassCard className="p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm text-white/60 font-semibold uppercase tracking-wider">GaslessMarketplace Contract</h3>
          <StatusBadge status="Operational" />
        </div>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-white/70 font-mono text-xs break-all">{gaslessAddress}</span>
        </div>
        <p className="text-white/40 text-xs leading-relaxed">
          The Gasless Marketplace uses EIP-712 meta-transactions to enable zero-gas trading. Sellers and buyers sign
          typed structured data off-chain, and the TerraQura relayer submits the transaction on their behalf, covering all gas costs.
        </p>
      </GlassCard>

      {/* Comparison table */}
      <GlassCard className="p-5 mb-6">
        <h3 className="text-sm text-white/60 font-semibold uppercase tracking-wider mb-4">Standard vs Gasless Trading</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left py-3 text-white/40 text-xs font-mono uppercase font-normal">Feature</th>
                <th className="text-center py-3 text-white/40 text-xs font-mono uppercase font-normal">Standard</th>
                <th className="text-center py-3 text-white/40 text-xs font-mono uppercase font-normal">Gasless</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-white/[0.03]">
                <td className="py-3 text-white/60">Gas Cost</td>
                <td className="py-3 text-center text-amber-400 font-mono">~0.003 AETH</td>
                <td className="py-3 text-center text-emerald-400 font-mono font-bold">0 AETH</td>
              </tr>
              <tr className="border-b border-white/[0.03]">
                <td className="py-3 text-white/60">Confirmation Time</td>
                <td className="py-3 text-center text-white/50 font-mono">~3s</td>
                <td className="py-3 text-center text-white/50 font-mono">~4s</td>
              </tr>
              <tr className="border-b border-white/[0.03]">
                <td className="py-3 text-white/60">Wallet Balance Required</td>
                <td className="py-3 text-center text-white/50">Yes (for gas)</td>
                <td className="py-3 text-center text-emerald-400">No</td>
              </tr>
              <tr className="border-b border-white/[0.03]">
                <td className="py-3 text-white/60">Transaction Signing</td>
                <td className="py-3 text-center text-white/50">On-chain tx</td>
                <td className="py-3 text-center text-white/50">EIP-712 signature</td>
              </tr>
              <tr className="border-b border-white/[0.03]">
                <td className="py-3 text-white/60">Platform Fee</td>
                <td className="py-3 text-center text-white/50 font-mono">2.5%</td>
                <td className="py-3 text-center text-white/50 font-mono">2.5%</td>
              </tr>
              <tr>
                <td className="py-3 text-white/60">Security</td>
                <td className="py-3 text-center text-white/50">Direct on-chain</td>
                <td className="py-3 text-center text-white/50">Signature verified on-chain</td>
              </tr>
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* How it works */}
      <GlassCard className="p-5 mb-6">
        <h3 className="text-sm text-white/60 font-semibold uppercase tracking-wider mb-6">How Gasless Trading Works</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <span className="text-emerald-400 font-bold text-lg">1</span>
            </div>
            <h4 className="text-white font-semibold text-sm mb-1">Sign</h4>
            <p className="text-white/40 text-xs leading-relaxed">
              Sign an EIP-712 typed message with your trade details (token, amount, price). No gas needed for signing.
            </p>
          </div>
          <div className="text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <span className="text-cyan-400 font-bold text-lg">2</span>
            </div>
            <h4 className="text-white font-semibold text-sm mb-1">Relay</h4>
            <p className="text-white/40 text-xs leading-relaxed">
              The TerraQura relayer picks up your signed message and submits the transaction to the Aethelred network, paying the gas fee.
            </p>
          </div>
          <div className="text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <span className="text-blue-400 font-bold text-lg">3</span>
            </div>
            <h4 className="text-white font-semibold text-sm mb-1">Confirm</h4>
            <p className="text-white/40 text-xs leading-relaxed">
              The GaslessMarketplace contract verifies your signature on-chain and executes the trade. You receive confirmation within seconds.
            </p>
          </div>
        </div>
      </GlassCard>

      {/* Relayer status */}
      <GlassCard className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LiveDot color="emerald" />
            <div>
              <h4 className="text-white text-sm font-semibold">Relayer Online</h4>
              <p className="text-white/30 text-xs">Processing gasless transactions in real-time</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-emerald-400 font-mono text-sm font-bold">{totalGaslessTrades.toLocaleString()}</p>
            <p className="text-white/30 text-[10px]">total gasless trades</p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

// ============================================
// Watchlist Tab
// ============================================

function WatchlistTab() {
  const { wallet } = useApp();

  if (!wallet.connected) {
    return <ConnectWalletPrompt message="Connect your wallet to manage your carbon credit watchlist." />;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-white/50 text-xs font-mono uppercase tracking-widest">Watching {MOCK_WATCHLIST.length} Items</p>
        <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/50 text-sm hover:bg-white/[0.06] transition-all">
          <Bell className="w-4 h-4" />
          Alert Settings
        </button>
      </div>

      {/* Watchlist items */}
      <div className="space-y-3">
        {MOCK_WATCHLIST.map((item) => {
          const isUp = item.priceChange >= 0;
          const priceEth = Number(formatEther(item.lastPrice));
          const alertAboveEth = Number(formatEther(item.alertAbove));
          const alertBelowEth = Number(formatEther(item.alertBelow));

          return (
            <GlassCard key={item.tokenId} className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-mono font-bold">Token #{item.tokenId}</span>
                      <span className={`flex items-center gap-1 text-xs font-mono font-semibold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {isUp ? '+' : ''}{item.priceChange.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-white/30">
                      <span className="font-mono">{truncateAddress(item.seller)}</span>
                      <span>{item.co2AmountKg.toLocaleString()} kg CO2</span>
                      <span>Purity: {item.purity}%</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-[10px] text-white/30 uppercase tracking-wider">Last Price</p>
                    <p className="text-cyan-400 font-mono font-bold">{priceEth.toFixed(3)} AETH</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-white/30 uppercase tracking-wider">Alert Above</p>
                    <p className="text-emerald-400/60 font-mono text-sm">{alertAboveEth.toFixed(3)} AETH</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-white/30 uppercase tracking-wider">Alert Below</p>
                    <p className="text-red-400/60 font-mono text-sm">{alertBelowEth.toFixed(3)} AETH</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold hover:bg-emerald-500/30 transition-all">
                      Buy
                    </button>
                    <button className="px-3 py-1.5 rounded-lg bg-white/[0.04] text-white/40 border border-white/[0.08] text-xs hover:bg-white/[0.06] transition-all">
                      Remove
                    </button>
                  </div>
                </div>
              </div>

              {/* Price movement mini-bar */}
              <div className="mt-3 pt-3 border-t border-white/[0.04]">
                <p className="text-[10px] text-white/20 mb-1">Recent Price Movement (7d)</p>
                <div className="flex items-end gap-px h-6">
                  {Array.from({ length: 14 }, (_, j) => {
                    const s = item.tokenId * 100 + j * 7;
                    const h = seededInt(s, 3, 24);
                    const color = seededRandom(s + 50) > 0.45 ? 'bg-emerald-500/40' : 'bg-red-500/30';
                    return <div key={j} className={`flex-1 rounded-t-sm ${color}`} style={{ height: `${h}px` }} />;
                  })}
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>

      {/* Add to watchlist concept */}
      <GlassCard className="p-5 mt-6 border-dashed border-white/[0.08]">
        <div className="text-center">
          <Eye className="w-6 h-6 text-white/20 mx-auto mb-2" />
          <p className="text-white/40 text-sm mb-1">Add tokens to your watchlist</p>
          <p className="text-white/20 text-xs">
            Click the <Eye className="w-3 h-3 inline" /> icon on any listing in the Active Listings tab to track price changes and set alerts.
          </p>
        </div>
      </GlassCard>
    </div>
  );
}

// ============================================
// Main Page
// ============================================

const TAB_LIST = [
  { id: 'listings', label: 'Active Listings', count: MOCK_LISTINGS.length },
  { id: 'my-listings', label: 'My Listings' },
  { id: 'history', label: 'Trade History' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'offers', label: 'Offers', icon: Handshake },
  { id: 'gasless', label: 'Gasless', icon: Zap },
  { id: 'watchlist', label: 'Watchlist', icon: Eye },
];

export function MarketplaceDashboardContent() {
  const [activeTab, setActiveTab] = useState('listings');

  return (
    <div className="min-h-screen bg-[#060A13] flex flex-col">
      <TopNav />
      <ToastContainer />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        <SectionHeader
          title="Carbon Marketplace"
          description="Peer-to-peer trading of Proof-of-Physics verified carbon credits on the Aethelred network."
        />
        <Tabs tabs={TAB_LIST} activeTab={activeTab} onChange={setActiveTab} />

        <div className="mt-6">
          {activeTab === 'listings' && <ActiveListingsTab />}
          {activeTab === 'my-listings' && <MyListingsTab />}
          {activeTab === 'history' && <TradeHistoryTab />}
          {activeTab === 'analytics' && <AnalyticsTab />}
          {activeTab === 'offers' && <OffersTab />}
          {activeTab === 'gasless' && <GaslessTab />}
          {activeTab === 'watchlist' && <WatchlistTab />}
        </div>
      </main>
      <DAppFooter />
    </div>
  );
}
