import React from 'react';
import { Shield, BookOpen, Settings, Zap, CheckCircle2, ChevronDown, RefreshCw, LayoutGrid, Columns2, Split } from 'lucide-react';
import { SUPPORTED_CHAINS } from '../constants/chains';
import { ChainConfig, WalletAccount } from '../types';
import { parseRpcUrls } from '../utils/seadrop';

interface HeaderProps {
  currentChain: ChainConfig;
  onSelectChain: (chain: ChainConfig) => void;
  wallets: WalletAccount[];
  onOpenDocs: () => void;
  onOpenRpcModal: () => void;
  onRefreshBalances: () => void;
  isRefreshing: boolean;
  customRpc?: string;
  layoutMode?: 'cockpit' | 'stack';
  onToggleLayoutMode?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentChain,
  onSelectChain,
  wallets,
  onOpenDocs,
  onOpenRpcModal,
  onRefreshBalances,
  isRefreshing,
  customRpc,
  layoutMode = 'cockpit',
  onToggleLayoutMode,
}) => {
  const [chainMenuOpen, setChainMenuOpen] = React.useState(false);

  const totalBalance = wallets.reduce((acc, w) => {
    try {
      const b = parseFloat(w.balanceFormatted || '0');
      return acc + (isNaN(b) ? 0 : b);
    } catch {
      return acc;
    }
  }, 0);

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-30 px-4 lg:px-6 py-3">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Left: Brand / Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-slate-950 font-black">
            <Zap className="w-5 h-5 fill-current" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                NFT 公共铸造抢购工具
              </h1>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                SeaDrop Sniper v2.0
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              基于 morsyxbt/nft-public-mint 架构 · 纯链上多链多钱包并发抢购
            </p>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2 sm:gap-3 ml-auto">
          {/* Chain Selector */}
          <div className="relative">
            <button
              id="chain-selector-btn"
              onClick={() => setChainMenuOpen(!chainMenuOpen)}
              className="flex items-center gap-2 bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-200 transition-colors"
            >
              <span
                className="w-2.5 h-2.5 rounded-full ring-2 ring-slate-950"
                style={{ backgroundColor: currentChain.iconColor }}
              />
              <span className="font-semibold">{currentChain.nameZh}</span>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>

            {chainMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setChainMenuOpen(false)}
                />
                <div className="absolute right-0 mt-1 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1 z-50">
                  <div className="px-3 py-1.5 text-[11px] font-medium text-slate-400 border-b border-slate-800">
                    选择公链网络 (EVM)
                  </div>
                  {SUPPORTED_CHAINS.map((chain) => (
                    <button
                      key={chain.id}
                      onClick={() => {
                        onSelectChain(chain);
                        setChainMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-slate-800/80 transition-colors ${
                        chain.id === currentChain.id ? 'bg-slate-800 text-emerald-400 font-semibold' : 'text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: chain.iconColor }}
                        />
                        <span>{chain.nameZh}</span>
                      </div>
                      {chain.isTestnet && (
                        <span className="text-[10px] bg-purple-950/60 text-purple-400 border border-purple-800/40 px-1.5 py-0.2 rounded">
                          测试网
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* RPC Config Trigger */}
          {(() => {
            const parsedCount = parseRpcUrls(customRpc).length;
            return (
              <button
                id="rpc-config-btn"
                onClick={onOpenRpcModal}
                className={`p-2 rounded-lg border text-xs transition-colors flex items-center gap-1.5 ${
                  parsedCount > 1
                    ? 'bg-cyan-950/50 border-cyan-500/40 text-cyan-300 shadow-sm shadow-cyan-950'
                    : parsedCount === 1
                    ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400'
                    : 'bg-slate-800/80 border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
                title={parsedCount > 1 ? `已配置 ${parsedCount} 个节点，开启多钱包轮询负载均衡` : '配置独享私有 RPC 节点'}
              >
                {parsedCount > 1 ? (
                  <Split className="w-3.5 h-3.5 text-cyan-400" />
                ) : (
                  <Settings className="w-3.5 h-3.5" />
                )}
                <span className="hidden md:inline">
                  {parsedCount > 1 ? `双/多节点分流 (${parsedCount}x)` : parsedCount === 1 ? '独享 RPC' : 'RPC 设置'}
                </span>
              </button>
            );
          })()}

          {/* Balance Refresh */}
          <button
            id="refresh-balances-btn"
            onClick={onRefreshBalances}
            disabled={isRefreshing}
            className="p-2 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-lg text-slate-300 hover:text-white transition-colors text-xs flex items-center gap-1.5"
            title="刷新全部钱包余额"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
            <span className="hidden lg:inline">
              余额: {totalBalance.toFixed(4)} {currentChain.nativeSymbol}
            </span>
          </button>

          {/* Layout Mode Toggle */}
          {onToggleLayoutMode && (
            <button
              id="layout-toggle-btn"
              onClick={onToggleLayoutMode}
              className="p-2 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-lg text-slate-300 hover:text-white transition-colors text-xs flex items-center gap-1.5"
              title={layoutMode === 'cockpit' ? '当前：分栏驾驶舱模式 (点击切换为宽屏单栏)' : '当前：宽屏单栏模式 (点击切换为分栏驾驶舱)'}
            >
              {layoutMode === 'cockpit' ? (
                <>
                  <Columns2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden xl:inline">驾驶舱视图</span>
                </>
              ) : (
                <>
                  <LayoutGrid className="w-3.5 h-3.5 text-slate-400" />
                  <span className="hidden xl:inline">单栏视图</span>
                </>
              )}
            </button>
          )}

          {/* Docs / Guide */}
          <button
            id="docs-btn"
            onClick={onOpenDocs}
            className="p-2 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-lg text-slate-300 hover:text-white transition-colors text-xs flex items-center gap-1.5"
            title="使用文档与原版特性说明"
          >
            <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">文档指南</span>
          </button>
        </div>
      </div>
    </header>
  );
};
