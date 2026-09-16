import { ethers } from 'ethers';
import { ChainConfig, PublicDropData, WalletAccount, GasConfig, SimulationResult } from '../types';
import { SEADROP_ABI, ERC721_MINIMAL_ABI } from '../constants/chains';
import { decodeContractError } from './errorDecoder';

// OpenSea 官方标准 SeaDrop 协议手续费接收地址
export const DEFAULT_OPENSEA_FEE_RECIPIENT = '0x0000a26b00c1F0DF003000390027140000fAa719';

/**
 * 解析可能包含多个 URL 的 RPC 配置字符串（支持换行、逗号或分号分隔，支持双 Alchemy 分流）
 */
export function parseRpcUrls(customRpc?: string): string[] {
  if (!customRpc) return [];
  return customRpc
    .split(/[\n,;]+/)
    .map(s => s.trim())
    .filter(s => s.startsWith('http://') || s.startsWith('https://'));
}

export function getProvider(chain: ChainConfig, customRpc?: string): ethers.JsonRpcProvider {
  const parsedUrls = parseRpcUrls(customRpc);
  const url = parsedUrls.length > 0 ? parsedUrls[0] : (customRpc && customRpc.trim().length > 0 ? customRpc.trim() : chain.rpcUrl);
  return new ethers.JsonRpcProvider(url, {
    chainId: chain.id,
    name: chain.name,
  });
}

export function getCandidateProviders(chain: ChainConfig, customRpc?: string): ethers.JsonRpcProvider[] {
  const urls: string[] = [];
  const parsedUrls = parseRpcUrls(customRpc);
  if (parsedUrls.length > 0) {
    for (const u of parsedUrls) {
      if (!urls.includes(u)) urls.push(u);
    }
  } else if (customRpc && customRpc.trim().length > 0 && !urls.includes(customRpc.trim())) {
    urls.push(customRpc.trim());
  }

  if (!urls.includes(chain.rpcUrl)) {
    urls.push(chain.rpcUrl);
  }
  if (chain.fallbackRpcs) {
    for (const fb of chain.fallbackRpcs) {
      if (fb && !urls.includes(fb)) {
        urls.push(fb);
      }
    }
  }

  return urls.map(url => new ethers.JsonRpcProvider(url, {
    chainId: chain.id,
    name: chain.name,
  }));
}

