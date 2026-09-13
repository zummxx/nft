import React, { useState, useEffect } from 'react';
import { Server, Check, AlertCircle, RefreshCcw, Activity, Clipboard, ExternalLink, Zap, CheckCircle2, XCircle, Split, Plus } from 'lucide-react';
import { ChainConfig } from '../types';
import { SUPPORTED_CHAINS } from '../constants/chains';
import { ethers } from 'ethers';
import { parseRpcUrls } from '../utils/seadrop';

interface CustomRpcModalProps {
  currentChain: ChainConfig;
  customRpcs: Record<number, string>;
  onSaveRpc: (chainId: number, rpcUrl: string) => void;
  onResetRpc: (chainId: number) => void;
  onClearAllRpcs: () => void;
  onSelectChain: (chain: ChainConfig) => void;
  onClose: () => void;
}

interface NodeTestResult {
  status: 'idle' | 'testing' | 'success' | 'warning' | 'error';
  latencyMs?: number;
  detectedChainId?: number;
  latestBlock?: number;
  message?: string;
}

export const CustomRpcModal: React.FC<CustomRpcModalProps> = ({
  currentChain,
  customRpcs,
  onSaveRpc,
  onResetRpc,
  onClearAllRpcs,
  onSelectChain,
  onClose,
}) => {
  const [selectedChainId, setSelectedChainId] = useState<number>(currentChain.id);
  const activeChain = SUPPORTED_CHAINS.find(c => c.id === selectedChainId) || currentChain;

  // Dual-RPC inputs
  const [primaryRpc, setPrimaryRpc] = useState<string>('');
  const [secondaryRpc, setSecondaryRpc] = useState<string>('');
  
  // Advanced multiline mode for 3+ nodes
  const [isAdvancedMode, setIsAdvancedMode] = useState<boolean>(false);
  const [multilineRpc, setMultilineRpc] = useState<string>('');

  // Individual test states
  const [testResult1, setTestResult1] = useState<NodeTestResult>({ status: 'idle' });
  const [testResult2, setTestResult2] = useState<NodeTestResult>({ status: 'idle' });
  const [isBatchTesting, setIsBatchTesting] = useState<boolean>(false);

  // Sync state when chain changes
  useEffect(() => {
    const raw = customRpcs[activeChain.id] || '';
    const urls = parseRpcUrls(raw);
    setPrimaryRpc(urls[0] || (raw && !raw.includes('\n') ? raw.trim() : ''));
    setSecondaryRpc(urls[1] || '');
    setMultilineRpc(raw);
    setTestResult1({ status: 'idle' });
    setTestResult2({ status: 'idle' });
    if (urls.length > 2) {
      setIsAdvancedMode(true);
    }
  }, [activeChain.id, customRpcs]);

  // Handle switching chain in modal tabs
  const handleSwitchModalChain = (chain: ChainConfig) => {
    setSelectedChainId(chain.id);
  };

  const handlePasteTo = async (target: 'primary' | 'secondary' | 'multi') => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        const clean = text.trim();
        if (target === 'primary') {
          setPrimaryRpc(clean);
          setTestResult1({ status: 'idle' });
        } else if (target === 'secondary') {
          setSecondaryRpc(clean);
          setTestResult2({ status: 'idle' });
        } else {
          setMultilineRpc(clean);
        }
      }
    } catch (e) {
      console.warn('Clipboard read failed:', e);
    }
  };

  // Ping a single RPC URL
  const pingRpc = async (url: string): Promise<NodeTestResult> => {
    const targetUrl = url.trim() || activeChain.rpcUrl;
    try {
      const startTime = performance.now();
      const provider = new ethers.JsonRpcProvider(targetUrl, undefined, { staticNetwork: false });
      const [network, blockNumber] = await Promise.all([
        provider.getNetwork(),
        provider.getBlockNumber()
      ]);
      const latencyMs = Math.round(performance.now() - startTime);
      const detectedId = Number(network.chainId);

      if (detectedId === activeChain.id) {
        return {
          status: 'success',
          latencyMs,
          detectedChainId: detectedId,
          latestBlock: blockNumber,
          message: `节点畅通: 延迟 ${latencyMs}ms · 区块 #${blockNumber} · Chain ID 匹配 (${detectedId})`
        };
      } else {
        const otherChain = SUPPORTED_CHAINS.find(c => c.id === detectedId);
        const otherName = otherChain ? otherChain.nameZh : `未知网络 (ID: ${detectedId})`;
        return {
          status: 'warning',
          latencyMs,
          detectedChainId: detectedId,
          latestBlock: blockNumber,
          message: `⚠️ 链不匹配: 节点返回 Chain ID 为 ${detectedId} (${otherName})，当前配置的是 ${activeChain.nameZh} (${activeChain.id})！`
        };
      }
    } catch (err: any) {
      return {
        status: 'error',
        message: `❌ 连接超时或拒绝: ${err?.message || '无法访问该 RPC 地址'}`
      };
    }
  };

  const handleTestSingle = async (nodeIndex: 1 | 2) => {
    const url = nodeIndex === 1 ? primaryRpc : secondaryRpc;
    if (nodeIndex === 1) {
      setTestResult1({ status: 'testing' });
      const res = await pingRpc(url);
      setTestResult1(res);
    } else {
      setTestResult2({ status: 'testing' });
      const res = await pingRpc(url);
      setTestResult2(res);
    }
  };

  const handleTestBoth = async () => {
    setIsBatchTesting(true);
    setTestResult1({ status: 'testing' });
    if (secondaryRpc.trim()) {
      setTestResult2({ status: 'testing' });
    }

    const [res1, res2] = await Promise.all([
      pingRpc(primaryRpc),
      secondaryRpc.trim() ? pingRpc(secondaryRpc) : Promise.resolve<NodeTestResult>({ status: 'idle' })
    ]);

    setTestResult1(res1);
    if (secondaryRpc.trim()) {
      setTestResult2(res2);
    }
    setIsBatchTesting(false);
  };

  const handleSave = () => {
    let combined = '';
    if (isAdvancedMode) {
      combined = multilineRpc.trim();
    } else {
      const parts = [primaryRpc.trim(), secondaryRpc.trim()].filter(Boolean);
      combined = parts.join('\n');
    }

    onSaveRpc(activeChain.id, combined);
    if (activeChain.id !== currentChain.id) {
      onSelectChain(activeChain);
    }
    onClose();
  };

  const handleResetCurrent = () => {
    setPrimaryRpc('');
    setSecondaryRpc('');
    setMultilineRpc('');
    onResetRpc(activeChain.id);
    setTestResult1({ status: 'idle' });
    setTestResult2({ status: 'idle' });
  };

  const isDualAlchemyReady = Boolean(primaryRpc.trim() && secondaryRpc.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-5 space-y-4 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-white text-base">私有 RPC 节点与双 Alchemy 负载分流加速</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded bg-slate-800">
            关闭
          </button>
        </div>

        {/* Highlight description */}
        <div className="text-xs text-slate-300 leading-relaxed bg-slate-950/70 p-3 rounded-lg border border-slate-800/80 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
              <Zap className="w-4 h-4 fill-current" />
              双 Alchemy 轮询分流机制 (Round-Robin)：
            </span>
            <a
              href="https://dashboard.alchemy.com"
              target="_blank"
              rel="noreferrer"
              className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[11px] underline"
            >
              获取 Alchemy API Key
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <p className="text-slate-400 text-[11px]">
            配置两个独立 Alchemy 账号的 API Key，20 个钱包并发抢购时将自动按 50% 负载轮询分流至两个节点。
            <strong className="text-slate-200">瞬时并发能力翻倍至 ~50 RPS</strong>，彻底消除 429 限速与单点网络抖动！
          </p>
        </div>

        {/* Chain selector tabs */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300">选择要配置的目标公链：</label>
            <span className="text-[11px] text-slate-500">各公链配置完全独立隔离</span>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-slate-950/50 rounded-lg border border-slate-800/60">
            {SUPPORTED_CHAINS.map(chain => {
              const isSelected = chain.id === activeChain.id;
              const hasCustom = Boolean(customRpcs[chain.id]);
              const count = parseRpcUrls(customRpcs[chain.id]).length;
              return (
                <button
                  key={chain.id}
                  onClick={() => handleSwitchModalChain(chain)}
                  className={`px-2.5 py-1 text-xs rounded-md transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-emerald-600 text-white font-medium shadow'
                      : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: chain.iconColor }}
                  />
                  <span>{chain.nameZh}</span>
                  {hasCustom && (
                    <span className={`px-1 rounded-full text-[10px] ${isSelected ? 'bg-white/20 text-white' : 'bg-emerald-900/80 text-emerald-300 border border-emerald-700/50'}`}>
                      {count > 1 ? `双节点` : '私有'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Chain Config Body */}
        <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
          {/* Active Chain Header */}
          <div className="flex items-center justify-between bg-slate-950/50 px-3 py-2 rounded-lg border border-slate-800/70">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: activeChain.iconColor }} />
              <span className="text-sm font-semibold text-white">{activeChain.nameZh}</span>
              <span className="text-[11px] text-slate-500 font-mono">Chain ID: {activeChain.id}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAdvancedMode(!isAdvancedMode)}
                className="text-[11px] text-slate-400 hover:text-slate-200 underline"
              >
                {isAdvancedMode ? '切换为双节点输入' : '切换为高级多行模式'}
              </button>
              {isDualAlchemyReady ? (
                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-cyan-950 text-cyan-300 border border-cyan-800 flex items-center gap-1">
                  <Split className="w-3 h-3 text-cyan-400" />
                  双节点分流就绪
                </span>
              ) : primaryRpc.trim() ? (
                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950 text-emerald-400 border border-emerald-800">
                  单私有节点
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-400">
                  公共默认节点
                </span>
              )}
            </div>
          </div>

          {!isAdvancedMode ? (
            /* Dual-Node Mode Inputs */
            <div className="space-y-3">
              {/* Node 1: Primary Alchemy */}
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>主节点 (Alchemy #1 或其他主要 RPC)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handlePasteTo('primary')}
                      className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 text-[11px] bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/50"
                    >
                      <Clipboard className="w-3 h-3" />
                      <span>粘贴</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTestSingle(1)}
                      disabled={testResult1.status === 'testing' || isBatchTesting}
                      className="text-slate-300 hover:text-white flex items-center gap-1 text-[11px] bg-slate-800 px-2 py-0.5 rounded border border-slate-700"
                    >
                      <Activity className={`w-3 h-3 text-cyan-400 ${testResult1.status === 'testing' ? 'animate-spin' : ''}`} />
                      <span>测速</span>
                    </button>
                  </div>
                </div>

                <input
                  type="url"
                  value={primaryRpc}
                  onChange={(e) => {
                    setPrimaryRpc(e.target.value);
                    setTestResult1({ status: 'idle' });
                  }}
                  placeholder={`例如: https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY_1 (留空则使用默认节点)`}
                  className="w-full bg-slate-900 border border-slate-700/90 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />

                {/* Node 1 Test status */}
                {testResult1.status !== 'idle' && (
                  <div className={`p-2 rounded text-[11px] flex items-center gap-1.5 ${
                    testResult1.status === 'success'
                      ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-800/40'
                      : testResult1.status === 'testing'
                      ? 'bg-slate-900 text-slate-300 border border-slate-800'
                      : testResult1.status === 'warning'
                      ? 'bg-amber-950/50 text-amber-300 border border-amber-800/40'
                      : 'bg-rose-950/50 text-rose-300 border border-rose-800/40'
                  }`}>
                    {testResult1.status === 'testing' && <Activity className="w-3 h-3 text-cyan-400 animate-spin shrink-0" />}
                    {testResult1.status === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                    {testResult1.status === 'warning' && <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                    {testResult1.status === 'error' && <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                    <span>{testResult1.status === 'testing' ? '正在连接测试节点 1...' : testResult1.message}</span>
                  </div>
                )}
              </div>

              {/* Node 2: Secondary Alchemy (Load Balancer) */}
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    <span>分流 / 备用节点 (Alchemy #2 / 开启双开并发加速)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handlePasteTo('secondary')}
                      className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[11px] bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-800/50"
                    >
                      <Clipboard className="w-3 h-3" />
                      <span>粘贴</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTestSingle(2)}
                      disabled={testResult2.status === 'testing' || isBatchTesting || !secondaryRpc.trim()}
                      className="text-slate-300 hover:text-white flex items-center gap-1 text-[11px] bg-slate-800 px-2 py-0.5 rounded border border-slate-700 disabled:opacity-50"
                    >
                      <Activity className={`w-3 h-3 text-cyan-400 ${testResult2.status === 'testing' ? 'animate-spin' : ''}`} />
                      <span>测速</span>
                    </button>
                  </div>
                </div>

                <input
                  type="url"
                  value={secondaryRpc}
                  onChange={(e) => {
                    setSecondaryRpc(e.target.value);
                    setTestResult2({ status: 'idle' });
                  }}
                  placeholder="例如: https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY_2 (选填，填入即激活双节点分流)"
                  className="w-full bg-slate-900 border border-slate-700/90 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />

                {/* Node 2 Test status */}
                {testResult2.status !== 'idle' && (
                  <div className={`p-2 rounded text-[11px] flex items-center gap-1.5 ${
                    testResult2.status === 'success'
                      ? 'bg-cyan-950/50 text-cyan-300 border border-cyan-800/40'
                      : testResult2.status === 'testing'
                      ? 'bg-slate-900 text-slate-300 border border-slate-800'
                      : testResult2.status === 'warning'
                      ? 'bg-amber-950/50 text-amber-300 border border-amber-800/40'
                      : 'bg-rose-950/50 text-rose-300 border border-rose-800/40'
                  }`}>
                    {testResult2.status === 'testing' && <Activity className="w-3 h-3 text-cyan-400 animate-spin shrink-0" />}
                    {testResult2.status === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                    {testResult2.status === 'warning' && <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                    {testResult2.status === 'error' && <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                    <span>{testResult2.status === 'testing' ? '正在连接测试节点 2...' : testResult2.message}</span>
                  </div>
                )}
              </div>

              {/* One-click Test Both Button */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handleTestBoth}
                  disabled={isBatchTesting}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Activity className={`w-3.5 h-3.5 text-cyan-400 ${isBatchTesting ? 'animate-spin' : ''}`} />
                  <span>{isBatchTesting ? '正在并发测速两节点...' : '一键测速两节点'}</span>
                </button>

                <span className="text-[11px] text-slate-500 font-mono truncate max-w-[280px]" title={activeChain.rpcUrl}>
                  公共备底: {activeChain.rpcUrl}
                </span>
              </div>
            </div>
          ) : (
            /* Advanced Multi-line Mode */
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">批量输入多个 RPC 地址（每行一个）：</span>
                <button
                  type="button"
                  onClick={() => handlePasteTo('multi')}
                  className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 text-[11px] bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/50"
                >
                  <Clipboard className="w-3 h-3" />
                  <span>粘贴文本</span>
                </button>
              </div>
              <textarea
                rows={5}
                value={multilineRpc}
                onChange={(e) => setMultilineRpc(e.target.value)}
                placeholder={`https://eth-mainnet.g.alchemy.com/v2/KEY_1\nhttps://eth-mainnet.g.alchemy.com/v2/KEY_2`}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 custom-scrollbar"
              />
              <p className="text-[11px] text-slate-400">系统将自动提取有效 https:// 开头的链接并在抢购时轮流均摊各个钱包。</p>
            </div>
          )}

          {/* Dual Alchemy Benefit Confirmation Card */}
          {isDualAlchemyReady && !isAdvancedMode && (
            <div className="p-3 bg-gradient-to-r from-emerald-950/40 via-cyan-950/40 to-slate-900 rounded-xl border border-cyan-500/30 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold text-cyan-300">双 Alchemy 负载分流加速已激活</span>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  抢购时，钱包将以轮询策略分别接入节点 1 与节点 2：
                  <span className="block font-mono text-emerald-400 text-[10px] mt-0.5">
                    • 奇数钱包 (1, 3, 5...) ➔ 走主节点 Alchemy #1 <br />
                    • 偶数钱包 (2, 4, 6...) ➔ 走分流节点 Alchemy #2
                  </span>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <button
            onClick={handleResetCurrent}
            className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors"
            title="恢复当前链为默认公共节点"
          >
            <RefreshCcw className="w-3 h-3" />
            <span>清空当前链私有 RPC</span>
          </button>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-1 shadow-lg shadow-emerald-900/20"
            >
              <Check className="w-3.5 h-3.5" />
              <span>保存配置</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

