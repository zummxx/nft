import React from 'react';
import { BookOpen, Zap, Shield, GitFork, Cpu, Layers, ExternalLink, X } from 'lucide-react';

interface DocModalProps {
  onClose: () => void;
}

export const DocModal: React.FC<DocModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-5 sm:p-6 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-white text-base sm:text-lg">
              morsyxbt/nft-public-mint 原版特性与中文版使用指南
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Overview banner */}
        <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-lg p-3.5 text-xs text-emerald-200 leading-relaxed">
          <p>
            本应用完整重构并升级自开源项目 <code className="bg-slate-900 px-1.5 py-0.5 rounded text-emerald-400 font-mono">morsyxbt/nft-public-mint</code>，将原本需在命令行 (CLI) 交互的 Sniper 脚本转换为现代化、具备实时链上交互、防 Revert 模拟与秒级定时抢购的 Web3 中文控制台。
          </p>
        </div>

        {/* Feature Grid */}
        <div className="space-y-4 text-xs text-slate-300">
          <div>
            <h4 className="font-bold text-white text-sm mb-2 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <span>核心技术设计原理</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-lg space-y-1">
                <span className="font-semibold text-white text-xs">1. 纯链上数据解析 (No OpenSea API)</span>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  直接读取 SeaDrop 智能合约上的 <code>getPublicDrop</code>、<code>getFeeRecipient</code>。完全脱离 OpenSea Web API 与账号限制，免除封号和速率限额 (Rate Limits)。
                </p>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-lg space-y-1">
                <span className="font-semibold text-white text-xs">2. 多钱包并发齐射 (Parallel Firing)</span>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  导入多个私钥子钱包，在开售瞬间通过异步并发队列向 RPC 节点广播所有钱包的 Mint 交易，极大提高多开成功率。
                </p>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-lg space-y-1">
                <span className="font-semibold text-white text-xs">3. 阶段等待与定时抢跑 (Sniper Countdown)</span>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  提前预构好交易载荷与 Gas 参数，倒计时临近开售时间（支持提前 200~500ms 抵消网络延迟）自动触发，抢先出块。
                </p>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-lg space-y-1">
                <span className="font-semibold text-white text-xs">4. 零 Gas 模拟校验 (Dry Run)</span>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  在正式广播前，先通过 <code>eth_call</code> 预演执行。若合约未开售、限额超标或余额不足，直接报错阻断，避免白白浪费 Gas 费。
                </p>
              </div>
            </div>
          </div>

          {/* Quick Steps */}
          <div>
            <h4 className="font-bold text-white text-sm mb-2 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>四步快速抢购指南</span>
            </h4>
            <ol className="list-decimal list-inside space-y-2 bg-slate-950/50 p-3.5 rounded-lg border border-slate-800 text-slate-300">
              <li>
                <strong className="text-white">选择公链与填入合约:</strong> 选择 NFT 所在的网络 (全面支持 Base、Robinhood Chain、Ink L2、以太坊等)，填入 NFT 合约地址，点击「查询 SeaDrop 参数」。
              </li>
              <li>
                <strong className="text-white">导入抢购钱包:</strong> 可连接 MetaMask 浏览器钱包，或点击「批量导入私钥」导入准备好少量 Gas 的子钱包。
              </li>
              <li>
                <strong className="text-white">配置抢购参数与 Gas:</strong> 确认每钱包铸造数量、Gas 优先级 (建议选择「狙击抢跑」或适当提高 Max Priority Fee)。若尚未开售，开启「定时狙击」。
              </li>
              <li>
                <strong className="text-white">模拟与发射:</strong> 建议先点击「模拟校验 (Dry Run)」确认无误，然后点击「立即并发铸造」或「启动定时抢购」。终端将实时输出所有 Tx Hash。
              </li>
            </ol>
          </div>

          {/* Security */}
          <div className="bg-amber-950/30 border border-amber-800/40 p-3 rounded-lg flex items-start gap-2 text-[11px] text-amber-200">
            <Shield className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p>
              <strong>本地安全保障：</strong> 所有私钥均只存在于当前浏览器标签页的内存中，签名与广播均直接通过直连 RPC 发送到公链网络，绝对不会传输或上传到任何第三方服务器。
            </p>
          </div>

          {/* ARC Chain Official Resources */}
          <div className="bg-slate-950/80 border border-blue-900/50 p-3.5 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white text-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span>ARC 链官方资源导航 (Arc Network Ecosystem)</span>
              </span>
              <span className="text-[10px] text-blue-400 font-mono">原生 Gas: USDC</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <a
                href="https://arc.io"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-2 rounded bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors"
              >
                <span>· 官方网站: <strong className="text-white">arc.io</strong></span>
                <ExternalLink className="w-3 h-3 text-blue-400" />
              </a>
              <a
                href="https://docs.arc.io"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-2 rounded bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors"
              >
                <span>· 开发者文档: <strong className="text-white">docs.arc.io</strong></span>
                <ExternalLink className="w-3 h-3 text-blue-400" />
              </a>
              <a
                href="https://arclenz.xyz/ecosystem"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-2 rounded bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors"
              >
                <span>· 生态汇总: <strong className="text-white">arclenz.xyz/ecosystem</strong></span>
                <ExternalLink className="w-3 h-3 text-blue-400" />
              </a>
              <a
                href="https://arc-scan.org"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-2 rounded bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors"
              >
                <span>· 区块浏览器: <strong className="text-white">arc-scan.org</strong></span>
                <ExternalLink className="w-3 h-3 text-blue-400" />
              </a>
            </div>
          </div>

          {/* Repo Link */}
          <div className="pt-2 flex items-center justify-between text-slate-400 text-xs border-t border-slate-800">
            <span>原版 GitHub 仓库:</span>
            <a
              href="https://github.com/morsyxbt/nft-public-mint"
              target="_blank"
              rel="noreferrer"
              className="text-cyan-400 hover:underline flex items-center gap-1"
            >
              <span>morsyxbt/nft-public-mint</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