export function formatAddress(address: string): string {
  if (!address || address.length < 10) return address || '';
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

export function formatEtherTrimmed(wei: string | bigint, decimals: number = 4): string {
  try {
    const formatted = ethers.formatEther(wei);
    const num = parseFloat(formatted);
    if (num === 0) return '0';
    if (num < 0.0001) return '< 0.0001';
    return num.toFixed(decimals).replace(/\.?0+$/, '');
  } catch {
    return '0';
  }
}

export interface ContractDetails {
  name: string;
  symbol: string;
  dropData: PublicDropData;
}

export async function fetchContractDetails(
  contractAddress: string,
  chain: ChainConfig,
  customRpc?: string
): Promise<ContractDetails> {
  if (!ethers.isAddress(contractAddress)) {
    throw new Error('无效的以太坊合约地址格式');
  }

  const providers = getCandidateProviders(chain, customRpc);
  let lastError: any = null;

  for (const provider of providers) {
    try {
      // 1. Fetch NFT details (name, symbol)
      let nftName = '未知 NFT';
      let nftSymbol = 'NFT';
      try {
        const nftContract = new ethers.Contract(contractAddress, ERC721_MINIMAL_ABI, provider);
        const [name, symbol] = await Promise.allSettled([
          nftContract.name(),
          nftContract.symbol()
        ]);
        if (name.status === 'fulfilled') nftName = name.value;
        if (symbol.status === 'fulfilled') nftSymbol = symbol.value;
      } catch {
        // Non-standard or protected contract
      }

      // 2. Fetch SeaDrop details
      const seaDropContract = new ethers.Contract(chain.seaDropAddress, SEADROP_ABI, provider);
      
      const [dropRaw, feeRecipientRaw, allowedFeeRecipientsRaw] = await Promise.all([
        seaDropContract.getPublicDrop(contractAddress),
        seaDropContract.getFeeRecipient(contractAddress).catch(() => ethers.ZeroAddress),
        seaDropContract.getAllowedFeeRecipients(contractAddress).catch(() => [] as string[])
      ]);

      const mintPrice = dropRaw[0] !== undefined ? BigInt(dropRaw[0].toString()) : 0n;
      const startTime = dropRaw[1] ? Number(dropRaw[1]) : 0;
      const endTime = dropRaw[2] ? Number(dropRaw[2]) : 0;
      const maxTotalMintableByWallet = dropRaw[3] ? Number(dropRaw[3]) : 0;
      const feeBps = dropRaw[4] ? Number(dropRaw[4]) : 0;
      const restrictFeeRecipients = Boolean(dropRaw[5]);

      let allowedFeeRecipients: string[] = [];
      if (Array.isArray(allowedFeeRecipientsRaw)) {
        allowedFeeRecipients = allowedFeeRecipientsRaw.map(a => String(a));
      }

      const nowSeconds = Math.floor(Date.now() / 1000);
      const isActive = startTime > 0 && nowSeconds >= startTime && (endTime === 0 || nowSeconds < endTime);
      const isUpcoming = startTime > 0 && nowSeconds < startTime;
      const isEnded = endTime > 0 && nowSeconds >= endTime;
      const timeRemainingSeconds = isUpcoming ? startTime - nowSeconds : 0;

      return {
        name: nftName,
        symbol: nftSymbol,
        dropData: {
          mintPrice: mintPrice.toString(),
          mintPriceFormatted: ethers.formatEther(mintPrice),
          startTime,
          endTime,
          maxTotalMintableByWallet,
          feeBps,
          restrictFeeRecipients,
          feeRecipient: feeRecipientRaw || ethers.ZeroAddress,
          allowedFeeRecipients,
          isFetched: true,
          isActive,
          isUpcoming,
          isEnded,
          timeRemainingSeconds
        }
      };
    } catch (err: any) {
      lastError = err;
      const errorMsg = err?.message || String(err);
      if (errorMsg.includes('BAD_DATA') || errorMsg.includes('missing revert data')) {
        // Contract does not support SeaDrop or not deployed on this network
        break;
      }
      // Network/CORS/525 error, try next fallback provider
      continue;
    }
  }

  const errorMsg = lastError?.message || String(lastError);
  if (errorMsg.includes('BAD_DATA') || errorMsg.includes('missing revert data')) {
    throw new Error(`无法从 SeaDrop (${formatAddress(chain.seaDropAddress)}) 查询该合约。请确认该合约是否支持 SeaDrop 协议，或检查所选网络是否正确。`);
  }
  if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError') || errorMsg.includes('fetch failed')) {
    throw new Error(`无法连接至 ${chain.nameZh} RPC 节点 (Failed to fetch)。原因：浏览器直连公共节点受网络防火墙/Cloudflare盾拦截或代理未生效。请检查网络代理，或在右上角「RPC 设置」配置私有节点。`);
  }
  throw new Error(`SeaDrop 查询失败: ${errorMsg} (已尝试官方及备用节点，建议在右上角「RPC 设置」配置私有节点)`);
}

export async function fetchWalletBalance(
  address: string,
  chain: ChainConfig,
  customRpc?: string
): Promise<{ wei: string; formatted: string }> {
  const providers = getCandidateProviders(chain, customRpc);
  for (const provider of providers) {
    try {
      const balance = await provider.getBalance(address);
      return {
        wei: balance.toString(),
        formatted: formatEtherTrimmed(balance)
      };
    } catch {
      continue;
    }
  }
  return { wei: '0', formatted: '0' };
}

export async function determineWorkingFeeRecipient(
  seaDrop: ethers.Contract,
  contractAddress: string,
  dropData: PublicDropData,
  walletAddress: string,
  quantity: number,
  totalValue: bigint
): Promise<string> {
  const candidates: string[] = [];

  // 1. Prefer allowed fee recipients configured on the contract
  if (dropData.allowedFeeRecipients && dropData.allowedFeeRecipients.length > 0) {
    for (const a of dropData.allowedFeeRecipients) {
      if (ethers.isAddress(a) && !candidates.includes(a)) {
        candidates.push(a);
      }
    }
  }

  // 2. Contract's getFeeRecipient
  if (
    dropData.feeRecipient &&
    ethers.isAddress(dropData.feeRecipient) &&
    dropData.feeRecipient !== ethers.ZeroAddress &&
    !candidates.includes(dropData.feeRecipient)
  ) {
    candidates.push(dropData.feeRecipient);
  }

  // 3. ZeroAddress (allowed when feeBps is 0 or fee recipient not restricted)
  if (!candidates.includes(ethers.ZeroAddress)) {
    candidates.push(ethers.ZeroAddress);
  }

  // 4. Default OpenSea Fee Recipient fallback
  if (!candidates.includes(DEFAULT_OPENSEA_FEE_RECIPIENT)) {
    candidates.push(DEFAULT_OPENSEA_FEE_RECIPIENT);
  }

  // If there's only 1 candidate, return it
  if (candidates.length === 1) return candidates[0];

  // Try each candidate with estimateGas to automatically match the allowed one
  for (const candidate of candidates) {
    try {
      await seaDrop.mintPublic.estimateGas(
        contractAddress,
        candidate,
        ethers.ZeroAddress,
        quantity,
        {
          from: walletAddress,
          value: totalValue
        }
      );
      return candidate;
    } catch (err: any) {
      const reason = parseRevertReason(err);
      if (
        reason.includes('FeeRecipientNotAllowed') ||
        reason.includes('FeeRecipientCannotBeZeroAddress') ||
        reason.includes('FeeRecipientNotPresent')
      ) {
        // Continue to test the next candidate
        continue;
      }
      // If error is for another condition (e.g. NotActive), feeRecipient is acceptable
      return candidate;
    }
  }

  return candidates[0];
}

