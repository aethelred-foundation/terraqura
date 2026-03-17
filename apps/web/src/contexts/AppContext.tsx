'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { useAccount, useBalance, useChainId, useBlockNumber, useDisconnect } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';

// Types
interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

interface WalletState {
  connected: boolean;
  address: string;
  balance: number;
  isConnecting: boolean;
  isWrongNetwork: boolean;
  chainId: number;
}

interface RealTimeState {
  blockHeight: number;
  lastBlockTime: number;
}

interface AppContextValue {
  web3Ready: boolean;
  wallet: WalletState;
  realTime: RealTimeState;
  notifications: Notification[];
  addNotification: (n: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  openConnectModal: (() => void) | undefined;
  disconnectWallet: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

// SSR-safe provider with static defaults (no wagmi hooks)
export function AppProviderSSR({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);

  const addNotification = useCallback((n: Omit<Notification, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setNotifications(prev => [...prev, { ...n, id }]);
    setTimeout(() => setNotifications(prev => prev.filter(item => item.id !== id)), n.duration || 5000);
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const value = useMemo(() => ({
    web3Ready: false,
    wallet: { connected: false, address: '', balance: 0, isConnecting: false, isWrongNetwork: false, chainId: 0 },
    realTime: { blockHeight: 0, lastBlockTime: Date.now() },
    notifications,
    addNotification,
    removeNotification,
    searchOpen,
    setSearchOpen,
    openConnectModal: undefined,
    disconnectWallet: () => {},
  }), [notifications, addNotification, removeNotification, searchOpen]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// Full provider with wagmi hooks (must be inside WagmiProvider)
export function AppProvider({ children }: { children: ReactNode }) {
  const { address, isConnected, isConnecting } = useAccount();
  const chainId = useChainId();
  const { data: balanceData } = useBalance({ address: address as `0x${string}` | undefined });
  const { data: blockNumber } = useBlockNumber({ watch: true });
  const { openConnectModal } = useConnectModal();
  const { disconnect } = useDisconnect();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);

  // Expected chain IDs from env
  const expectedChainId = parseInt(process.env.NEXT_PUBLIC_AETHELRED_CHAIN_ID || '123456');
  const expectedTestnetId = parseInt(process.env.NEXT_PUBLIC_AETHELRED_TESTNET_CHAIN_ID || '123457');
  const isWrongNetwork = isConnected && chainId !== expectedChainId && chainId !== expectedTestnetId;

  const wallet: WalletState = useMemo(() => ({
    connected: isConnected,
    address: address || '',
    balance: balanceData ? Number(balanceData.formatted) : 0,
    isConnecting,
    isWrongNetwork,
    chainId,
  }), [isConnected, address, balanceData, isConnecting, isWrongNetwork, chainId]);

  const realTime: RealTimeState = useMemo(() => ({
    blockHeight: blockNumber ? Number(blockNumber) : 0,
    lastBlockTime: Date.now(),
  }), [blockNumber]);

  const addNotification = useCallback((n: Omit<Notification, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const notification = { ...n, id };
    setNotifications(prev => [...prev, notification]);
    const duration = n.duration || 5000;
    setTimeout(() => {
      setNotifications(prev => prev.filter(item => item.id !== id));
    }, duration);
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const disconnectWallet = useCallback(() => {
    disconnect();
  }, [disconnect]);

  // Cmd+K search shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const value = useMemo(() => ({
    web3Ready: true,
    wallet,
    realTime,
    notifications,
    addNotification,
    removeNotification,
    searchOpen,
    setSearchOpen,
    openConnectModal: openConnectModal ?? undefined,
    disconnectWallet,
  }), [wallet, realTime, notifications, addNotification, removeNotification, searchOpen, openConnectModal, disconnectWallet]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
