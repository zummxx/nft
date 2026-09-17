/**
 * Etherscan API V2 Unified Multichain NFT Query Utility
 * Official Docs: https://docs.etherscan.io/endpoint-overview & https://docs.etherscan.io/v2-migration
 *
 * Etherscan API V2 provides a single unified endpoint across 60+ EVM chains:
 * https://api.etherscan.io/v2/api?chainid={chainId}&module=account&action=tokennfttx...
 *
 * Supported chains in V2 include:
 * - Arc Network (ChainId: 5042)
 * - Robinhood Chain (ChainId: 4663)
 * - Ethereum Mainnet (ChainId: 1)
 * - Sepolia Testnet (ChainId: 11155111)
 * - Base (ChainId: 8453)
 * - Arbitrum One (ChainId: 42161)
 * - Optimism (ChainId: 10)
 * - Polygon (ChainId: 137)
 * - BNB Smart Chain (ChainId: 56)
 * - Linea, Blast, Avalanche, etc.
 */

const ETHERSCAN_STORAGE_KEY = 'etherscan_api_key';

export function getSavedEtherscanApiKey(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(ETHERSCAN_STORAGE_KEY) || '';
}

export function saveEtherscanApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  if (key && key.trim()) {
    localStorage.setItem(ETHERSCAN_STORAGE_KEY, key.trim());
  } else {
    localStorage.removeItem(ETHERSCAN_STORAGE_KEY);
  }
}

export interface EtherscanNftTx {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  to: string;
  contractAddress: string;
  tokenID: string;
  tokenName?: string;
  tokenSymbol?: string;
  tokenDecimal?: string;
}

export interface Etherscan1155Tx {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  to: string;
  contractAddress: string;
  tokenID: string;
  tokenValue: string;
}

// Known chains natively supported by Etherscan API V2
export const ETHERSCAN_V2_CHAINS: Record<number, { name: string; explorer: string }> = {
  5042: { name: 'Arc Mainnet', explorer: 'https://arc.etherscan.io' },
  4663: { name: 'Robinhood Chain', explorer: 'https://robin.etherscan.io' },
  1: { name: 'Ethereum Mainnet', explorer: 'https://etherscan.io' },
  11155111: { name: 'Sepolia Testnet', explorer: 'https://sepolia.etherscan.io' },
  8453: { name: 'Base Mainnet', explorer: 'https://basescan.org' },
  42161: { name: 'Arbitrum One', explorer: 'https://arbiscan.io' },
  10: { name: 'OP Mainnet', explorer: 'https://optimistic.etherscan.io' },
  137: { name: 'Polygon Mainnet', explorer: 'https://polygonscan.com' },
  56: { name: 'BNB Smart Chain', explorer: 'https://bscscan.com' },
  59144: { name: 'Linea Mainnet', explorer: 'https://lineascan.build' },
  81457: { name: 'Blast Mainnet', explorer: 'https://blastscan.io' },
};

/**
 * Check if the chain is supported by Etherscan API V2 or an explorer API
 */
export function isEtherscanSupported(chainId: number): boolean {
  return chainId in ETHERSCAN_V2_CHAINS;
}

// In-memory cache to avoid duplicate calls within the same session (TTL: 60s)
interface CacheItem {
  timestamp: number;
  data: { tokenIds: string[]; totalBalance: number; source: 'etherscan_v2' | 'blockscout' };
}
const etherscanCache = new Map<string, CacheItem>();

// Global rate limiting queue for Etherscan requests
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 400; // ~2.5 req/s max default to respect rate limits