export async function simulateMint(
  wallet: WalletAccount,
  contractAddress: string,
  quantity: number,
  dropData: PublicDropData,
  chain: ChainConfig,
  customRpc?: string
): Promise<SimulationResult> {
  try {
    const provider = getProvider(chain, customRpc);
    const seaDrop = new ethers.Contract(chain.seaDropAddress, SEADROP_ABI, provider);
    
    const mintPriceWei = BigInt(dropData.mintPrice);
    const totalValue = mintPriceWei * BigInt(quantity);
    const minterIfNotPayer = ethers.ZeroAddress;

    // Check balance first
    const balance = BigInt(wallet.balanceWei || '0');
    if (balance < totalValue) {
      return {
        walletAddress: wallet.address,
        success: false,
        errorMessage: `余额不足: 需要至少 ${ethers.formatEther(totalValue)} ${chain.nativeSymbol} (当前 ${wallet.balanceFormatted})`
      };
    }

    // Automatically resolve working feeRecipient across chains
    const feeRecipient = await determineWorkingFeeRecipient(
      seaDrop,
      contractAddress,
      dropData,
      wallet.address,
      quantity,
      totalValue
    );

    // Call static simulation
    let gasEstimated = 180000n;
    try {
      gasEstimated = await seaDrop.mintPublic.estimateGas(
        contractAddress,
        feeRecipient,
        minterIfNotPayer,
        quantity,
        {
          from: wallet.address,
          value: totalValue
        }
      );
    } catch (gasErr: any) {
      // Decode revert reason if any
      const reason = parseRevertReason(gasErr);
      return {
        walletAddress: wallet.address,
        success: false,
        errorMessage: `模拟调用 Revert 失败: ${reason}`
      };
    }

    return {
      walletAddress: wallet.address,
      success: true,
      gasEstimated: gasEstimated.toString(),
      totalCostEth: ethers.formatEther(totalValue)
    };
  } catch (err: any) {
    return {
      walletAddress: wallet.address,
      success: false,
      errorMessage: err?.message || '模拟未知异常'
    };
  }
}

