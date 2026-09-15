import React from 'react';
import { Search, ExternalLink, Clock, DollarSign, Users, AlertTriangle, CheckCircle, Flame, Sparkles, Copy, Check, Clipboard } from 'lucide-react';
import { ChainConfig, PublicDropData } from '../types';
import { DEMO_CONTRACTS } from '../constants/chains';
import { formatAddress } from '../utils/seadrop';

interface ContractConfigProps {
  contractAddress: string;
  setContractAddress: (addr: string) => void;
  onFetchDrop: () => void;
  isLoading: boolean;
  dropData: PublicDropData | null;
  nftName: string;
  nftSymbol: string;
  chain: ChainConfig;
  onApplyScheduleTime: (startTime: number) => void;
  error?: string | null;
  compactMode?: boolean;
}

export const ContractConfig: React.FC<ContractConfigProps> = ({
  contractAddress,
  setContractAddress,
  onFetchDrop,
  isLoading,
  dropData,
  nftName,
  nftSymbol,
  chain,
  onApplyScheduleTime,
  error,
  compactMode = false,
}) => {
  const [copiedFee, setCopiedFee] = React.useState(false);

  const copyFeeRecipient = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedFee(true);
    setTimeout(() => setCopiedFee(false), 1800);
  };

  const formatTimestamp = (ts: number) => {
    if (!ts || ts === 0) return '未设置 / 永久有效';
    const date = new Date(ts * 1000);
    const dateStr = date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    const nowSec = Math.floor(Date.now() / 1000);
    const diff = ts - nowSec;
    if (diff > 0) {
      const days = Math.floor(diff / 86400);
      const hours = Math.floor((diff % 86400) / 3600);
      const mins = Math.floor((diff % 3600) / 60);
      const secs = diff % 60;
      let relative = '';
      if (days > 0) {
        relative = `${days}天${hours}小时后`;
      } else if (hours > 0) {
        relative = `${hours}小时${mins}分后`;
      } else if (mins > 0) {
        relative = `${mins}分${secs}秒后`;
      } else {
        relative = `${secs}秒后`;
      }
      return `${dateStr} (${relative})`;
    } else {
      return `${dateStr} (已开启)`;
    }
  };

  const handlePasteContract = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setContractAddress(text.trim());
      }
    } catch (e) {
      console.warn('Clipboard read failed:', e);
    }
  };

  /* Compact Mode for Right Sidebar (Plan 2) */
  if (compactMode) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Search className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                <span>查询 NFT 合约</span>
                <span className="text-[10px] font-normal text-slate-400">({chain.name})</span>
              </h2>
            </div>
          </div>

          {/* Quick Demo Contract Pill */}
          <div className="flex items-center gap-1">
            {DEMO_CONTRACTS.filter(c => c.chainId === chain.id || chain.isTestnet).slice(0, 2).map(demo => (
              <button
                key={demo.address}
                onClick={() => setContractAddress(demo.address)}
                className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-1.5 py-0.5 rounded border border-slate-700/80 transition-colors"
                title={`快速填入: ${demo.name}`}
              >
                {demo.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Input Row */}
        <div className="space-y-1.5">
          <div className="relative">
            <input
              id="nft-contract-address-input"
              type="text"
              value={contractAddress}
              onChange={(e) => setContractAddress(e.target.value.trim())}
              placeholder="0x... 输入 ERC-721 / SeaDrop 合约地址"
              className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-3 pr-20 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button
                type="button"
                onClick={handlePasteContract}
                className="px-2 py-0.5 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-800/60 rounded flex items-center gap-0.5 transition-colors"
                title="粘贴合约地址"
              >
                <Clipboard className="w-2.5 h-2.5" />
                <span>粘贴</span>
              </button>
              {contractAddress && (
                <button
                  type="button"
                  onClick={() => setContractAddress('')}
                  className="px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-slate-200 bg-slate-800 rounded"
                >
                  清除
                </button>
              )}
            </div>
          </div>

          <button
            id="fetch-contract-drop-btn"
            onClick={onFetchDrop}
            disabled={isLoading || !contractAddress}
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-950"
          >
            {isLoading ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>正在链上解析 SeaDrop 参数...</span>
              </>
            ) : (
              <>
                <Search className="w-3.5 h-3.5" />
                <span>链上读取 SeaDrop 阶段状态</span>
              </>
            )}
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-950/40 border border-red-800/60 rounded-lg p-2.5 text-xs text-red-300 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed break-words">{error}</div>
          </div>
        )}

        {/* Drop Details Display in Compact Sidebar */}
        {dropData && dropData.isFetched && (
          <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 space-y-2.5">
            {/* Name, Status & Explorer */}
            <div className="flex items-center justify-between gap-1.5 border-b border-slate-800/80 pb-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-5 h-5 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px] shrink-0">
                  {nftSymbol ? nftSymbol.slice(0, 3) : 'NFT'}
                </span>
                <span className="font-bold text-white text-xs truncate max-w-[130px]" title={nftName}>
                  {nftName || '未命名'}
                </span>
                <a
                  href={`${chain.explorerUrl}/address/${contractAddress}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-400 hover:text-emerald-300 shrink-0"
                  title="在区块浏览器查看"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* Status Badge */}
              <div className="shrink-0">
                {dropData.isActive ? (
                  <span className="inline-flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded text-[10px] font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    公售中
                  </span>
                ) : dropData.isUpcoming ? (
                  <span className="inline-flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 px-2 py-0.5 rounded text-[10px] font-semibold">
                    <Clock className="w-3 h-3" />
                    未开启
                  </span>
                ) : (
                  <span className="inline-flex items-center bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-[10px]">
                    已结束
                  </span>
                )}
              </div>
            </div>

            {/* Compact 2-column stats */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-900/80 p-2 rounded border border-slate-800/80">
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <DollarSign className="w-2.5 h-2.5 text-emerald-400" />
                  <span>单价</span>
                </div>
                <div className="text-xs font-bold text-white mt-0.5">
                  {dropData.mintPrice === '0' ? (
                    <span className="text-emerald-400">免费 (FREE)</span>
                  ) : (
                    `${dropData.mintPriceFormatted} ${chain.nativeSymbol}`
                  )}
                </div>
              </div>

              <div className="bg-slate-900/80 p-2 rounded border border-slate-800/80">
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Users className="w-2.5 h-2.5 text-cyan-400" />
                  <span>钱包限额</span>
                </div>
                <div className="text-xs font-bold text-white mt-0.5">
                  {dropData.maxTotalMintableByWallet > 0 ? `${dropData.maxTotalMintableByWallet} 个` : '无限制'}
                </div>
              </div>

              <div className="bg-slate-900/80 p-2 rounded border border-slate-800/80">
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5 text-amber-400" />
                  <span>开售时间</span>
                </div>
                <div className="text-[11px] font-semibold text-white mt-0.5 truncate">
                  {formatTimestamp(dropData.startTime)}
                </div>
                {dropData.isUpcoming && dropData.startTime > 0 && (
                  <button
                    onClick={() => onApplyScheduleTime(dropData.startTime)}
                    className="mt-0.5 text-[9px] text-amber-400 hover:text-amber-300 underline flex items-center gap-0.5"
                  >
                    <Sparkles className="w-2 h-2" />
                    <span>对齐倒计时</span>
                  </button>
                )}
              </div>

              <div className="bg-slate-900/80 p-2 rounded border border-slate-800/80">
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5 text-slate-400" />
                  <span>结束时间</span>
                </div>
                <div className="text-[11px] font-semibold text-slate-300 mt-0.5 truncate">
                  {dropData.endTime === 0 ? '无截止限制' : formatTimestamp(dropData.endTime)}
                </div>
              </div>
            </div>

            {/* Platform Fee & Protocol details footer */}
            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
              <span>协议费率: <strong className="text-slate-200">{dropData.feeBps / 100}%</strong></span>
              <div className="flex items-center gap-1">
                <span>接收: {formatAddress(dropData.feeRecipient)}</span>
                <button onClick={() => copyFeeRecipient(dropData.feeRecipient)} className="text-slate-400 hover:text-white">
                  {copiedFee ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* Full-width Stacked Mode */
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Search className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white">
              NFT 合约与 SeaDrop 阶段检测
            </h2>
            <p className="text-[11px] text-slate-400">
              直接从 SeaDrop 协议合约链上读取公开铸造参数，免除 OpenSea API 限制
            </p>
          </div>
        </div>

        {/* Demo contract selector */}
        <div className="hidden sm:flex items-center gap-1.5">
          <span className="text-xs text-slate-400">快速填入示例:</span>
          {DEMO_CONTRACTS.filter(c => c.chainId === chain.id || chain.isTestnet).slice(0, 2).map(demo => (
            <button
              key={demo.address}
              onClick={() => {
                setContractAddress(demo.address);
              }}
              className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2 py-1 rounded border border-slate-700 transition-colors"
            >
              {demo.name.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Input box & Search button */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
          <span>NFT 目标合约地址 (ERC-721 / SeaDrop)</span>
          <span className="text-[11px] text-slate-500">当前链: {chain.name}</span>
        </label>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              id="nft-contract-address-input"
              type="text"
              value={contractAddress}
              onChange={(e) => setContractAddress(e.target.value.trim())}
              placeholder="0x... 输入 NFT 合约地址"
              className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-3.5 pr-20 py-2.5 text-xs sm:text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button
                type="button"
                onClick={handlePasteContract}
                className="px-2 py-1 text-xs font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-800/60 rounded flex items-center gap-1 transition-colors"
                title="鼠标一键粘贴合约地址"
              >
                <Clipboard className="w-3 h-3" />
                <span>粘贴</span>
              </button>
              {contractAddress && (
                <button
                  type="button"
                  onClick={() => setContractAddress('')}
                  className="px-1.5 py-1 text-xs text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 rounded transition-colors"
                  title="清空输入"
                >
                  清除
                </button>
              )}
            </div>
          </div>

          <button
            id="fetch-contract-drop-btn"
            onClick={onFetchDrop}
            disabled={isLoading || !contractAddress}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold text-xs sm:text-sm rounded-lg transition-colors flex items-center justify-center gap-2 shrink-0 shadow-md shadow-emerald-950"
          >
            {isLoading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>查询链上中...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>查询 SeaDrop 参数</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-950/40 border border-red-800/60 rounded-lg p-3 text-xs text-red-300 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-red-200">查询失败</div>
            <p className="mt-0.5 text-red-300/90">{error}</p>
          </div>
        </div>
      )}

      {/* Drop Details Display */}
      {dropData && dropData.isFetched && (
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-4">
          {/* Top header row */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                {nftSymbol || 'NFT'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-white text-sm sm:text-base">
                    {nftName}
                  </h3>
                  <span className="text-[10px] bg-emerald-950 border border-emerald-700/50 text-emerald-400 px-1.5 py-0.5 rounded font-mono">
                    SeaDrop Verified
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="font-mono">{formatAddress(contractAddress)}</span>
                  <a
                    href={`${chain.explorerUrl}/address/${contractAddress}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5"
                  >
                    <span>区块浏览器</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>

            {/* Stage Status Badge */}
            <div>
              {dropData.isActive ? (
                <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-lg text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>公售开放中 (Active)</span>
                </div>
              ) : dropData.isUpcoming ? (
                <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 px-3 py-1.5 rounded-lg text-xs font-semibold">
                  <Clock className="w-3.5 h-3.5" />
                  <span>未开启 · 倒计时中</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-slate-800 text-slate-400 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium">
                  <span>公售已结束</span>
                </div>
              )}
            </div>
          </div>

          {/* Grid Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Price */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3">
              <div className="text-[11px] text-slate-400 flex items-center gap-1 mb-1">
                <DollarSign className="w-3 h-3 text-emerald-400" />
                <span>铸造价格</span>
              </div>
              <div className="text-base font-bold text-white">
                {dropData.mintPrice === '0' ? (
                  <span className="text-emerald-400 font-extrabold">免费 (FREE MINT)</span>
                ) : (
                  <span>{dropData.mintPriceFormatted} {chain.nativeSymbol}</span>
                )}
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                {dropData.mintPrice} wei
              </div>
            </div>

            {/* Max per wallet */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3">
              <div className="text-[11px] text-slate-400 flex items-center gap-1 mb-1">
                <Users className="w-3 h-3 text-cyan-400" />
                <span>单钱包限额</span>
              </div>
              <div className="text-base font-bold text-white">
                {dropData.maxTotalMintableByWallet > 0 ? (
                  <span>{dropData.maxTotalMintableByWallet} 个 / 钱包</span>
                ) : (
                  <span className="text-slate-400">不限额度</span>
                )}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {dropData.restrictFeeRecipients ? '限制费用接收' : '标准接收规则'}
              </div>
            </div>

            {/* Start Time */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3">
              <div className="text-[11px] text-slate-400 flex items-center gap-1 mb-1">
                <Clock className="w-3 h-3 text-amber-400" />
                <span>开售时间</span>
              </div>
              <div className="text-xs font-semibold text-white">
                {formatTimestamp(dropData.startTime)}
              </div>
              {dropData.isUpcoming && dropData.startTime > 0 && (
                <button
                  onClick={() => onApplyScheduleTime(dropData.startTime)}
                  className="mt-1 text-[10px] text-amber-400 hover:text-amber-300 font-medium underline flex items-center gap-0.5"
                >
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>一键对齐定时抢购</span>
                </button>
              )}
            </div>

            {/* End Time */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3">
              <div className="text-[11px] text-slate-400 flex items-center gap-1 mb-1">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>结束时间</span>
              </div>
              <div className="text-xs font-semibold text-white">
                {formatTimestamp(dropData.endTime)}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {dropData.endTime === 0 ? '无截止限制' : '到期自动关闭'}
              </div>
            </div>
          </div>

          {/* Fee Recipient info */}
          <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/60">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">平台费率 (Fee BPS):</span>
              <span className="text-white font-mono">{dropData.feeBps} ({dropData.feeBps / 100}%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">费用接收地址:</span>
              <span className="text-white font-mono text-[11px]">
                {formatAddress(dropData.feeRecipient)}
              </span>
              <button
                onClick={() => copyFeeRecipient(dropData.feeRecipient)}
                className="text-slate-400 hover:text-white"
                title="复制地址"
              >
                {copiedFee ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
