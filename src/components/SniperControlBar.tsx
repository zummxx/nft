import React from 'react';
import {
  Zap,
  Clock,
  Fuel,
  Sliders,
  ShieldCheck,
  Square,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Activity,
  Layers,
  ArrowRight
} from 'lucide-react';
import { GasConfig, SniperConfig, GasPreset, ChainConfig, PublicDropData } from '../types';

interface SniperControlBarProps {
  sniperConfig: SniperConfig;
  setSniperConfig: React.Dispatch<React.SetStateAction<SniperConfig>>;
  gasConfig: GasConfig;
  setGasConfig: React.Dispatch<React.SetStateAction<GasConfig>>;
  chain: ChainConfig;
  dropData: PublicDropData | null;
  selectedWalletsCount: number;
  onSimulate: () => void;
  onStartSnipe: () => void;
  onCancelSnipe: () => void;
  isSimulating: boolean;
  isExecuting: boolean;
  isCountdownActive: boolean;
  countdownSeconds: number;
}

export const SniperControlBar: React.FC<SniperControlBarProps> = ({
  sniperConfig,
  setSniperConfig,
  gasConfig,
  setGasConfig,
  chain,
  dropData,
  selectedWalletsCount,
  onSimulate,
  onStartSnipe,
  onCancelSnipe,
  isSimulating,
  isExecuting,
  isCountdownActive,
  countdownSeconds,
}) => {
  const [showAdvancedGas, setShowAdvancedGas] = React.useState(false);
  const [localDateTime, setLocalDateTime] = React.useState(() => {
    if (sniperConfig.targetTimestamp > 0) {
      const d = new Date(sniperConfig.targetTimestamp * 1000);
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
    }
    return '';
  });

  React.useEffect(() => {
    if (sniperConfig.targetTimestamp > 0) {
      const d = new Date(sniperConfig.targetTimestamp * 1000);
      setLocalDateTime(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19));
    }
  }, [sniperConfig.targetTimestamp]);

  const handleDateTimeChange = (val: string) => {
    setLocalDateTime(val);
    if (!val) {
      setSniperConfig(prev => ({ ...prev, targetTimestamp: 0 }));
      return;
    }
    const d = new Date(val);
    const ts = Math.floor(d.getTime() / 1000);
    setSniperConfig(prev => ({ ...prev, targetTimestamp: ts }));
  };

  const isArc = chain.id === 5042;
  const isL2 = chain.id === 4663 || chain.id === 57073;

  const handlePresetChange = (preset: GasPreset) => {
    let maxPriority = 1.5;
    let maxFee = 25;

    if (isArc) {
      // Arc chain custom gas presets:
      // 标准模式: 小费 10, 最大 30 Gwei
      // 极速模式: 小费 20, 最大 60 Gwei
      // 狙击抢跑: 小费 30, 最大 100 Gwei
      if (preset === 'standard') {
        maxPriority = 10;
        maxFee = 30;
      } else if (preset === 'fast') {
        maxPriority = 20;
        maxFee = 60;
      } else if (preset === 'sniper') {
        maxPriority = 30;
        maxFee = 100;
      }
    } else if (isL2) {
      if (preset === 'standard') {
        maxPriority = 0.01;
        maxFee = 0.1;
      } else if (preset === 'fast') {
        maxPriority = 0.05;
        maxFee = 0.2;
      } else if (preset === 'sniper') {
        maxPriority = 0.2;
        maxFee = 1.0;
      }
    } else {
      if (preset === 'standard') {
        maxPriority = 1.5;
        maxFee = 25;
      } else if (preset === 'fast') {
        maxPriority = 3.0;
        maxFee = 45;
      } else if (preset === 'sniper') {
        maxPriority = 8.0;
        maxFee = 80;
      }
    }

    setGasConfig({
      preset,
      maxPriorityFeePerGasGwei: maxPriority,
      maxFeePerGasGwei: maxFee,
      gasLimitMultiplier: gasConfig.gasLimitMultiplier || 1.2,
    });
  };

  const handlePriorityFeeChange = (val: number) => {
    setGasConfig(prev => ({
      ...prev,
      preset: 'custom',
      maxPriorityFeePerGasGwei: val,
      maxFeePerGasGwei: Math.max(val, prev.maxFeePerGasGwei)
    }));
  };

  const handleMaxFeeChange = (val: number) => {
    setGasConfig(prev => ({
      ...prev,
      preset: 'custom',
      maxFeePerGasGwei: val,
      maxPriorityFeePerGasGwei: Math.min(val, prev.maxPriorityFeePerGasGwei)
    }));
  };

  const handleGasMultiplierChange = (val: number) => {
    setGasConfig(prev => ({
      ...prev,
      preset: 'custom',
      gasLimitMultiplier: val
    }));
  };

  const formatCountdown = (totalSec: number) => {
    if (totalSec <= 0) return '00:00:00';
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    const timeStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return days > 0 ? `${days}天 ${timeStr}` : timeStr;
  };

  const isReady = Boolean(dropData && dropData.isFetched && selectedWalletsCount > 0);
  const totalQuantity = (sniperConfig.quantityPerWallet || 1) * selectedWalletsCount;
  const singlePrice = dropData ? parseFloat(dropData.mintPriceFormatted) : 0;
  const totalEthCost = (singlePrice * totalQuantity).toFixed(4);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-2xl space-y-4">
      {/* If countdown active banner */}
      {isCountdownActive && (
        <div className="bg-amber-950/70 border border-amber-500/60 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-amber-200 animate-pulse">
          <div className="flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-amber-400 animate-spin" />
            <div>
              <div className="text-sm font-bold text-white">定时狙击监听已激活</div>
              <div className="text-xs text-amber-300">
                目标时间戳: {sniperConfig.targetTimestamp} · 提前 {sniperConfig.triggerAdvanceMs}ms 瞬间并发广播
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono text-2xl font-black text-amber-400 tracking-wider">
              {formatCountdown(countdownSeconds)}
            </span>
            <button
              onClick={onCancelSnipe}
              className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-md shadow-red-950"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>中止任务</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Grid: 3 Large Blocks in One Big Horizontal Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        {/* Block 1: 抢购模式与触发策略 (4 cols) */}
        <div className="lg:col-span-4 bg-slate-950/70 border border-slate-800/90 rounded-xl p-3 sm:p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>抢购模式与时间</span>
            </span>
            <span className="text-[11px] font-mono text-slate-400">{chain.name}</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-900 p-1 rounded-lg border border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setSniperConfig(prev => ({ ...prev, mode: 'instant' }))}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  sniperConfig.mode === 'instant'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>立即开火</span>
              </button>
              <button
                type="button"
                onClick={() => setSniperConfig(prev => ({ ...prev, mode: 'scheduled' }))}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  sniperConfig.mode === 'scheduled'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>定时抢购</span>
              </button>
            </div>

            {/* Quantity Selector */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg grow justify-between">
              <span className="text-xs text-slate-400">单包张数:</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="1"
                  max={dropData?.maxTotalMintableByWallet || 100}
                  value={sniperConfig.quantityPerWallet}
                  onChange={(e) => setSniperConfig(prev => ({
                    ...prev,
                    quantityPerWallet: Math.max(1, parseInt(e.target.value) || 1)
                  }))}
                  className="w-12 bg-slate-950 border border-slate-700/80 rounded px-1.5 py-0.5 text-xs font-mono text-white text-center font-bold"
                />
                <div className="flex gap-0.5">
                  {[1, 2, 3].map(q => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setSniperConfig(prev => ({ ...prev, quantityPerWallet: q }))}
                      className={`px-1.5 py-0.5 text-[11px] rounded font-medium ${
                        sniperConfig.quantityPerWallet === q
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Scheduled Time & Advance ms Config */}
          {sniperConfig.mode === 'scheduled' && (
            <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 grow">
                  <span className="text-[11px] text-slate-400 shrink-0">开售时间:</span>
                  <input
                    type="datetime-local"
                    step="1"
                    value={localDateTime}
                    onChange={(e) => handleDateTimeChange(e.target.value)}
                    className="bg-slate-900 border border-slate-700/80 rounded px-2 py-1 text-xs font-mono text-white focus:outline-none focus:border-amber-500 grow min-w-[170px]"
                  />
                </div>
                {dropData?.startTime && dropData.startTime > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSniperConfig(prev => ({ ...prev, targetTimestamp: dropData.startTime }));
                    }}
                    className="px-2 py-1 text-[10px] rounded bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border border-amber-800/60 transition-colors shrink-0"
                    title="一键同步链上读取到的实际开售时间"
                  >
                    对齐链上时间
                  </button>
                )}
                <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 px-2 py-1 rounded shrink-0">
                  <span className="text-[11px] text-slate-400">提前量:</span>
                  <input
                    type="number"
                    min="0"
                    max="2000"
                    step="50"
                    value={sniperConfig.triggerAdvanceMs}
                    onChange={(e) => setSniperConfig(prev => ({ ...prev, triggerAdvanceMs: Number(e.target.value) || 0 }))}
                    className="w-16 bg-slate-950 border border-slate-700/80 rounded px-1 text-xs font-mono text-amber-400 text-center font-bold"
                  />
                  <span className="text-[10px] text-slate-400">ms</span>
                </div>
              </div>

              {/* Status Hint */}
              {sniperConfig.targetTimestamp > 0 && (
                <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
                  <span>
                    {(() => {
                      const nowSec = Math.floor(Date.now() / 1000);
                      const diff = sniperConfig.targetTimestamp - nowSec;
                      if (diff > 0) {
                        const days = Math.floor(diff / 86400);
                        const hours = Math.floor((diff % 86400) / 3600);
                        const mins = Math.floor((diff % 3600) / 60);
                        const secs = diff % 60;
                        const dStr = days > 0 ? `${days}天` : '';
                        return `⏳ 距目标时间还剩: ${dStr}${hours}小时${mins}分${secs}秒`;
                      } else {
                        return `⚡ 目标时间已到或已过，点击开火将直接发起铸造`;
                      }
                    })()}
                  </span>
                  <span className="font-mono text-slate-500">TS: {sniperConfig.targetTimestamp}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Block 2: Gas 极速预设与手动微调 (5 cols - 大气布局) */}
        <div className="lg:col-span-5 bg-slate-950/70 border border-slate-800/90 rounded-xl p-3 sm:p-3.5 space-y-2.5">
          {/* Header & Presets */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
              <Fuel className="w-3.5 h-3.5 text-emerald-400" />
              <span>EIP-1559 链上手续费 (Gas 手动设置)</span>
            </div>

            {/* Presets Button Group */}
            <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 gap-1">
              {[
                { id: 'standard', label: '标准' },
                { id: 'fast', label: '极速' },
                { id: 'sniper', label: '抢跑' },
              ].map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handlePresetChange(p.id as GasPreset)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                    gasConfig.preset === p.id
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Manual Input Fields - Prominent & Big */}
          <div className="grid grid-cols-3 gap-2">
            {/* Priority Fee */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                <span>矿工小费 (Tip)</span>
                <span className="text-[10px] text-emerald-400 font-mono">Priority</span>
              </div>
              <div className="flex items-center gap-1">
                <input
                  id="gas-priority-fee-input"
                  type="number"
                  step={isL2 ? '0.001' : '0.1'}
                  min="0.0001"
                  value={gasConfig.maxPriorityFeePerGasGwei}
                  onChange={(e) => handlePriorityFeeChange(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded px-2 py-1 text-sm font-mono text-emerald-300 font-bold focus:outline-none focus:border-emerald-500"
                />
                <span className="text-[10px] text-slate-500 font-mono shrink-0">Gwei</span>
              </div>
            </div>

            {/* Max Fee */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                <span>最高上限 (Max)</span>
                <span className="text-[10px] text-cyan-400 font-mono">Base+Tip</span>
              </div>
              <div className="flex items-center gap-1">
                <input
                  id="gas-max-fee-input"
                  type="number"
                  step={isL2 ? '0.01' : '1'}
                  min="0.001"
                  value={gasConfig.maxFeePerGasGwei}
                  onChange={(e) => handleMaxFeeChange(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded px-2 py-1 text-sm font-mono text-cyan-300 font-bold focus:outline-none focus:border-cyan-500"
                />
                <span className="text-[10px] text-slate-500 font-mono shrink-0">Gwei</span>
              </div>
            </div>

            {/* Gas Limit Buffer */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                <span>限制倍率 (Limit)</span>
                <span className="text-[10px] text-amber-400 font-mono">Buffer</span>
              </div>
              <div className="flex items-center gap-1">
                <input
                  id="gas-limit-multiplier-input"
                  type="number"
                  step="0.05"
                  min="1.0"
                  max="3.0"
                  value={gasConfig.gasLimitMultiplier || 1.2}
                  onChange={(e) => handleGasMultiplierChange(parseFloat(e.target.value) || 1.2)}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded px-2 py-1 text-sm font-mono text-amber-300 font-bold focus:outline-none focus:border-amber-500"
                />
                <span className="text-[10px] text-slate-500 font-mono shrink-0">倍</span>
              </div>
            </div>
          </div>
        </div>

        {/* Block 3: 发射主控台 & 状态汇总 (3 cols) */}
        <div className="lg:col-span-3 bg-slate-950/70 border border-slate-800/90 rounded-xl p-3 sm:p-3.5 flex flex-col justify-between space-y-3">
          {/* Target Status Summary */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <div>
              <span className="text-[11px] text-slate-400">已就绪钱包</span>
              <div className="text-sm font-bold text-white">
                {isReady ? (
                  <span><strong className="text-emerald-400">{selectedWalletsCount}</strong> 个钱包 · 共 <strong className="text-emerald-400">{totalQuantity}</strong> 份</span>
                ) : (
                  <span className="text-slate-500 text-xs">等待连接与勾选</span>
                )}
              </div>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-slate-400">预估代币总花费</span>
              <div className="text-xs font-mono font-bold text-white">
                {isReady ? `${totalEthCost} ${chain.nativeSymbol}` : '0.00'}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Dry Run Button */}
            <button
              id="top-dry-run-btn"
              onClick={onSimulate}
              disabled={!isReady || isSimulating || isExecuting || isCountdownActive}
              className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors flex items-center justify-center gap-1.5 shrink-0"
              title="预估各钱包 nonce 与模拟上链"
            >
              {isSimulating ? (
                <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              )}
              <span>模拟校验</span>
            </button>

            {/* Main Action Button */}
            {isCountdownActive ? (
              <button
                id="top-cancel-snipe-btn"
                onClick={onCancelSnipe}
                className="grow py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-red-950"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>中止监听</span>
              </button>
            ) : (
              <button
                id="top-start-snipe-btn"
                onClick={onStartSnipe}
                disabled={!isReady || isExecuting || isSimulating}
                className={`grow py-2.5 text-white text-xs font-extrabold rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-xl ${
                  !isReady
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                    : sniperConfig.mode === 'scheduled'
                    ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-950/60'
                    : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/60 animate-pulse'
                }`}
              >
                {isExecuting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>并发广播中...</span>
                  </>
                ) : sniperConfig.mode === 'scheduled' ? (
                  <>
                    <Clock className="w-4 h-4 text-amber-200" />
                    <span>启动定时抢购</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-current" />
                    <span>一键并发发射 (Fire)</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
