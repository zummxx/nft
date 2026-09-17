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

/**
 * Query ERC721 NFT transfers using Etherscan API V2 (or Blockscout for Ink)
 */
export async function queryWalletErc721Tokens(
  chainId: number,
  contractAddress: string,
  walletAddress: string,
  apiKey?: string
): Promise<{ tokenIds: string[]; totalBalance: number; source: 'etherscan_v2' | 'blockscout' } | null> {
  const normContract = contractAddress.trim().toLowerCase();
  const normWallet = walletAddress.trim().toLowerCase();

  try {
    let url: string;
    let isBlockscout = false;

    if (chainId === 57073) {
      // Ink uses Blockscout explorer API
      url = `https://explorer.inkonchain.com/api?module=account&action=tokennfttx&contractaddress=${normContract}&address=${normWallet}&page=1&offset=100`;
      isBlockscout = true;
    } else {
      // Standard Etherscan API V2 Unified Endpoint
      const keyParam = apiKey && apiKey.trim() ? `&apikey=${apiKey.trim()}` : '';
      url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=account&action=tokennfttx&contractaddress=${normContract}&address=${normWallet}&page=1&offset=100&sort=desc${keyParam}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      return null;
    }

    const data = await res.json();

    // Check for Etherscan error response
    if (data.status !== '1' || !Array.isArray(data.result)) {
      // e.g. "No transactions found" -> empty balance
      if (data.message === 'No transactions found') {
        return { tokenIds: [], totalBalance: 0, source: isBlockscout ? 'blockscout' : 'etherscan_v2' };
      }
      return null;
    }

    // Process transactions sequentially to compute active ownership
    // Sort chronological: older first so inbound is followed by outbound
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
    return {
      tokenIds,
      totalBalance: tokenIds.length,
      source: isBlockscout ? 'blockscout' : 'etherscan_v2'
    };
  } catch {
    return null;
  }
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