export async function executeMint(
  wallet: WalletAccount,
  contractAddress: string,
  quantity: number,
  dropData: PublicDropData,
  gasConfig: GasConfig,
  chain: ChainConfig,
  customRpc?: string
): Promise<{ txHash: string; receipt: ethers.TransactionReceipt | null }> {
  try {
    const mintPriceWei = BigInt(dropData.mintPrice);
    const totalValue = mintPriceWei * BigInt(quantity);
    const minterIfNotPayer = ethers.ZeroAddress;

    const queryProvider = getProvider(chain, customRpc);
    const querySeaDrop = new ethers.Contract(chain.seaDropAddress, SEADROP_ABI, queryProvider);

    const feeRecipient = await determineWorkingFeeRecipient(
      querySeaDrop,
      contractAddress,
      dropData,
      wallet.address,
      quantity,
      totalValue
    );

    if (wallet.type === 'injected') {
      // Injected provider (MetaMask, OKX, etc.)
      if (typeof window === 'undefined' || !(window as any).ethereum) {
        throw new Error('未检测到浏览器 Web3 钱包 (MetaMask/OKX)');
      }
      const browserProvider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await browserProvider.getSigner();
      
      // Ensure network matches
      const network = await browserProvider.getNetwork();
      if (Number(network.chainId) !== chain.id) {
        try {
          await (window as any).ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${chain.id.toString(16)}` }]
          });
        } catch (switchError: any) {
          throw new Error(`请将钱包网络切换至 ${chain.name} (ChainID: ${chain.id})`);
        }
      }

      const seaDrop = new ethers.Contract(chain.seaDropAddress, SEADROP_ABI, signer);
      const tx = await seaDrop.mintPublic(
        contractAddress,
        feeRecipient,
        minterIfNotPayer,
        quantity,
        {
          value: totalValue
        }
      );
      const receipt = await tx.wait();
      return { txHash: tx.hash, receipt };
    } else {
      // Private Key wallet execution
      if (!wallet.privateKey) {
        throw new Error('钱包缺少私钥');
      }

      const provider = getProvider(chain, customRpc);
      const signerWallet = new ethers.Wallet(wallet.privateKey, provider);
      const seaDrop = new ethers.Contract(chain.seaDropAddress, SEADROP_ABI, signerWallet);

      // Build gas params
      const feeData = await provider.getFeeData();
      let maxPriorityFee = feeData.maxPriorityFeePerGas || ethers.parseUnits('1.5', 'gwei');
      let maxFee = feeData.maxFeePerGas || (feeData.gasPrice ? feeData.gasPrice * 2n : ethers.parseUnits('20', 'gwei'));

      if (gasConfig.preset === 'sniper' || gasConfig.preset === 'custom') {
        maxPriorityFee = ethers.parseUnits(gasConfig.maxPriorityFeePerGasGwei.toString(), 'gwei');
        maxFee = ethers.parseUnits(gasConfig.maxFeePerGasGwei.toString(), 'gwei');
      } else if (gasConfig.preset === 'fast') {
        maxPriorityFee = (maxPriorityFee * 15n) / 10n;
        maxFee = (maxFee * 15n) / 10n;
      }

      // Ensure Arc Network (id: 5042) meets minimum 20 Gwei threshold (0.00000002 USDC)
      const isArc = chain.id === 5042;
      const minArcFee = ethers.parseUnits('20', 'gwei');

      if (isArc) {
        if (maxPriorityFee < ethers.parseUnits('1', 'gwei')) {
          maxPriorityFee = ethers.parseUnits('1', 'gwei');
        }
        if (maxFee < minArcFee) {
          maxFee = minArcFee;
        }
      }

      // Ensure maxFee is not below network baseFee
      const networkBaseFee = feeData.maxFeePerGas || feeData.gasPrice || (isArc ? minArcFee : ethers.parseUnits('0.1', 'gwei'));
      if (maxFee < networkBaseFee) {
        maxFee = (networkBaseFee * 13n) / 10n;
      }
      if (maxPriorityFee > maxFee) {
        maxPriorityFee = maxFee / 2n;
      }

      // Estimate gas limit
      let gasLimit = 220000n;
      try {
        const estimated = await seaDrop.mintPublic.estimateGas(
          contractAddress,
          feeRecipient,
          minterIfNotPayer,
          quantity,
          {
            value: totalValue
          }
        );
        gasLimit = (estimated * BigInt(Math.round(gasConfig.gasLimitMultiplier * 100))) / 100n;
      } catch (estErr: any) {
        const decodedEst = decodeContractError(estErr);
        if (decodedEst.selector) {
          throw new Error(`预检失败: ${decodedEst.reason}`);
        }
        gasLimit = 260000n;
      }

      const tx = await seaDrop.mintPublic(
        contractAddress,
        feeRecipient,
        minterIfNotPayer,
        quantity,
        {
          value: totalValue,
          gasLimit,
          maxFeePerGas: maxFee,
          maxPriorityFeePerGas: maxPriorityFee
        }
      );

      const receipt = await tx.wait();
      return { txHash: tx.hash, receipt };
    }
  } catch (err: any) {
    const reason = parseRevertReason(err);
    const wrapped: any = new Error(reason);
    if (err.receipt?.hash || err.transaction?.hash || err.hash) {
      wrapped.txHash = err.receipt?.hash || err.transaction?.hash || err.hash;
    }
    throw wrapped;
  }
}

function parseRevertReason(error: any): string {
  if (!error) return '未知错误';
  
  // 使用专业解码器解析 4-byte 错误签名与错误参数
  const decoded = decodeContractError(error);
  if (decoded.tip) {
    return `${decoded.reason} (诊断建议: ${decoded.tip})`;
  }
  return decoded.reason;
}
