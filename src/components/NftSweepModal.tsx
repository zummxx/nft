import React, { useState, useEffect } from 'react';
import { X, Send, ShieldAlert, CheckCircle2, AlertTriangle, RefreshCw, ArrowRight, Wallet, Check, ExternalLink, HelpCircle } from 'lucide-react';
import { WalletAccount, ChainConfig } from '../types';
import { ethers } from 'ethers';
import { getProvider, getCandidateProviders, formatAddress } from '../utils/seadrop';

// Comprehensive ABI for checking and transferring ERC721 & ERC1155
const NFT_TRANSFER_ABI = [
  // ERC721
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
  'function balanceOf(address owner) external view returns (uint256)',
  'function ownerOf(uint256 tokenId) external view returns (address)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)',
  'function safeTransferFrom(address from, address to, uint256 tokenId) external',
  'function transferFrom(address from, address to, uint256 tokenId) external',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  // ERC1155
  'function balanceOf(address account, uint256 id) external view returns (uint256)',
  'function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data) external'
];

interface WalletNftStatus {
  wallet: WalletAccount;
  balance: number;
  tokenIds: string[];
  status: 'idle' | 'querying' | 'transferring' | 'success' | 'failed';
  txHash?: string;
  error?: string;
}

interface NftSweepModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallets: WalletAccount[];
  chain: ChainConfig;
  defaultContractAddress?: string;
  customRpc?: string;
  onAddLog: (level: 'info' | 'warn' | 'error' | 'success', text: string) => void;
}

