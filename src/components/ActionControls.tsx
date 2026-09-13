import React from 'react';
import { Play, ShieldCheck, Square, Clock, Zap, CheckCircle2, AlertOctagon } from 'lucide-react';
import { SniperConfig, PublicDropData, ChainConfig } from '../types';

interface ActionControlsProps {
  onSimulate: () => void;
  onStartSnipe: () => void;
  onCancelSnipe: () => void;
  isSimulating: boolean;
  isExecuting: boolean;
  isCountdownActive: boolean;
  countdownSeconds: number;
  selectedWalletsCount: number;
  dropData: PublicDropData | null;
  sniperConfig: SniperConfig;
  chain: ChainConfig;
}

export const ActionControls: React.FC<ActionControlsProps> = ({
  onSimulate,
  onStartSnipe,
  onCancelSnipe,
  isSimulating,
  isExecuting,
  isCountdownActive,
  countdownSeconds,
  selectedWalletsCount,
  dropData,
  sniperConfig,
  chain,
}) => {
  const formatCountdown = (totalSec: number) => {
    if (totalSec <= 0) return '00:00:00';
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isReady = Boolean(dropData && dropData.isFetched && selectedWalletsCount > 0);

  return (
    <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg space-y-4">
      {/* Live Countdown Banner (When scheduled sniping is armed) */}
      {isCountdownActive && (
        <div className="bg-amber-950/50 border border-amber-500/50 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-amber-200 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400">
              <Clock className="w-6 h-6 animate-spin" />
            </div>
            <div>
              <div className="font-bold text-base text-white flex items-center gap-2">
                <span>定时狙击已就绪 · 等待开售区块时间</span>
                <span className="text-xs bg-amber-500 text-slate-950 font-black px-2 py-0.5 rounded">
                  倒计时
                </span>
              </div>
              <p className="text-xs text-amber-300/80 mt-0.5">
                提前 {sniperConfig.triggerAdvanceMs}ms 瞬间并发广播 {selectedWalletsCount} 个钱包的铸造交易
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="font-mono text-2xl sm:text-3xl font-black text-amber-400 tracking-wider">
              {formatCountdown(countdownSeconds)}
            </div>
            <button
              onClick={onCancelSnipe}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>取消监听</span>
            </button>
          </div>
        </div>
      )}

      {/* Primary Buttons */}
      <div className="space-y-3">
        <div className="text-xs text-slate-400 bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5">
          {!isReady ? (
            <span className="text-amber-400 flex items-center gap-1.5">
              <AlertOctagon className="w-4 h-4 shrink-0" />
              <span>请先查询有效的 NFT 合约，并勾选至少一个抢购钱包</span>
            </span>
          ) : (
            <span className="text-emerald-400 flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>已选 {selectedWalletsCount} 个钱包 · 每包 {sniperConfig.quantityPerWallet} 个 · 共计 {(selectedWalletsCount * sniperConfig.quantityPerWallet)} 个 NFT</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
          {/* Dry Run Button */}
          <button
            id="dry-run-simulate-btn"
            onClick={onSimulate}
            disabled={!isReady || isSimulating || isExecuting || isCountdownActive}
            className="w-full px-4 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs sm:text-sm font-semibold rounded-lg border border-slate-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
            title="通过 eth_call 模拟执行，零 Gas 损耗检查交易是否可成功"
          >
            {isSimulating ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
                <span>模拟校验中...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <span>模拟校验 (Dry Run)</span>
              </>
            )}
          </button>

          {/* Main Action Button */}
          {isCountdownActive ? (
            <button
              id="cancel-snipe-btn"
              onClick={onCancelSnipe}
              className="w-full px-5 py-3 bg-red-600 hover:bg-red-500 text-white text-xs sm:text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red-950"
            >
              <Square className="w-4 h-4 fill-current" />
              <span>中止定时监听</span>
            </button>
          ) : (
            <button
              id="start-snipe-btn"
              onClick={onStartSnipe}
              disabled={!isReady || isExecuting || isSimulating}
              className={`w-full px-5 py-3 text-white text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg ${
                !isReady
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : sniperConfig.mode === 'scheduled'
                  ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-950/60'
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/60'
              }`}
            >
              {isExecuting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>并发广播中...</span>
                </>
              ) : sniperConfig.mode === 'scheduled' ? (
                <>
                  <Clock className="w-4 h-4 text-amber-200" />
                  <span>启动定时抢购 (倒计时)</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-current" />
                  <span>立即并发铸造 (Fire Mint)</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