async function throttleRequest(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

/**
 * Query ERC721 NFT transfers using Etherscan API V2 (or Blockscout for Ink)
 * Includes 3-second rate limit backoff and auto-retry
 */
export async function queryWalletErc721Tokens(
  chainId: number,
  contractAddress: string,
  walletAddress: string,
  apiKey?: string,
  onRateLimitWait?: (seconds: number) => void
): Promise<{ tokenIds: string[]; totalBalance: number; source: 'etherscan_v2' | 'blockscout' } | null> {
  const normContract = contractAddress.trim().toLowerCase();
  const normWallet = walletAddress.trim().toLowerCase();
  const cacheKey = `${chainId}_${normContract}_${normWallet}`;

  // Check cache first
  const cached = etherscanCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 60_000) {
    return cached.data;
  }

  let isBlockscout = false;
  let url: string;

  if (chainId === 57073) {
    // Ink uses Blockscout explorer API
    url = `https://explorer.inkonchain.com/api?module=account&action=tokennfttx&contractaddress=${normContract}&address=${normWallet}&page=1&offset=100`;
    isBlockscout = true;
  } else {
    // Standard Etherscan API V2 Unified Endpoint
    const keyParam = apiKey && apiKey.trim() ? `&apikey=${apiKey.trim()}` : '';
    url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=account&action=tokennfttx&contractaddress=${normContract}&address=${normWallet}&page=1&offset=100&sort=desc${keyParam}`;
  }

  // Auto-retry with 3-second backoff if rate limited
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await throttleRequest();

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 9000);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      // HTTP 429 Too Many Requests
      if (res.status === 429) {
        if (attempt < maxAttempts) {
          if (onRateLimitWait) onRateLimitWait(3);
          await new Promise(r => setTimeout(r, 3100)); // 自动等待 3 秒后重试
          continue;
        }
        return null;
      }

      if (!res.ok) {
        return null;
      }

      const data = await res.json();

      // Check if Etherscan returned "Max rate limit reached" in JSON body
      const resStr = typeof data.result === 'string' ? data.result : '';
      const msgStr = typeof data.message === 'string' ? data.message : '';
      const isRateLimited =
        resStr.toLowerCase().includes('max rate limit') ||
        msgStr.toLowerCase().includes('rate limit') ||
        resStr.toLowerCase().includes('rate limit');

      if (isRateLimited) {
        if (attempt < maxAttempts) {
          if (onRateLimitWait) onRateLimitWait(3);
          // Etherscan API 3秒频控限制：安全退避等待 3 秒后再次尝试
          await new Promise(r => setTimeout(r, 3100));
          continue;
        }
        return null;
      }

      // Check for empty or standard error response
      if (data.status !== '1' || !Array.isArray(data.result)) {
        if (data.message === 'No transactions found') {
          const emptyResult = { tokenIds: [], totalBalance: 0, source: isBlockscout ? ('blockscout' as const) : ('etherscan_v2' as const) };
          etherscanCache.set(cacheKey, { timestamp: Date.now(), data: emptyResult });
          return emptyResult;
        }
        return null;
      }

      // Process transactions sequentially to compute active ownership
      const txs: EtherscanNftTx[] = [...data.result].reverse();
      const heldTokens = new Set<string>();

      for (const tx of txs) {
        if (tx.contractAddress && tx.contractAddress.toLowerCase() !== normContract) {
          continue;
        }
        const tid = tx.tokenID?.toString();
        if (!tid) continue;

        const from = tx.from?.toLowerCase();
        const to = tx.to?.toLowerCase();

        if (to === normWallet) {
          heldTokens.add(tid);
        } else if (from === normWallet) {
          heldTokens.delete(tid);
        }
      }

      const tokenIds = Array.from(heldTokens);
      const result = {
        tokenIds,
        totalBalance: tokenIds.length,
        source: isBlockscout ? ('blockscout' as const) : ('etherscan_v2' as const)
      };

      // Save to cache
      etherscanCache.set(cacheKey, { timestamp: Date.now(), data: result });
      return result;
    } catch {
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      return null;
    }
  }

  return null;
}

/**
 * Batch query across multiple wallets using Etherscan API with rate-limit throttling
 * (Etherscan free tier: up to 5 requests per second)
 */
export async function batchQueryEtherscanTokens(
  chainId: number,
  contractAddress: string,
  walletAddresses: string[],
  apiKey?: string,
  onProgress?: (index: number, total: number, result: { address: string; tokenIds: string[] } | null) => void
): Promise<Map<string, string[]>> {
  const results = new Map<string, string[]>();
  const delayMs = apiKey ? 220 : 350; // Throttle to stay within 5 req/s

  for (let i = 0; i < walletAddresses.length; i++) {
    const address = walletAddresses[i];
    try {
      const res = await queryWalletErc721Tokens(chainId, contractAddress, address, apiKey);
      if (res) {
        results.set(address.toLowerCase(), res.tokenIds);
        if (onProgress) onProgress(i + 1, walletAddresses.length, { address, tokenIds: res.tokenIds });
      } else {
        if (onProgress) onProgress(i + 1, walletAddresses.length, null);
      }
    } catch {
      if (onProgress) onProgress(i + 1, walletAddresses.length, null);
    }

    // Respect rate limit between requests
    if (i < walletAddresses.length - 1) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  return results;
}

/**
 * Single-shot Contract Sweep Discovery:
 * Instead of querying 50 wallets individually (which would trigger rate limit waits),
 * we query the contract's recent NFT transfers in a single shot, and map out tokens
 * for all target wallets simultaneously in memory!
 */
export async function queryContractTokensForWallets(
  chainId: number,
  contractAddress: string,
  walletAddresses: string[],
  apiKey?: string
): Promise<Map<string, string[]> | null> {
  if (walletAddresses.length === 0) return new Map();
  const targetSet = new Set(walletAddresses.map(a => a.trim().toLowerCase()));
  const normContract = contractAddress.trim().toLowerCase();

  try {
    let url: string;
    let isBlockscout = false;
    if (chainId === 57073) {
      url = `https://explorer.inkonchain.com/api?module=account&action=tokennfttx&contractaddress=${normContract}&page=1&offset=1000`;
      isBlockscout = true;
    } else {
      const keyParam = apiKey && apiKey.trim() ? `&apikey=${apiKey.trim()}` : '';
      url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=account&action=tokennfttx&contractaddress=${normContract}&page=1&offset=1000&sort=desc${keyParam}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== '1' || !Array.isArray(data.result)) return null;

    // Map of wallet -> Set of tokenIds
    const walletTokens = new Map<string, Set<string>>();
    for (const addr of targetSet) {
      walletTokens.set(addr, new Set());
    }

    const txs: EtherscanNftTx[] = [...data.result].reverse();
    for (const tx of txs) {
      if (tx.contractAddress && tx.contractAddress.toLowerCase() !== normContract) continue;
      const tid = tx.tokenID?.toString();
      if (!tid) continue;
      const from = tx.from?.toLowerCase();
      const to = tx.to?.toLowerCase();

      if (to && targetSet.has(to)) {
        walletTokens.get(to)?.add(tid);
      }
      if (from && targetSet.has(from)) {
        walletTokens.get(from)?.delete(tid);
      }
    }

    const resultMap = new Map<string, string[]>();
    for (const [addr, tokenSet] of walletTokens.entries()) {
      const tokenIds = Array.from(tokenSet);
      resultMap.set(addr, tokenIds);
      // Pre-warm individual cache as well
      const cacheKey = `${chainId}_${normContract}_${addr}`;
      etherscanCache.set(cacheKey, {
        timestamp: Date.now(),
        data: {
          tokenIds,
          totalBalance: tokenIds.length,
          source: isBlockscout ? ('blockscout' as const) : ('etherscan_v2' as const)
        }
      });
    }

    return resultMap;
  } catch {
    return null;
  }
}
