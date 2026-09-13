import { ethers } from 'ethers';
import { ChainConfig, PublicDropData, WalletAccount, GasConfig, SimulationResult } from '../types';
import { SEADROP_ABI, ERC721_MINIMAL_ABI } from '../constants/chains';
import { decodeContractError } from './errorDecoder';

// OpenSea 官方标准 SeaDrop 协议手续费接收地址
export const DEFAULT_OPENSEA_FEE_RECIPIENT = '0x0000a26b00c1F0DF003000390027140000fAa719';

export function getProvider(chain: ChainConfig, customRpc?: string): ethers.JsonRpcProvider {
  const url = customRpc && customRpc.trim().length > 0 ? customRpc.trim() : chain.rpcUrl;
  return new ethers.JsonRpcProvider(url, {
    chainId: chain.id,
    name: chain.name,
  });
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

  const provider = getProvider(chain, customRpc);
  
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
  
  try {
    const [dropRaw, feeRecipientRaw] = await Promise.all([
      seaDropContract.getPublicDrop(contractAddress),
      seaDropContract.getFeeRecipient(contractAddress).catch(() => ethers.ZeroAddress)
    ]);

    const mintPrice = dropRaw[0] !== undefined ? BigInt(dropRaw[0].toString()) : 0n;
    const startTime = dropRaw[1] ? Number(dropRaw[1]) : 0;
    const endTime = dropRaw[2] ? Number(dropRaw[2]) : 0;
    const maxTotalMintableByWallet = dropRaw[3] ? Number(dropRaw[3]) : 0;
    const feeBps = dropRaw[4] ? Number(dropRaw[4]) : 0;
    const restrictFeeRecipients = Boolean(dropRaw[5]);

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
        isFetched: true,
        isActive,
        isUpcoming,
        isEnded,
        timeRemainingSeconds
      }
    };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    if (errorMsg.includes('BAD_DATA') || errorMsg.includes('missing revert data')) {
      throw new Error(`无法从 SeaDrop (${formatAddress(chain.seaDropAddress)}) 查询该合约。请确认该合约是否支持 SeaDrop 协议，或检查所选网络是否正确。`);
    }
    throw new Error(`SeaDrop 查询失败: ${errorMsg}`);
  }
}

export async function fetchWalletBalance(
  address: string,
  chain: ChainConfig,
  customRpc?: string
): Promise<{ wei: string; formatted: string }> {
  try {
    const provider = getProvider(chain, customRpc);
    const balance = await provider.getBalance(address);
    return {
      wei: balance.toString(),
      formatted: formatEtherTrimmed(balance)
    };
  } catch (err) {
    console.error('Fetch balance error:', err);
    return { wei: '0', formatted: '0' };
  }
}

export function resolveFeeRecipient(candidate?: string): string {
  if (
    !candidate ||
    candidate === ethers.ZeroAddress ||
    candidate.toLowerCase() === ethers.ZeroAddress.toLowerCase() ||
    candidate.trim().length === 0
  ) {
    return DEFAULT_OPENSEA_FEE_RECIPIENT;
  }
  try {
    return ethers.getAddress(candidate.trim());
  } catch {
    return DEFAULT_OPENSEA_FEE_RECIPIENT;
  }
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
    const feeRecipient = resolveFeeRecipient(dropData.feeRecipient);
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
    const feeRecipient = resolveFeeRecipient(dropData.feeRecipient);
    const minterIfNotPayer = ethers.ZeroAddress;

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

      // Ensure maxFee is not below network baseFee
      const networkBaseFee = feeData.maxFeePerGas || feeData.gasPrice || ethers.parseUnits('0.1', 'gwei');
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