export const NftSweepModal: React.FC<NftSweepModalProps> = ({
  isOpen,
  onClose,
  wallets,
  chain,
  defaultContractAddress = '',
  customRpc,
  onAddLog
}) => {
  const [contractAddress, setContractAddress] = useState(defaultContractAddress);
  const [recipientAddress, setRecipientAddress] = useState('');
  const [tokenType, setTokenType] = useState<'erc721' | 'erc1155'>('erc721');
  const [erc1155TokenId, setErc1155TokenId] = useState('1');

  // Scanning & Transferring states
  const [isScanning, setIsScanning] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [walletStatuses, setWalletStatuses] = useState<WalletNftStatus[]>([]);
  const [nftName, setNftName] = useState<string>('');
  const [nftSymbol, setNftSymbol] = useState<string>('');
  const [scanError, setScanError] = useState<string | null>(null);

  // Manual token ID inputs if contract doesn't support tokenOfOwnerByIndex
  const [customTokenIds, setCustomTokenIds] = useState<{ [walletId: string]: string }>({});

  useEffect(() => {
    if (defaultContractAddress && !contractAddress) {
      setContractAddress(defaultContractAddress);
    }
  }, [defaultContractAddress]);

  // Reset states on open/change
  useEffect(() => {
    if (isOpen) {
      const initial = wallets.map(w => ({
        wallet: w,
        balance: 0,
        tokenIds: [],
        status: 'idle' as const
      }));
      setWalletStatuses(initial);
      setScanError(null);
    }
  }, [isOpen, wallets]);

  if (!isOpen) return null;

  // 1. Scan balances across all wallets
  const handleScanBalances = async () => {
    if (!ethers.isAddress(contractAddress.trim())) {
      setScanError('请输入合法的 NFT 合约地址 (0x...)');
      return;
    }

    setIsScanning(true);
    setScanError(null);
    onAddLog('info', `正在扫描 ${wallets.length} 个钱包在 NFT 合约 [${formatAddress(contractAddress)}] 的持有量...`);

    try {
      const provider = getProvider(chain, customRpc);
      const contract = new ethers.Contract(contractAddress.trim(), NFT_TRANSFER_ABI, provider);

      // Attempt to get name/symbol
      try {
        const [name, sym] = await Promise.all([
          contract.name().catch(() => ''),
          contract.symbol().catch(() => '')
        ]);
        setNftName(name || '');
        setNftSymbol(sym || '');
      } catch {}

      const updatedStatuses: WalletNftStatus[] = [];

      // Get candidate providers to fallback if RPC limits queryFilter
      const candidateProviders = getCandidateProviders(chain, customRpc);
      let latestBlock = 0;
      for (const p of candidateProviders) {
        try {
          latestBlock = await p.getBlockNumber();
          if (latestBlock > 0) break;
        } catch {}
      }

      for (const w of wallets) {
        let bal = 0;
        const foundTokenIds: string[] = [];

        try {
          if (tokenType === 'erc721') {
            const b = await contract.balanceOf(w.address);
            bal = Number(b);

            // 1. First try tokenOfOwnerByIndex (Standard Enumerable)
            if (bal > 0) {
              try {
                for (let i = 0; i < Math.min(bal, 20); i++) {
                  const tid = await contract.tokenOfOwnerByIndex(w.address, i);
                  foundTokenIds.push(tid.toString());
                }
              } catch {
                // Not Enumerable - proceed to multi-strategy discovery
              }

              // 2. Transfer Event Logs auto-discovery across candidate providers
              if (foundTokenIds.length === 0 && latestBlock > 0) {
                // Try multiple block ranges (some RPCs limit to 10,000 blocks)
                const blockRanges = [10000, 30000, 80000];
                for (const p of candidateProviders) {
                  if (foundTokenIds.length >= bal) break;
                  const filterContract = new ethers.Contract(contractAddress.trim(), NFT_TRANSFER_ABI, p);

                  for (const range of blockRanges) {
                    if (foundTokenIds.length >= bal) break;
                    try {
                      const fromBlock = Math.max(0, latestBlock - range);
                      const filter = filterContract.filters.Transfer(null, w.address);
                      const events = await filterContract.queryFilter(filter, fromBlock, 'latest');

                      for (const ev of events) {
                        if ('args' in ev && ev.args) {
                          const tid = ev.args[2]?.toString();
                          if (tid && !foundTokenIds.includes(tid)) {
                            try {
                              const currentOwner = await contract.ownerOf(tid);
                              if (currentOwner.toLowerCase() === w.address.toLowerCase()) {
                                foundTokenIds.push(tid);
                                if (foundTokenIds.length >= bal) break;
                              }
                            } catch {}
                          }
                        }
                      }
                    } catch (rangeErr) {
                      // RPC returned limit error, continue trying smaller or next provider
                    }
                  }
                }
              }

              // 3. Sequential probe fallback for small collections (check first 100 or common IDs if still empty)
              if (foundTokenIds.length === 0) {
                try {
                  // Try to check totalSupply if public
                  const supplyContract = new ethers.Contract(
                    contractAddress.trim(),
                    ['function totalSupply() external view returns (uint256)'],
                    provider
                  );
                  const total = await supplyContract.totalSupply().catch(() => 0n);
                  const maxProbe = Number(total) > 0 ? Math.min(Number(total), 120) : 0;
                  if (maxProbe > 0) {
                    for (let id = 1; id <= maxProbe; id++) {
                      try {
                        const owner = await contract.ownerOf(id);
                        if (owner.toLowerCase() === w.address.toLowerCase()) {
                          foundTokenIds.push(id.toString());
                          if (foundTokenIds.length >= bal) break;
                        }
                      } catch {}
                    }
                  }
                } catch {}
              }
            }
          } else {
            // ERC1155
            const tid = erc1155TokenId.trim() || '1';
            const b = await contract.balanceOf(w.address, tid);
            bal = Number(b);
            if (bal > 0) {
              foundTokenIds.push(tid);
            }
          }

          updatedStatuses.push({
            wallet: w,
            balance: bal,
            tokenIds: foundTokenIds,
            status: 'idle'
          });
        } catch (e: any) {
          updatedStatuses.push({
            wallet: w,
            balance: 0,
            tokenIds: [],
            status: 'failed',
            error: e.message || '查询失败'
          });
        }
      }

      setWalletStatuses(updatedStatuses);
      const totalHoldings = updatedStatuses.reduce((acc, curr) => acc + curr.balance, 0);
      onAddLog('success', `扫描完毕！共发现 ${totalHoldings} 枚 NFT 分散在 ${updatedStatuses.filter(s => s.balance > 0).length} 个钱包中。`);
    } catch (err: any) {
      setScanError(err.message || '扫描合约发生异常');
      onAddLog('error', `扫描失败: ${err.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  // 2. Execute Batch Sweep (归集转账)
  const handleExecuteSweep = async () => {
    const targetRecipient = recipientAddress.trim();
    if (!ethers.isAddress(targetRecipient)) {
      alert('请输入合法的归集目标接收地址 (0x...)');
      return;
    }

    const eligibleWallets = walletStatuses.filter(s => s.balance > 0);
    if (eligibleWallets.length === 0) {
      alert('当前选中的钱包中未持有该 NFT，请先点击「扫描持有数量」。');
      return;
    }

    const confirmMsg = `确定将 ${eligibleWallets.length} 个钱包中的 NFT 全部归集转入以下目标地址吗？\n\n接收地址: ${targetRecipient}\n网络: ${chain.nameZh || chain.name}\n\n注意：每个钱包将发出独立的转账交易并扣除微量 Gas。`;
    if (!window.confirm(confirmMsg)) {
      return;
    }

    setIsExecuting(true);
    onAddLog('info', `开始执行 NFT 批量归集！目标主钱包: [${targetRecipient}]`);

    const provider = getProvider(chain, customRpc);

    for (let i = 0; i < walletStatuses.length; i++) {
      const item = walletStatuses[i];
      if (item.balance <= 0) continue;

      // Update state to transferring
      setWalletStatuses(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'transferring' } : s));

      try {
        if (!item.wallet.privateKey) {
          throw new Error('该钱包无私钥（插件钱包请在插件内手动转账）');
        }

        const signer = new ethers.Wallet(item.wallet.privateKey, provider);
        const nftContract = new ethers.Contract(contractAddress.trim(), NFT_TRANSFER_ABI, signer);

        // Determine token IDs to transfer
        let idsToTransfer: string[] = item.tokenIds;

        // If not enumerable and empty, check if user provided custom token ID
        if (idsToTransfer.length === 0) {
          const manualId = customTokenIds[item.wallet.id]?.trim();
          if (manualId) {
            idsToTransfer = manualId.split(/[,，\s]+/).filter(Boolean);
          }
        }

        // On-the-fly Transfer event lookup fallback across candidate providers before failing
        if (tokenType === 'erc721' && idsToTransfer.length === 0) {
          try {
            const candidateProviders = getCandidateProviders(chain, customRpc);
            let latestBlock = 0;
            for (const p of candidateProviders) {
              try {
                latestBlock = await p.getBlockNumber();
                if (latestBlock > 0) break;
              } catch {}
            }

            if (latestBlock > 0) {
              const ranges = [10000, 30000, 80000];
              for (const p of candidateProviders) {
                if (idsToTransfer.length >= item.balance) break;
                const pContract = new ethers.Contract(contractAddress.trim(), NFT_TRANSFER_ABI, p);
                for (const range of ranges) {
                  if (idsToTransfer.length >= item.balance) break;
                  try {
                    const fromBlock = Math.max(0, latestBlock - range);
                    const filter = pContract.filters.Transfer(null, item.wallet.address);
                    const events = await pContract.queryFilter(filter, fromBlock, 'latest');
                    for (const ev of events) {
                      if ('args' in ev && ev.args) {
                        const tid = ev.args[2]?.toString();
                        if (tid && !idsToTransfer.includes(tid)) {
                          try {
                            const currentOwner = await nftContract.ownerOf(tid);
                            if (currentOwner.toLowerCase() === item.wallet.address.toLowerCase()) {
                              idsToTransfer.push(tid);
                              if (idsToTransfer.length >= item.balance) break;
                            }
                          } catch {}
                        }
                      }
                    }
                  } catch {}
                }
              }
            }

            // Probe common / small IDs fallback
            if (idsToTransfer.length === 0) {
              try {
                const supplyContract = new ethers.Contract(
                  contractAddress.trim(),
                  ['function totalSupply() external view returns (uint256)'],
                  provider
                );
                const total = await supplyContract.totalSupply().catch(() => 0n);
                const maxProbe = Number(total) > 0 ? Math.min(Number(total), 120) : 0;
                if (maxProbe > 0) {
                  for (let id = 1; id <= maxProbe; id++) {
                    try {
                      const owner = await nftContract.ownerOf(id);
                      if (owner.toLowerCase() === item.wallet.address.toLowerCase()) {
                        idsToTransfer.push(id.toString());
                        if (idsToTransfer.length >= item.balance) break;
                      }
                    } catch {}
                  }
                }
              } catch {}
            }
          } catch {}
        }

        if (tokenType === 'erc721') {
          if (idsToTransfer.length === 0) {
            throw new Error('此合约未开源 Enumerable 索引，请在对应行手动填入 Token ID');
          }

          let lastTxHash = '';
          for (const tid of idsToTransfer) {
            onAddLog('info', `钱包 [${formatAddress(item.wallet.address)}] 正在转移 Token #${tid} -> ${formatAddress(targetRecipient)}...`);
            
            // Gas overrides
            const isArc = chain.id === 5042;
            const feeData = await provider.getFeeData();
            let maxPriority = feeData.maxPriorityFeePerGas || ethers.parseUnits(isArc ? '10' : '0.1', 'gwei');
            let maxFee = feeData.maxFeePerGas || (isArc ? ethers.parseUnits('30', 'gwei') : ethers.parseUnits('1', 'gwei'));

            const tx = await nftContract.transferFrom(item.wallet.address, targetRecipient, tid, {
              maxFeePerGas: maxFee,
              maxPriorityFeePerGas: maxPriority,
            });

            lastTxHash = tx.hash;
            onAddLog('success', `Token #${tid} 已发送广播! Hash: ${tx.hash.slice(0, 10)}...`);
            await tx.wait(1);
          }

          setWalletStatuses(prev => prev.map((s, idx) => idx === i ? {
            ...s,
            status: 'success',
            txHash: lastTxHash,
            balance: 0,
            tokenIds: []
          } : s));
          onAddLog('success', `钱包 [${formatAddress(item.wallet.address)}] 的 NFT 归集完成！`);

        } else {
          // ERC1155
          const tid = erc1155TokenId.trim() || '1';
          const transferAmount = item.balance;
          onAddLog('info', `钱包 [${formatAddress(item.wallet.address)}] 正在归集 ERC1155 #${tid} 数量: ${transferAmount}...`);

          const isArc = chain.id === 5042;
          const feeData = await provider.getFeeData();
          let maxPriority = feeData.maxPriorityFeePerGas || ethers.parseUnits(isArc ? '10' : '0.1', 'gwei');
          let maxFee = feeData.maxFeePerGas || (isArc ? ethers.parseUnits('30', 'gwei') : ethers.parseUnits('1', 'gwei'));

          const tx = await nftContract.safeTransferFrom(
            item.wallet.address,
            targetRecipient,
            tid,
            transferAmount,
            '0x',
            {
              maxFeePerGas: maxFee,
              maxPriorityFeePerGas: maxPriority,
            }
          );

          await tx.wait(1);
          setWalletStatuses(prev => prev.map((s, idx) => idx === i ? {
            ...s,
            status: 'success',
            txHash: tx.hash,
            balance: 0
          } : s));
          onAddLog('success', `钱包 [${formatAddress(item.wallet.address)}] ERC1155 归集成功！`);
        }
      } catch (err: any) {
        const errorMsg = err.reason || err.shortMessage || err.message || '转账失败';
        setWalletStatuses(prev => prev.map((s, idx) => idx === i ? {
          ...s,
          status: 'failed',
          error: errorMsg
        } : s));
        onAddLog('error', `钱包 [${formatAddress(item.wallet.address)}] 归集失败: ${errorMsg}`);
      }
    }

    setIsExecuting(false);
    onAddLog('success', '批量 NFT 归集执行完毕！');
  };

  const totalDiscoveredNfts = walletStatuses.reduce((a, b) => a + (b.balance || 0), 0);
  const totalHolders = walletStatuses.filter(w => w.balance > 0).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        id="nft-sweep-modal-container"
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                批量 NFT 归集一个地址 (NFT Batch Sweep)
              </h3>
              <p className="text-xs text-slate-400">
                将多个抢购小钱包中抢到的 NFT，一键批量转入你的主钱包或交易所归集地址
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isExecuting}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Target Recipient Input */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-semibold flex items-center justify-between">
              <span className="flex items-center gap-1 text-emerald-400">
                <Wallet className="w-3.5 h-3.5" />
                归集目标地址 (接收 NFT 的主钱包):
              </span>
              <span className="text-[11px] text-slate-500 font-normal">支持任一合法的 EVM 地址</span>
            </label>
            <input
              type="text"
              id="nft-sweep-recipient-input"
              value={recipientAddress}
              onChange={e => setRecipientAddress(e.target.value)}
              placeholder="0x... (主钱包地址)"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          {/* NFT Contract Address & Standard */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-8 space-y-1.5">
              <label className="text-slate-300 font-semibold flex items-center justify-between">
                <span>NFT 合约地址:</span>
                {nftName && (
                  <span className="text-purple-300 font-medium truncate max-w-[180px]">
                    {nftName} {nftSymbol && `(${nftSymbol})`}
                  </span>
                )}
              </label>
              <input
                type="text"
                id="nft-sweep-contract-input"
                value={contractAddress}
                onChange={e => setContractAddress(e.target.value)}
                placeholder="0x... (抢购的 NFT 合约)"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>

            <div className="sm:col-span-4 space-y-1.5">
              <label className="text-slate-300 font-semibold">NFT 协议类型:</label>
              <div className="flex rounded-lg bg-slate-950 border border-slate-800 p-0.5">
                <button
                  type="button"
                  onClick={() => setTokenType('erc721')}
                  className={`flex-1 py-1.5 rounded-md text-center font-medium transition-all ${
                    tokenType === 'erc721' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ERC-721 (常用)
                </button>
                <button
                  type="button"
                  onClick={() => setTokenType('erc1155')}
                  className={`flex-1 py-1.5 rounded-md text-center font-medium transition-all ${
                    tokenType === 'erc1155' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ERC-1155
                </button>
              </div>
            </div>
          </div>

          {/* ERC1155 Token ID if applicable */}
          {tokenType === 'erc1155' && (
            <div className="space-y-1.5 bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              <label className="text-slate-300 font-medium flex items-center justify-between">
                <span>ERC-1155 归集的 Token ID:</span>
                <span className="text-slate-500">通常为 1</span>
              </label>
              <input
                type="text"
                value={erc1155TokenId}
                onChange={e => setErc1155TokenId(e.target.value)}
                placeholder="例如 1"
                className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-slate-200 font-mono"
              />
            </div>
          )}

          {/* Scan Control Action */}
          <div className="flex items-center justify-between bg-slate-950/80 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2">
              <button
                type="button"
                id="nft-sweep-scan-btn"
                onClick={handleScanBalances}
                disabled={isScanning || isExecuting}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                <span>{isScanning ? '正在扫描持仓...' : '扫描各钱包 NFT 数量'}</span>
              </button>
              {totalDiscoveredNfts > 0 && (
                <span className="text-emerald-400 font-medium">
                  共扫描到 {totalDiscoveredNfts} 枚 NFT (分布在 {totalHolders} 个钱包)
                </span>
              )}
            </div>

            <span className="text-slate-500 text-[11px]">
              网络: {chain.nameZh || chain.name} (ChainID: {chain.id})
            </span>
          </div>

          {scanError && (
            <div className="p-2.5 rounded-lg bg-red-950/50 border border-red-800/80 text-red-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{scanError}</span>
            </div>
          )}

          {/* Wallet List Review */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-slate-400 font-medium">
              <span>待归集钱包清单 ({wallets.length} 个)</span>
              <span className="text-[11px]">已自动读取私钥签名</span>
            </div>

            <div className="max-h-52 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950/50 divide-y divide-slate-800/60">
              {walletStatuses.map((item, idx) => (
                <div key={item.wallet.id} className="p-2.5 flex items-center justify-between gap-2 hover:bg-slate-900/50">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[11px] font-mono text-slate-500 w-5 text-right">
                      {idx + 1}.
                    </span>
                    <span className="font-mono text-slate-300 text-xs truncate max-w-[140px] sm:max-w-[180px]">
                      {formatAddress(item.wallet.address)}
                    </span>
                    {item.wallet.label && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400">
                        {item.wallet.label}
                      </span>
                    )}
                  </div>

                  {/* Status & Holdings */}
                  <div className="flex items-center gap-3">
                    {/* Discovered Tokens */}
                    <div className="text-right">
                      {item.balance > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-xs border border-emerald-500/30">
                          持有 {item.balance} 枚
                          {item.tokenIds.length > 0 && ` (#${item.tokenIds.join(', #')})`}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-xs">无持有</span>
                      )}
                    </div>

                    {/* Non-enumerable manual input fallback with direct explorer jump */}
                    {item.balance > 0 && item.tokenIds.length === 0 && tokenType === 'erc721' && (
                      <div className="flex items-center gap-1.5 bg-amber-950/40 p-1 rounded-md border border-amber-600/40">
                        <input
                          type="text"
                          placeholder="编号 (如 88)"
                          value={customTokenIds[item.wallet.id] || ''}
                          onChange={e => setCustomTokenIds(prev => ({ ...prev, [item.wallet.id]: e.target.value }))}
                          className="w-20 bg-slate-900 border border-amber-600/80 rounded px-1.5 py-0.5 text-[11px] text-amber-200 placeholder-amber-400/50 focus:outline-none focus:border-amber-400 font-mono"
                          title="输入该钱包所拥有的 NFT Token ID"
                        />
                        <a
                          href={`${chain.explorerUrl}/address/${item.wallet.address}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-amber-300 hover:text-amber-100 underline flex items-center gap-0.5 px-1 py-0.5 rounded hover:bg-amber-900/50"
                          title="在区块浏览器查看此钱包的 NFT Token 编号"
                        >
                          <span>查编号</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    )}

                    {/* Progress Indicator */}
                    <div className="w-20 text-right">
                      {item.status === 'idle' && item.balance > 0 && (
                        <span className="text-slate-400 text-[11px]">等待归集</span>
                      )}
                      {item.status === 'transferring' && (
                        <span className="text-purple-400 text-[11px] flex items-center gap-1 justify-end">
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          转账中
                        </span>
                      )}
                      {item.status === 'success' && (
                        <span className="text-emerald-400 text-[11px] flex items-center gap-1 justify-end font-semibold">
                          <CheckCircle2 className="w-3 h-3" />
                          已归集
                        </span>
                      )}
                      {item.status === 'failed' && (
                        <span className="text-red-400 text-[11px] truncate block max-w-[80px]" title={item.error}>
                          失败
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-400 text-xs">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <span>每个有 NFT 的子钱包将消耗极微量 Gas（Arc/Robinhood 约 $0.0001/笔）</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isExecuting}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              取消
            </button>
            <button
              type="button"
              id="nft-sweep-execute-btn"
              onClick={handleExecuteSweep}
              disabled={isExecuting || isScanning || totalDiscoveredNfts === 0 || !recipientAddress}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-lg shadow-purple-900/30 flex items-center gap-2 transition-all"
            >
              {isExecuting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>正在逐一归集中...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>一键全部归集到主钱包 ({totalDiscoveredNfts} 枚)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
