import React from 'react';
import { Zap, Clock, Fuel, Shield, Layers, Sliders, AlertCircle } from 'lucide-react';
import { GasConfig, SniperConfig, GasPreset, ChainConfig, PublicDropData } from '../types';

interface SniperSettingsProps {
  sniperConfig: SniperConfig;
  setSniperConfig: React.Dispatch<React.SetStateAction<SniperConfig>>;
  gasConfig: GasConfig;
  setGasConfig: React.Dispatch<React.SetStateAction<GasConfig>>;
  chain: ChainConfig;
  dropData: PublicDropData | null;
  selectedWalletsCount: number;
  layoutMode?: 'cockpit' | 'stack';
}

export const SniperSettings: React.FC<SniperSettingsProps> = ({
  sniperConfig,
  setSniperConfig,
  gasConfig,
  setGasConfig,
  chain,
  dropData,
  selectedWalletsCount,
  layoutMode = 'cockpit',
}) => {
  const [localDateTime, setLocalDateTime] = React.useState(() => {
    if (sniperConfig.targetTimestamp > 0) {
      const d = new Date(sniperConfig.targetTimestamp * 1000);
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
    }
    return '';
  });

  // Keep local datetime in sync when targetTimestamp changes externally (e.g. from dropData)
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

  const handlePresetChange = (preset: GasPreset) => {
    let maxPriority = 1.5;
    let maxFee = 25;

    if (chain.id === 5042) {
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
    } else if (chain.id === 4663 || chain.id === 57073) {
      // L2 gas values (gwei is very small)
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
      // L1 Ethereum / Polygon
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

  const totalQuantity = (sniperConfig.quantityPerWallet || 1) * selectedWalletsCount;
  const singlePrice = dropData ? parseFloat(dropData.mintPriceFormatted) : 0;
  const totalEthCost = (singlePrice * totalQuantity).toFixed(4);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-5">
      {/* Header */}
      <div className="border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white">
              抢购策略与 Gas 加速配置
            </h2>
            <p className="text-[11px] text-slate-400">
              设置触发时机、单钱包铸造配额、EIP-1559 优先抢跑小费与防失败冗余
            </p>
          </div>
        </div>
      </div>

      <div className={layoutMode === 'cockpit' ? 'grid grid-cols-1 gap-4' : 'grid grid-cols-1 md:grid-cols-2 gap-5'}>
        {/* Left Column: Sniper Mode & Timing */}
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-2">
              抢购触发模式
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSniperConfig(prev => ({ ...prev, mode: 'instant' }))}
                className={`p-3 rounded-lg border text-left transition-all ${
                  sniperConfig.mode === 'instant'
                    ? 'bg-emerald-950/40 border-emerald-500/50 text-white shadow-sm'
                    : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <Zap className={`w-3.5 h-3.5 ${sniperConfig.mode === 'instant' ? 'text-emerald-400' : ''}`} />
                  <span>立即发射 (Instant)</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  适用于已经开售的 NFT，点击后立刻并发广播交易
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSniperConfig(prev => ({ ...prev, mode: 'scheduled' }))}
                className={`p-3 rounded-lg border text-left transition-all ${
                  sniperConfig.mode === 'scheduled'
                    ? 'bg-amber-950/40 border-amber-500/50 text-white shadow-sm'
                    : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <Clock className={`w-3.5 h-3.5 ${sniperConfig.mode === 'scheduled' ? 'text-amber-400' : ''}`} />
                  <span>定时狙击 (Wait for Stage)</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  监听开售倒计时，时间一到毫秒级自动触发
                </p>
              </button>
            </div>
          </div>

          {/* If scheduled, show target time input */}
          {sniperConfig.mode === 'scheduled' && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 space-y-2.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-300">
                    目标开售时间 (本地时间)
                  </label>
                  {dropData?.startTime && dropData.startTime > 0 && (
                    <button
                      type="button"
                      onClick={() => setSniperConfig(prev => ({ ...prev, targetTimestamp: dropData.startTime }))}
                      className="text-[10px] text-amber-400 hover:text-amber-300 underline"
                    >
                      对齐链上时间
                    </button>
                  )}
                </div>
                <input
                  type="datetime-local"
                  step="1"
                  value={localDateTime}
                  onChange={(e) => handleDateTimeChange(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {sniperConfig.targetTimestamp > 0 && (
                <div className="text-[10px] text-slate-400 bg-slate-900/60 px-2 py-1 rounded">
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
                      return `⚡ 目标时间已到或已过`;
                    }
                  })()}
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>网络广播提前量 (毫秒)</span>
                <span className="font-mono text-amber-400">{sniperConfig.triggerAdvanceMs} ms</span>
              </div>
              <input
                type="range"
                min="0"
                max="1500"
                step="50"
                value={sniperConfig.triggerAdvanceMs}
                onChange={(e) => setSniperConfig(prev => ({ ...prev, triggerAdvanceMs: Number(e.target.value) }))}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <p className="text-[10px] text-slate-500">
                提前约 200~300ms 发送可抵消网络传输时间，争取在出块首笔交易完成打包
              </p>
            </div>
          )}

          {/* Quantity Per Wallet */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1.5">
              <span>单钱包铸造数量 (Quantity)</span>
              {dropData && dropData.maxTotalMintableByWallet > 0 && (
                <span className="text-[11px] text-cyan-400 font-normal">
                  合约限额: 最大 {dropData.maxTotalMintableByWallet} 个
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max={dropData?.maxTotalMintableByWallet || 100}
                value={sniperConfig.quantityPerWallet}
                onChange={(e) => setSniperConfig(prev => ({
                  ...prev,
                  quantityPerWallet: Math.max(1, parseInt(e.target.value) || 1)
                }))}
                className="w-28 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs sm:text-sm font-mono text-white text-center focus:outline-none focus:border-emerald-500"
              />
              <div className="flex gap-1">
                {[1, 2, 3, 5].map(q => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setSniperConfig(prev => ({ ...prev, quantityPerWallet: q }))}
                    className={`px-2.5 py-1.5 text-xs rounded border transition-colors ${
                      sniperConfig.quantityPerWallet === q
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Gas Settings */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Fuel className="w-3.5 h-3.5 text-emerald-400" />
                <span>Gas 优先小费策略 (EIP-1559)</span>
              </label>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: 'standard', name: '标准' },
                { id: 'fast', name: '极速 (+50%)' },
                { id: 'sniper', name: '狙击抢跑' },
                { id: 'custom', name: '自定义' },
              ].map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handlePresetChange(preset.id as GasPreset)}
                  className={`py-2 px-1 text-center rounded-lg border text-xs font-medium transition-colors ${
                    gasConfig.preset === preset.id
                      ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300 font-bold'
                      : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Gas values */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  Max Priority Fee (Gwei)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={gasConfig.maxPriorityFeePerGasGwei}
                  disabled={gasConfig.preset !== 'custom' && gasConfig.preset !== 'sniper'}
                  onChange={(e) => setGasConfig(prev => ({
                    ...prev,
                    maxPriorityFeePerGasGwei: parseFloat(e.target.value) || 0
                  }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-emerald-500 disabled:opacity-70"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  Max Fee Per Gas (Gwei)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={gasConfig.maxFeePerGasGwei}
                  disabled={gasConfig.preset !== 'custom' && gasConfig.preset !== 'sniper'}
                  onChange={(e) => setGasConfig(prev => ({
                    ...prev,
                    maxFeePerGasGwei: parseFloat(e.target.value) || 0
                  }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-emerald-500 disabled:opacity-70"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                <span>Gas Limit 安全冗余倍数</span>
                <span className="font-mono text-emerald-400">{gasConfig.gasLimitMultiplier}x</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="1.5"
                step="0.05"
                value={gasConfig.gasLimitMultiplier}
                onChange={(e) => setGasConfig(prev => ({ ...prev, gasLimitMultiplier: parseFloat(e.target.value) }))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <p className="text-[10px] text-slate-500 mt-0.5">
                预留 20% 空间，防范热门铸造时因合约内部状态更新导致的 Out Of Gas
              </p>
            </div>
          </div>

          {/* Summary Box */}
          <div className="bg-slate-950/40 border border-slate-800/80 rounded-lg p-3 text-xs flex items-center justify-between">
            <span className="text-slate-400">预计总铸造量 & 资金需求:</span>
            <div className="text-right">
              <span className="font-bold text-white">
                共 {totalQuantity} 个 NFT
              </span>
              <span className="text-slate-400 text-[11px] ml-2">
                (≈ {totalEthCost} {chain.nativeSymbol})
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
