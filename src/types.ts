export interface ChainConfig {
  id: number;
  name: string;
  nameZh: string;
  nativeSymbol: string;
  rpcUrl: string;
  fallbackRpcs: string[];
  explorerUrl: string;
  seaDropAddress: string;
  iconColor: string;
  isTestnet?: boolean;
}

export interface PublicDropData {
  mintPrice: string; // in wei (string for safe serialization)
  mintPriceFormatted: string; // in ETH
  startTime: number; // unix timestamp in seconds
  endTime: number;
  maxTotalMintableByWallet: number;
  feeBps: number;
  restrictFeeRecipients: boolean;
  feeRecipient: string;
  allowedFeeRecipients?: string[];
  isFetched: boolean;
  isActive: boolean;
  isUpcoming: boolean;
  isEnded: boolean;
  timeRemainingSeconds: number;
}

export interface WalletAccount {
  id: string;
  address: string;
  privateKey?: string;
  type: 'injected' | 'private_key' | 'generated';
  balanceWei: string;
  balanceFormatted: string;
  status: 'idle' | 'simulating' | 'ready' | 'pending' | 'success' | 'failed';
  lastTxHash?: string;
  errorMessage?: string;
  selected: boolean;
}

export type GasPreset = 'standard' | 'fast' | 'sniper' | 'custom';

export interface GasConfig {
  preset: GasPreset;
  maxFeePerGasGwei: number;
  maxPriorityFeePerGasGwei: number;
  gasLimitMultiplier: number;
}

export interface SniperConfig {
  mode: 'instant' | 'scheduled';
  targetTimestamp: number;
  triggerAdvanceMs: number;
  preSign: boolean;
  quantityPerWallet: number;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  level: 'info' | 'success' | 'warn' | 'error' | 'sniper';
  text: string;
  txHash?: string;
  walletAddress?: string;
}

export interface SimulationResult {
  walletAddress: string;
  success: boolean;
  gasEstimated?: string;
  totalCostEth?: string;
  errorMessage?: string;
}
