import React, { useState } from 'react';
import { Server, Check, AlertCircle, RefreshCcw, Activity, Clipboard, ExternalLink, Zap, CheckCircle2, XCircle } from 'lucide-react';
import { ChainConfig } from '../types';
import { SUPPORTED_CHAINS } from '../constants/chains';
import { ethers } from 'ethers';

interface CustomRpcModalProps {
  currentChain: ChainConfig;
  customRpcs: Record<number, string>;
  onSaveRpc: (chainId: number, rpcUrl: string) => void;
  onResetRpc: (chainId: number) => void;
  onClearAllRpcs: () => void;
  onSelectChain: (chain: ChainConfig) => void;
  onClose: () => void;
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

  const [rpcInput, setRpcInput] = useState<string>(customRpcs[activeChain.id] || '');
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    status: 'idle' | 'success' | 'warning' | 'error';
    latencyMs?: number;
    detectedChainId?: number;
    latestBlock?: number;
    message?: string;
  }>({ status: 'idle' });

  // When switching chain inside the modal, sync input
  const handleSwitchModalChain = (chain: ChainConfig) => {
    setSelectedChainId(chain.id);
    setRpcInput(customRpcs[chain.id] || '');
    setTestResult({ status: 'idle' });
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setRpcInput(text.trim());
        setTestResult({ status: 'idle' });
      }
    } catch (e) {
      console.warn('Clipboard read failed:', e);
    }
  };

  const handleTestRpc = async () => {
    const url = rpcInput.trim() || activeChain.rpcUrl;
    setIsTesting(true);
    setTestResult({ status: 'idle' });

    try {
      const startTime = performance.now();
      // Test with dynamic detection
      const provider = new ethers.JsonRpcProvider(url, undefined, { staticNetwork: false });
      
      const [network, blockNumber] = await Promise.all([
        provider.getNetwork(),
        provider.getBlockNumber()
      ]);
      const latencyMs = Math.round(performance.now() - startTime);
      const detectedId = Number(network.chainId);

      if (detectedId === activeChain.id) {
        setTestResult({
          status: 'success',
          latencyMs,
          detectedChainId: detectedId,
          latestBlock: blockNumber,
          message: `节点状态优良！延迟 ${latencyMs}ms，区块 #${blockNumber}，Chain ID 完全匹配 (${detectedId})。`
        });
      } else {
        const otherChain = SUPPORTED_CHAINS.find(c => c.id === detectedId);
        const otherName = otherChain ? otherChain.nameZh : `未知网络 (ID: ${detectedId})`;
        setTestResult({
          status: 'warning',
          latencyMs,
          detectedChainId: detectedId,
          latestBlock: blockNumber,
          message: `⚠️ 链不匹配！该节点返回的 Chain ID 是 ${detectedId} (${otherName})，而当前配置的是 ${activeChain.nameZh} (${activeChain.id})！请将此 RPC 配置到对应的网络中。`
        });
      }
    } catch (err: any) {
      setTestResult({
        status: 'error',
        message: `❌ 连接失败: ${err?.message || '请求超时或无法访问该 RPC 地址'}`
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    onSaveRpc(activeChain.id, rpcInput.trim());
    if (activeChain.id !== currentChain.id) {
      onSelectChain(activeChain);
    }
    onClose();
  };

  const handleResetCurrent = () => {
    setRpcInput('');
    onResetRpc(activeChain.id);
    setTestResult({ status: 'idle' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xl w-full p-5 space-y-4 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-white text-base">多网络独享私有 RPC 节点配置</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded bg-slate-800">
            关闭
          </button>
        </div>

        {/* Description */}
        <div className="text-xs text-slate-400 leading-relaxed bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
          💡 <span className="text-slate-300 font-semibold">独立隔离机制</span>：每个公链（Robinhood、Ink、Base 等）拥有<strong className="text-emerald-400">独立的私有 RPC 配置</strong>。切换网络时会自动匹配对应链的 RPC，绝不互相串线或导致查询报错！
        </div>

        {/* Chain selector tabs */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300">选择要配置的目标公链：</label>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-slate-950/50 rounded-lg border border-slate-800/60">
            {SUPPORTED_CHAINS.map(chain => {
              const isSelected = chain.id === activeChain.id;
              const hasCustom = Boolean(customRpcs[chain.id]);
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
                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-emerald-400'}`} title="已配置独享私有 RPC" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Chain Config Area */}
        <div className="space-y-3 bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: activeChain.iconColor }} />
              <span className="text-sm font-semibold text-white">{activeChain.nameZh}</span>
              <span className="text-[11px] text-slate-500 font-mono">Chain ID: {activeChain.id}</span>
            </div>
            {customRpcs[activeChain.id] ? (
              <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950 text-emerald-400 border border-emerald-800">
                已启用独享 RPC
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-400">
                使用公共默认节点
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>专属私有 RPC URL (Alchemy / Infura / QuickNode 等):</span>
              <button
                type="button"
                onClick={handlePaste}
                className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 text-[11px] bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60"
              >
                <Clipboard className="w-3 h-3" />
                <span>一键粘贴</span>
              </button>
            </div>

            <input
              type="url"
              value={rpcInput}
              onChange={(e) => {
                setRpcInput(e.target.value);
                setTestResult({ status: 'idle' });
              }}
              placeholder={`留空则使用默认节点: ${activeChain.rpcUrl}`}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Test connection & Latency check */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={handleTestRpc}
              disabled={isTesting}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Activity className={`w-3.5 h-3.5 text-cyan-400 ${isTesting ? 'animate-spin' : ''}`} />
              <span>{isTesting ? '正在测速并检测链ID...' : '测速与校验节点'}</span>
            </button>

            <span className="text-[11px] text-slate-500 font-mono truncate max-w-[240px]" title={activeChain.rpcUrl}>
              默认: {activeChain.rpcUrl}
            </span>
          </div>

          {/* Test Feedback Box */}
          {testResult.status !== 'idle' && (
            <div
              className={`p-2.5 rounded-lg border text-xs leading-relaxed flex items-start gap-2 ${
                testResult.status === 'success'
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  : testResult.status === 'warning'
                  ? 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                  : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
              }`}
            >
              {testResult.status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
              {testResult.status === 'warning' && <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />}
              {testResult.status === 'error' && <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />}
              <div>{testResult.message}</div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
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
              <span>保存当前公链配置</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
