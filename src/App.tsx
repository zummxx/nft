/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { ContractConfig } from './components/ContractConfig';
import { WalletManager } from './components/WalletManager';
import { SniperSettings } from './components/SniperSettings';
import { ActionControls } from './components/ActionControls';
import { SniperControlBar } from './components/SniperControlBar';
import { TerminalLogs } from './components/TerminalLogs';
import { DocModal } from './components/DocModal';
import { CustomRpcModal } from './components/CustomRpcModal';
import { NftSweepModal } from './components/NftSweepModal';
import { SUPPORTED_CHAINS, DEMO_CONTRACTS, SEADROP_ABI } from './constants/chains';
import {
  ChainConfig,
  PublicDropData,
  WalletAccount,
  GasConfig,
  SniperConfig,
  LogEntry
} from './types';
import {
  fetchContractDetails,
  fetchWalletBalance,
  simulateMint,
  executeMint,
  determineWorkingFeeRecipient,
  getProvider,
  formatAddress,
  parseRpcUrls
} from './utils/seadrop';
import { ethers } from 'ethers';

export default function App() {
  // Chain state - Dedicated to Robinhood Chain
  const [currentChain, setCurrentChain] = useState<ChainConfig>(SUPPORTED_CHAINS[0]);
  const [customRpcs, setCustomRpcs] = useState<Record<number, string>>(() => {
    try {
      const saved = localStorage.getItem('nft_sniper_custom_rpcs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed === 'object' && parsed !== null) return parsed;
      }
      const legacy = localStorage.getItem('nft_sniper_custom_rpc');
      if (legacy && legacy.trim()) {
        return { 4663: legacy.trim() };
      }
    } catch {}
    return {};
  });

  // Active custom RPC for currently selected chain (isolated per chain)
  const activeCustomRpc = customRpcs[currentChain.id] || '';

  // Save customRpcs map to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('nft_sniper_custom_rpcs', JSON.stringify(customRpcs));
    } catch {}
  }, [customRpcs]);

  // Contract & SeaDrop State - default to HoodBoy contract on Robinhood
  const [contractAddress, setContractAddress] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('nft_sniper_contract');
      if (saved && ethers.isAddress(saved)) return saved;
    } catch {}
    return '0x2612147f166f793027370190c77d55439e8eeb39';
  });
  const [isLoadingContract, setIsLoadingContract] = useState<boolean>(false);
  const [contractError, setContractError] = useState<string | null>(null);
  const [nftName, setNftName] = useState<string>('');
  const [nftSymbol, setNftSymbol] = useState<string>('');
  const [dropData, setDropData] = useState<PublicDropData | null>(null);

  // Wallets State
  const [wallets, setWallets] = useState<WalletAccount[]>(() => {
    // Check localStorage
    try {
      const saved = localStorage.getItem('nft_sniper_wallets');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    // Provide 1 generated ephemeral demo wallet for instant testing
    const demo = ethers.Wallet.createRandom();
    return [
      {
        id: 'demo-1',
        address: demo.address,
        privateKey: demo.privateKey,
        type: 'generated',
        balanceWei: '0',
        balanceFormatted: '0',
        status: 'idle',
        selected: true,
      }
    ];
  });
  const [isRefreshingBalances, setIsRefreshingBalances] = useState<boolean>(false);

  // Gas Settings
  const [gasConfig, setGasConfig] = useState<GasConfig>(() => {
    // Check if initial chain is Arc Network (id: 5042)
    const initChain = SUPPORTED_CHAINS[0];
    if (initChain && initChain.id === 5042) {
      return {
        preset: 'sniper',
        maxFeePerGasGwei: 100,
        maxPriorityFeePerGasGwei: 30,
        gasLimitMultiplier: 1.2,
      };
    }
    return {
      preset: 'sniper',
      maxFeePerGasGwei: 0.2,
      maxPriorityFeePerGasGwei: 0.05,
      gasLimitMultiplier: 1.2,
    };
  });

  // Sniper Timing & Mode Settings
  const [sniperConfig, setSniperConfig] = useState<SniperConfig>({
    mode: 'instant',
    targetTimestamp: 0,
    triggerAdvanceMs: 250,
    preSign: true,
    quantityPerWallet: 1,
  });

  // Execution & Simulation states
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [isCountdownActive, setIsCountdownActive] = useState<boolean>(false);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(0);

  // Logs
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: 'init-log',
      timestamp: Date.now(),
      level: 'info',
      text: 'NFT 公共铸造抢购工具 (NFT Public Mint Sniper) 初始化就绪。'
    },
    {
      id: 'init-log-2',
      timestamp: Date.now() + 1,
      level: 'info',
      text: '默认连接 Arc 链 / Robinhood Chain SeaDrop 协议。'
    }
  ]);

  // Modals & Layout
  const [showDocs, setShowDocs] = useState<boolean>(false);
  const [showRpcModal, setShowRpcModal] = useState<boolean>(false);
  const [showSweepModal, setShowSweepModal] = useState<boolean>(false);
  const [layoutMode, setLayoutMode] = useState<'cockpit' | 'stack'>(() => {
    try {
      const saved = localStorage.getItem('nft_sniper_layout_mode');
      if (saved === 'cockpit' || saved === 'stack') return saved;
    } catch {}
    return 'cockpit';
  });

  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Save layout preference
  useEffect(() => {
    try {
      localStorage.setItem('nft_sniper_layout_mode', layoutMode);
    } catch {}
  }, [layoutMode]);

  // Save wallets to local storage safely
  useEffect(() => {
    try {
      localStorage.setItem('nft_sniper_wallets', JSON.stringify(wallets));
    } catch {}
  }, [wallets]);

  // Save chain preference
  useEffect(() => {
    try {
      localStorage.setItem('nft_sniper_chain_id', String(currentChain.id));
    } catch {}
  }, [currentChain.id]);

  // Save contract address
  useEffect(() => {
    try {
      if (contractAddress) {
        localStorage.setItem('nft_sniper_contract', contractAddress);
      }
    } catch {}
  }, [contractAddress]);

  // Auto-fetch contract and balances on first mount
  const hasInitializedRef = useRef(false);
  useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      handleFetchContract();
      handleRefreshBalances();
    }
  }, []);

  // Append a log entry helper
  const addLog = (level: LogEntry['level'], text: string, txHash?: string, walletAddress?: string) => {
    setLogs(prev => [
      ...prev,
      {
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        timestamp: Date.now(),
        level,
        text,
        txHash,
        walletAddress,
      }
    ]);
  };

  // Switch Chain handler
  const handleSelectChain = (chain: ChainConfig) => {
    setCurrentChain(chain);

    // Auto adapt Gas for Arc Network
    if (chain.id === 5042) {
      setGasConfig(prev => ({
        ...prev,
        preset: prev.preset || 'sniper',
        maxFeePerGasGwei: Math.max(prev.maxFeePerGasGwei, 30),
        maxPriorityFeePerGasGwei: Math.max(prev.maxPriorityFeePerGasGwei, 10),
      }));
    }

    const dedicatedRpc = customRpcs[chain.id];
    const rpcList = parseRpcUrls(dedicatedRpc);
    if (rpcList.length > 1) {
      addLog('info', `已切换至网络: ${chain.nameZh} · 已激活多节点并发负载均衡 (${rpcList.length} 个独立 RPC)`);
    } else if (rpcList.length === 1) {
      addLog('info', `已切换至网络: ${chain.nameZh} · 自动启用该网络专属私有 RPC`);
    } else {
      addLog('info', `已切换至网络: ${chain.nameZh} · 使用公共默认 RPC 节点`);
    }
    
    // Auto match demo contract if available
    const matchDemo = DEMO_CONTRACTS.find(d => d.chainId === chain.id);
    if (matchDemo) {
      setContractAddress(matchDemo.address);
    }
    setDropData(null);
    setContractError(null);
  };

  // Refresh all balances
  const handleRefreshBalances = async () => {
    if (wallets.length === 0) return;
    setIsRefreshingBalances(true);
    addLog('info', `正在查询 ${wallets.length} 个钱包在 ${currentChain.name} 的原生余额...`);

    const rpcList = parseRpcUrls(activeCustomRpc);

    try {
      const updated = await Promise.all(
        wallets.map(async (w, idx) => {
          const assignedRpc = rpcList.length > 0 ? rpcList[idx % rpcList.length] : activeCustomRpc;
          const { wei, formatted } = await fetchWalletBalance(w.address, currentChain, assignedRpc);
          return {
            ...w,
            balanceWei: wei,
            balanceFormatted: formatted,
          };
        })
      );
      setWallets(updated);
      addLog('success', `全部钱包余额刷新完成。`);
    } catch (err: any) {
      addLog('warn', `刷新部分余额出现异常: ${err?.message || err}`);
    } finally {
      setIsRefreshingBalances(false);
    }
  };

  // Fetch contract SeaDrop parameters
  const handleFetchContract = async () => {
    if (!contractAddress || !ethers.isAddress(contractAddress)) {
      setContractError('请输入有效的以太坊合约地址 (以 0x 开头的 42 位地址)');
      return;
    }

    setIsLoadingContract(true);
    setContractError(null);
    addLog('info', `正在从 ${currentChain.name} SeaDrop 协议读取合约: ${contractAddress}`);

    try {
      const details = await fetchContractDetails(contractAddress, currentChain, activeCustomRpc);
      setNftName(details.name);
      setNftSymbol(details.symbol);
      setDropData(details.dropData);

      const priceStr = details.dropData.mintPrice === '0'
        ? '免费 (Free Mint)'
        : `${details.dropData.mintPriceFormatted} ${currentChain.nativeSymbol}`;
      const limitStr = details.dropData.maxTotalMintableByWallet > 0
        ? `${details.dropData.maxTotalMintableByWallet} 个`
        : '不限制';

      addLog(
        'success',
        `合约解析成功: ${details.name} (${details.symbol}) | 单价: ${priceStr} | 钱包限额: ${limitStr}`
      );

      if (details.dropData.isUpcoming && details.dropData.startTime > 0) {
        const openDate = new Date(details.dropData.startTime * 1000);
        const nowSec = Math.floor(Date.now() / 1000);
        const diff = details.dropData.startTime - nowSec;
        const days = Math.floor(diff / 86400);
        const hours = Math.floor((diff % 86400) / 3600);
        const mins = Math.floor((diff % 3600) / 60);
        const timeRemainingText = days > 0 ? `${days}天${hours}小时` : `${hours}小时${mins}分钟`;
        addLog(
          'warn',
          `注意: 该 NFT 公售尚未开启，开售时间为: ${openDate.getFullYear()}/${openDate.getMonth() + 1}/${openDate.getDate()} ${openDate.toTimeString().split(' ')[0]} (距离开售还有约 ${timeRemainingText})。可切换到「定时抢购」模式等待触发。`
        );
      } else if (details.dropData.isActive) {
        addLog('sniper', `🟢 该 NFT 公售目前处于开放状态，可立即发起并发铸造！`);
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      setContractError(msg);
      addLog('error', `查询合约失败: ${msg}`);
    } finally {
      setIsLoadingContract(false);
    }
  };

  // Sync schedule target time
  const handleApplyScheduleTime = (startTime: number) => {
    setSniperConfig(prev => ({
      ...prev,
      mode: 'scheduled',
      targetTimestamp: startTime,
    }));
    addLog('sniper', `已将抢购时间同步对齐至开售时间戳: ${startTime} (${new Date(startTime * 1000).toLocaleString('zh-CN')})`);
  };

  // Dry Run Simulation
  const handleSimulate = async () => {
    const selected = wallets.filter(w => w.selected);
    if (selected.length === 0) {
      alert('请勾选至少一个用于模拟校验的钱包');
      return;
    }
    if (!dropData) {
      alert('请先查询有效的 NFT 合约');
      return;
    }

    setIsSimulating(true);
    addLog('info', `[Dry Run] 开始对选中的 ${selected.length} 个钱包进行链上模拟校验 (eth_call)...`);

    let successCount = 0;
    let failCount = 0;

    for (const w of selected) {
      setWallets(prev => prev.map(item => item.id === w.id ? { ...item, status: 'simulating' } : item));

      const res = await simulateMint(
        w,
        contractAddress,
        sniperConfig.quantityPerWallet,
        dropData,
        currentChain,
        activeCustomRpc
      );

      if (res.success) {
        successCount++;
        setWallets(prev => prev.map(item => item.id === w.id ? { ...item, status: 'ready', errorMessage: undefined } : item));
        addLog('success', `[Dry Run] 钱包 ${formatAddress(w.address)} 校验通过！预估 Gas: ${res.gasEstimated}`, undefined, w.address);
      } else {
        failCount++;
        setWallets(prev => prev.map(item => item.id === w.id ? { ...item, status: 'failed', errorMessage: res.errorMessage } : item));
        addLog('error', `[Dry Run] 钱包 ${formatAddress(w.address)} 校验未通过: ${res.errorMessage}`, undefined, w.address);
        
        // 针对未开售的明确提示
        if (dropData.isUpcoming && dropData.startTime > 0) {
          addLog('warn', `💡 提示: 当前公售时间未到（开售时间: ${new Date(dropData.startTime * 1000).toLocaleString('zh-CN')}），SeaDrop 合约在此阶段会按规则 Revert。这属于正常保护机制，请在「定时狙击」中设置自动开抢。`);
        }
      }
    }

    setIsSimulating(false);
    if (failCount === 0) {
      addLog('success', `🎉 全部 ${successCount} 个钱包模拟校验通过，交易逻辑安全，零 Gas 损耗！`);
    } else {
      addLog('warn', `模拟校验结束: ${successCount} 个成功，${failCount} 个失败。请查看错误原因。`);
    }
  };

  // Parallel Execution
  const executeParallelMint = async () => {
    const selected = wallets.filter(w => w.selected);
    if (selected.length === 0 || !dropData) return;

    setIsExecuting(true);
    setIsCountdownActive(false);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

    const rpcList = parseRpcUrls(activeCustomRpc);

    if (rpcList.length > 1) {
      addLog(
        'sniper',
        `⚡ 已激活双/多 Alchemy 轮询负载均衡: 检测到 ${rpcList.length} 个独立 RPC 节点，正在为 ${selected.length} 个钱包均匀分流，并发 RPS 翻倍，零限速风险！`
      );
    } else {
      addLog(
        'sniper',
        `🚀 启动并发抢购！正在向网络齐发 ${selected.length} 笔交易，每钱包铸造 ${sniperConfig.quantityPerWallet} 个...`
      );
    }

    // Set all to pending
    setWallets(prev => prev.map(w => w.selected ? { ...w, status: 'pending', errorMessage: undefined } : w));

    // 1. 预先解析手续费接收地址与网络费率，避免多钱包并发向 RPC 发起重复查询导致限流阻塞
    let sharedFeeRecipient = dropData.workingFeeRecipient;
    if (!sharedFeeRecipient) {
      try {
        const queryProvider = getProvider(currentChain, activeCustomRpc);
        const querySeaDrop = new ethers.Contract(currentChain.seaDropAddress, SEADROP_ABI, queryProvider);
        sharedFeeRecipient = await determineWorkingFeeRecipient(
          querySeaDrop,
          contractAddress,
          dropData,
          selected[0].address,
          sniperConfig.quantityPerWallet,
          BigInt(dropData.mintPrice) * BigInt(sniperConfig.quantityPerWallet)
        );
        setDropData(prev => prev ? { ...prev, workingFeeRecipient: sharedFeeRecipient } : prev);
      } catch {
        sharedFeeRecipient = dropData.feeRecipient || ethers.ZeroAddress;
      }
    }

    let sharedFeeData: { maxPriorityFeePerGas: bigint; maxFeePerGas: bigint } | undefined = undefined;
    if (gasConfig.preset !== 'sniper' && gasConfig.preset !== 'custom') {
      try {
        const p = getProvider(currentChain, activeCustomRpc);
        const fd = await p.getFeeData();
        let mp = fd.maxPriorityFeePerGas || ethers.parseUnits('1.5', 'gwei');
        let mf = fd.maxFeePerGas || (fd.gasPrice ? fd.gasPrice * 2n : ethers.parseUnits('20', 'gwei'));
        if (gasConfig.preset === 'fast') {
          mp = (mp * 15n) / 10n;
          mf = (mf * 15n) / 10n;
        }
        sharedFeeData = { maxPriorityFeePerGas: mp, maxFeePerGas: mf };
      } catch {
        // fallback inside executeMint
      }
    }

    // Parallel fire via Promise.allSettled with round-robin RPC distribution
    const results = await Promise.allSettled(
      selected.map(async (wallet, walletIndex) => {
        // 微毫秒级错峰发射，避免本地同一个 RPC 连接池瞬时拥堵
        if (walletIndex > 0) {
          await new Promise(r => setTimeout(r, walletIndex * 15));
        }

        const assignedRpc = rpcList.length > 0 ? rpcList[walletIndex % rpcList.length] : activeCustomRpc;
        const nodeIndex = rpcList.length > 1 ? (walletIndex % rpcList.length) + 1 : undefined;
        const nodeTag = nodeIndex ? ` [由 RPC #${nodeIndex} 广播]` : '';

        const res = await executeMint(
          wallet,
          contractAddress,
          sniperConfig.quantityPerWallet,
          dropData,
          gasConfig,
          currentChain,
          assignedRpc,
          {
            sharedFeeRecipient,
            sharedFeeData,
            callbacks: {
              onBroadcast: (txHash: string) => {
                // 收到交易哈希立即将状态更新为 submitted (已广播/打包中)，并展示实时哈希
                setWallets(prev => prev.map(w => w.id === wallet.id ? {
                  ...w,
                  status: 'submitted',
                  lastTxHash: txHash
                } : w));
                addLog(
                  'sniper',
                  `🚀 钱包 #${walletIndex + 1} (${formatAddress(wallet.address)}) 交易已广播上链！TX: ${txHash.substring(0, 10)}...${nodeTag}，等待出块...`,
                  txHash,
                  wallet.address
                );
              },
              onConfirm: (receipt) => {
                setWallets(prev => prev.map(w => w.id === wallet.id ? {
                  ...w,
                  status: 'success',
                  lastTxHash: receipt.hash
                } : w));
              }
            }
          }
        );

        return { ...res, nodeIndex };
      })
    );

    let succCount = 0;
    let mempoolCount = 0;
    let failCount = 0;

    results.forEach((res, index) => {
      const targetWallet = selected[index];
      if (res.status === 'fulfilled') {
        const txHash = res.value.txHash;
        const nodeTag = res.value.nodeIndex ? ` [由 RPC 节点 #${res.value.nodeIndex} 广播]` : '';
        if (res.value.pendingInMempool) {
          mempoolCount++;
          setWallets(prev => prev.map(w => w.id === targetWallet.id ? {
            ...w,
            status: 'submitted',
            lastTxHash: txHash
          } : w));
          addLog(
            'warn',
            `⏳ 钱包 ${formatAddress(targetWallet.address)} 交易已在区块链网络排队中，出块确认中（点击哈希查看进度）${nodeTag}`,
            txHash,
            targetWallet.address
          );
        } else {
          succCount++;
          setWallets(prev => prev.map(w => w.id === targetWallet.id ? {
            ...w,
            status: 'success',
            lastTxHash: txHash
          } : w));
          addLog(
            'success',
            `✅ 钱包 ${formatAddress(targetWallet.address)} 铸造成功！交易已确认${nodeTag}`,
            txHash,
            targetWallet.address
          );
        }
      } else {
        failCount++;
        const errMsg = res.reason?.message || res.reason?.shortMessage || String(res.reason);
        const failedTxHash = res.reason?.txHash || res.reason?.receipt?.hash;
        setWallets(prev => prev.map(w => w.id === targetWallet.id ? {
          ...w,
          status: 'failed',
          errorMessage: errMsg,
          lastTxHash: failedTxHash || w.lastTxHash
        } : w));
        addLog(
          'error',
          `❌ 钱包 ${formatAddress(targetWallet.address)} 失败: ${errMsg}`,
          failedTxHash,
          targetWallet.address
        );
      }
    });

    setIsExecuting(false);
    addLog(
      'sniper',
      `🏁 抢购执行完毕！成功已确认: ${succCount} / 排队打包中: ${mempoolCount} / 失败: ${failCount}。正在更新余额...`
    );
    handleRefreshBalances();
  };

  // Start Snipe (Instant or Scheduled)
  const handleStartSnipe = () => {
    const selected = wallets.filter(w => w.selected);
    if (selected.length === 0) {
      alert('请勾选至少一个用于抢购的钱包');
      return;
    }
    if (!dropData) {
      alert('请先查询有效的 NFT 合约');
      return;
    }

    if (sniperConfig.mode === 'instant') {
      executeParallelMint();
    } else {
      // Scheduled mode
      const nowSec = Math.floor(Date.now() / 1000);
      const targetSec = sniperConfig.targetTimestamp;

      if (!targetSec || targetSec <= nowSec) {
        if (!window.confirm('目标时间已过期或未设置，是否立即以极速模式开火？')) {
          return;
        }
        executeParallelMint();
        return;
      }

      const diffSec = targetSec - nowSec;
      setCountdownSeconds(diffSec);
      setIsCountdownActive(true);
      addLog(
        'sniper',
        `⏳ 定时狙击已锁定！目标时间: ${new Date(targetSec * 1000).toLocaleString('zh-CN')} (倒计时 ${diffSec} 秒)`
      );

      // Setup countdown interval
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = setInterval(() => {
        const currentNow = Date.now();
        const triggerTime = (targetSec * 1000) - (sniperConfig.triggerAdvanceMs || 0);
        const remainMs = triggerTime - currentNow;

        if (remainMs <= 0) {
          if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
          addLog('sniper', `🎯 倒计时归零，触发提前 ${sniperConfig.triggerAdvanceMs}ms 瞬间开火！`);
          executeParallelMint();
        } else {
          setCountdownSeconds(Math.max(0, Math.ceil(remainMs / 1000)));
        }
      }, 200);
    }
  };

  // Cancel Scheduled Snipe
  const handleCancelSnipe = () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }
    setIsCountdownActive(false);
    addLog('warn', '已取消定时抢购倒计时监听。');
  };

  // RPC Management Handlers (Per-chain isolation)
  const handleSaveRpc = (chainId: number, rpcUrl: string) => {
    setCustomRpcs(prev => {
      const next = { ...prev };
      if (rpcUrl && rpcUrl.trim()) {
        next[chainId] = rpcUrl.trim();
      } else {
        delete next[chainId];
      }
      return next;
    });
    const chain = SUPPORTED_CHAINS.find(c => c.id === chainId);
    const name = chain ? chain.nameZh : `Chain ${chainId}`;
    if (rpcUrl && rpcUrl.trim()) {
      addLog('info', `已为 [${name}] 保存专属独享私有 RPC: ${rpcUrl.trim()}`);
    } else {
      addLog('info', `已将 [${name}] 恢复为公共默认节点`);
    }
  };

  const handleResetRpc = (chainId: number) => {
    setCustomRpcs(prev => {
      const next = { ...prev };
      delete next[chainId];
      return next;
    });
    const chain = SUPPORTED_CHAINS.find(c => c.id === chainId);
    addLog('info', `已重置 [${chain ? chain.nameZh : chainId}] 为公共默认节点`);
  };

  const handleClearAllRpcs = () => {
    setCustomRpcs({});
    addLog('info', '已清空所有公链的私有 RPC 配置，恢复为官方公共节点');
  };

  const selectedWalletsCount = wallets.filter(w => w.selected).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <Header
        currentChain={currentChain}
        onSelectChain={handleSelectChain}
        wallets={wallets}
        onOpenDocs={() => setShowDocs(true)}
        onOpenRpcModal={() => setShowRpcModal(true)}
        onRefreshBalances={handleRefreshBalances}
        isRefreshing={isRefreshingBalances}
        customRpc={activeCustomRpc}
        layoutMode={layoutMode}
        onToggleLayoutMode={() => setLayoutMode(prev => prev === 'cockpit' ? 'stack' : 'cockpit')}
      />

      {/* Main Content Dashboard */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 md:p-6 space-y-4">
        {/* Top Full-Width Row: 抢购控制横栏 (Sniper Controls Bar) */}
        <SniperControlBar
          sniperConfig={sniperConfig}
          setSniperConfig={setSniperConfig}
          gasConfig={gasConfig}
          setGasConfig={setGasConfig}
          chain={currentChain}
          dropData={dropData}
          selectedWalletsCount={selectedWalletsCount}
          onSimulate={handleSimulate}
          onStartSnipe={handleStartSnipe}
          onCancelSnipe={handleCancelSnipe}
          isSimulating={isSimulating}
          isExecuting={isExecuting}
          isCountdownActive={isCountdownActive}
          countdownSeconds={countdownSeconds}
        />

        {layoutMode === 'cockpit' ? (
          /* Bottom 3-Column Layout: 左钱包 · 中日志 · 右合约 (Left: Wallets, Center: Logs, Right: Contract) */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left Column (4 cols): 钱包管理 */}
            <div className="lg:col-span-4">
              <WalletManager
                wallets={wallets}
                setWallets={setWallets}
                chain={currentChain}
                onRefreshBalances={handleRefreshBalances}
                isRefreshing={isRefreshingBalances}
                maxHeightClass="max-h-[460px]"
                onOpenSweepModal={() => setShowSweepModal(true)}
              />
            </div>

            {/* Center Column (4 cols): 链上日志 & 执行终端 */}
            <div className="lg:col-span-4">
              <TerminalLogs
                logs={logs}
                onClearLogs={() => setLogs([])}
                chain={currentChain}
                heightClass="h-[460px]"
              />
            </div>

            {/* Right Column (4 cols): 查询与解析合约 */}
            <div className="lg:col-span-4">
              <ContractConfig
                contractAddress={contractAddress}
                setContractAddress={setContractAddress}
                onFetchDrop={handleFetchContract}
                isLoading={isLoadingContract}
                dropData={dropData}
                nftName={nftName}
                nftSymbol={nftSymbol}
                chain={currentChain}
                onApplyScheduleTime={handleApplyScheduleTime}
                error={contractError}
                compactMode={true}
              />
            </div>
          </div>
        ) : (
          /* Classic Stacked View */
          <div className="space-y-6">
            <ContractConfig
              contractAddress={contractAddress}
              setContractAddress={setContractAddress}
              onFetchDrop={handleFetchContract}
              isLoading={isLoadingContract}
              dropData={dropData}
              nftName={nftName}
              nftSymbol={nftSymbol}
              chain={currentChain}
              onApplyScheduleTime={handleApplyScheduleTime}
              error={contractError}
              compactMode={false}
            />

            <WalletManager
              wallets={wallets}
              setWallets={setWallets}
              chain={currentChain}
              onRefreshBalances={handleRefreshBalances}
              isRefreshing={isRefreshingBalances}
              onOpenSweepModal={() => setShowSweepModal(true)}
            />

            <SniperSettings
              sniperConfig={sniperConfig}
              setSniperConfig={setSniperConfig}
              gasConfig={gasConfig}
              setGasConfig={setGasConfig}
              chain={currentChain}
              dropData={dropData}
              selectedWalletsCount={selectedWalletsCount}
              layoutMode="stack"
            />

            <ActionControls
              onSimulate={handleSimulate}
              onStartSnipe={handleStartSnipe}
              onCancelSnipe={handleCancelSnipe}
              isSimulating={isSimulating}
              isExecuting={isExecuting}
              isCountdownActive={isCountdownActive}
              countdownSeconds={countdownSeconds}
              selectedWalletsCount={selectedWalletsCount}
              dropData={dropData}
              sniperConfig={sniperConfig}
              chain={currentChain}
            />

            <TerminalLogs
              logs={logs}
              onClearLogs={() => setLogs([])}
              chain={currentChain}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            NFT Public Mint (SeaDrop Sniper) · 中文重构版 · 基于 morsyxbt/nft-public-mint
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>支持 Arc 链 (arc.io) · Robinhood · Ink · 以太坊 · SeaDrop</span>
            <button
              onClick={() => setShowDocs(true)}
              className="text-emerald-400 hover:underline"
            >
              技术原理与官方资源
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      {showDocs && <DocModal onClose={() => setShowDocs(false)} />}
      {showRpcModal && (
        <CustomRpcModal
          currentChain={currentChain}
          customRpcs={customRpcs}
          onSaveRpc={handleSaveRpc}
          onResetRpc={handleResetRpc}
          onClearAllRpcs={handleClearAllRpcs}
          onSelectChain={handleSelectChain}
          onClose={() => setShowRpcModal(false)}
        />
      )}
      {showSweepModal && (
        <NftSweepModal
          isOpen={showSweepModal}
          onClose={() => setShowSweepModal(false)}
          wallets={wallets}
          chain={currentChain}
          defaultContractAddress={contractAddress}
          customRpc={activeCustomRpc}
          onAddLog={addLog}
        />
      )}
    </div>
  );
}
