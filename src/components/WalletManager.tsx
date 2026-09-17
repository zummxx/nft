import React from 'react';
import { Wallet, Plus, Trash2, Key, CheckSquare, Square, RefreshCw, ExternalLink, ShieldAlert, Sparkles, Copy, Check, Clipboard, Send } from 'lucide-react';
import { WalletAccount, ChainConfig } from '../types';
import { formatAddress } from '../utils/seadrop';
import { ethers } from 'ethers';

interface WalletManagerProps {
  wallets: WalletAccount[];
  setWallets: React.Dispatch<React.SetStateAction<WalletAccount[]>>;
  chain: ChainConfig;
  onRefreshBalances: () => void;
  isRefreshing: boolean;
  maxHeightClass?: string;
  onOpenSweepModal?: () => void;
}

export const WalletManager: React.FC<WalletManagerProps> = ({
  wallets,
  setWallets,
  chain,
  onRefreshBalances,
  isRefreshing,
  maxHeightClass = 'max-h-80 sm:max-h-[380px]',
  onOpenSweepModal,
}) => {
  const [showImportModal, setShowImportModal] = React.useState(false);
  const [importText, setImportText] = React.useState('');
  const [importError, setImportError] = React.useState<string | null>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const selectedCount = wallets.filter(w => w.selected).length;

  const toggleSelect = (id: string) => {
    setWallets(prev => prev.map(w => w.id === id ? { ...w, selected: !w.selected } : w));
  };

  const toggleSelectAll = () => {
    const allSelected = wallets.every(w => w.selected);
    setWallets(prev => prev.map(w => ({ ...w, selected: !allSelected })));
  };

  const removeWallet = (id: string) => {
    setWallets(prev => prev.filter(w => w.id !== id));
  };

  const clearAllWallets = () => {
    if (window.confirm('确定要清空所有已添加的钱包吗？')) {
      setWallets([]);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Connect Web3 Provider (MetaMask/OKX)
  const connectInjected = async () => {
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      alert('未检测到浏览器 Web3 钱包插件 (如 MetaMask, OKX, Rabby)。请安装或使用私钥导入功能。');
      return;
    }

    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      if (!accounts || accounts.length === 0) return;

      const address = accounts[0];
      const balance = await provider.getBalance(address);

      // Check if already in list
      if (wallets.some(w => w.address.toLowerCase() === address.toLowerCase())) {
        alert('该插件钱包已存在于列表中');
        return;
      }

      const newWallet: WalletAccount = {
        id: `injected-${Date.now()}`,
        address,
        type: 'injected',
        balanceWei: balance.toString(),
        balanceFormatted: ethers.formatEther(balance).substring(0, 7),
        status: 'idle',
        selected: true,
      };

      setWallets(prev => [newWallet, ...prev]);
    } catch (err: any) {
      alert(`连接浏览器钱包失败: ${err?.message || err}`);
    }
  };

  // Generate ephemeral test wallet
  const generateRandomWallet = () => {
    const random = ethers.Wallet.createRandom();
    const newWallet: WalletAccount = {
      id: `gen-${Date.now()}`,
      address: random.address,
      privateKey: random.privateKey,
      type: 'generated',
      balanceWei: '0',
      balanceFormatted: '0',
      status: 'idle',
      selected: true,
    };
    setWallets(prev => [newWallet, ...prev]);
  };

  // Handle batch private key import
  const handleImportPrivateKeys = () => {
    setImportError(null);
    const lines = importText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    if (lines.length === 0) {
      setImportError('请输入至少一个私钥');
      return;
    }

    const imported: WalletAccount[] = [];
    for (let i = 0; i < lines.length; i++) {
      let key = lines[i];
      if (!key.startsWith('0x')) {
        key = '0x' + key;
      }

      try {
        const w = new ethers.Wallet(key);
        // Check duplicate
        if (!wallets.some(existing => existing.address.toLowerCase() === w.address.toLowerCase()) &&
            !imported.some(existing => existing.address.toLowerCase() === w.address.toLowerCase())) {
          imported.push({
            id: `pk-${Date.now()}-${i}`,
            address: w.address,
            privateKey: key,
            type: 'private_key',
            balanceWei: '0',
            balanceFormatted: '查询中...',
            status: 'idle',
            selected: true,
          });
        }
      } catch (err) {
        setImportError(`第 ${i + 1} 行私钥格式不正确，必须为 64 位十六进制字符`);
        return;
      }
    }

    if (imported.length === 0) {
      setImportError('所输入的钱包均已存在于列表中');
      return;
    }

    setWallets(prev => [...prev, ...imported]);
    setImportText('');
    setShowImportModal(false);
    
    // Trigger balance refresh
    setTimeout(() => {
      onRefreshBalances();
    }, 100);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Wallet className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <span>抢购钱包管理</span>
              <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
                已选 {selectedCount} / {wallets.length}
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">
              支持批量私钥并发极速发射，私钥仅保存在本地浏览器内存中
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            id="connect-injected-wallet-btn"
            onClick={connectInjected}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>连接插件钱包</span>
          </button>

          <button
            id="batch-import-pks-btn"
            onClick={() => setShowImportModal(true)}
            className="px-2.5 py-1.5 bg-emerald-600/90 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 shadow-sm"
          >
            <Key className="w-3.5 h-3.5" />
            <span>批量导入私钥</span>
          </button>

          {onOpenSweepModal && (
            <button
              id="nft-batch-sweep-btn"
              onClick={onOpenSweepModal}
              className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1 shadow-sm border border-purple-400/30"
              title="批量归集所有小钱包里的 NFT 到一个指定主地址"
            >
              <Send className="w-3.5 h-3.5" />
              <span>NFT 批量归集</span>
            </button>
          )}

          <button
            id="generate-ephemeral-wallet-btn"
            onClick={generateRandomWallet}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
            title="生成临时随机钱包（测试用）"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>随机生成</span>
          </button>
        </div>
      </div>

      {/* Sub controls bar: select all / clear / refresh */}
      {wallets.length > 0 && (
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors"
            >
              {wallets.every(w => w.selected) ? (
                <CheckSquare className="w-4 h-4 text-emerald-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-500" />
              )}
              <span>{wallets.every(w => w.selected) ? '全选已生效' : '全选'}</span>
            </button>

            <button
              onClick={onRefreshBalances}
              disabled={isRefreshing}
              className="flex items-center gap-1 text-slate-400 hover:text-slate-200"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>刷新余额</span>
            </button>
          </div>

          <button
            onClick={clearAllWallets}
            className="text-red-400 hover:text-red-300 flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>清空全部</span>
          </button>
        </div>
      )}

      {/* Wallets List */}
      {wallets.length === 0 ? (
        <div className="bg-slate-950/60 border border-dashed border-slate-800 rounded-xl p-8 text-center space-y-2">
          <div className="w-10 h-10 mx-auto rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
            <Wallet className="w-5 h-5" />
          </div>
          <p className="text-xs text-slate-300 font-medium">尚未添加任何抢购钱包</p>
          <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
            点击上方「批量导入私钥」粘贴多个抢购子钱包，或点击「连接插件钱包」直接使用当前 MetaMask 账户。
          </p>
        </div>
      ) : (
        <div className={`${maxHeightClass} overflow-y-auto space-y-2 pr-1 custom-scrollbar`}>
          {wallets.map((wallet, idx) => (
            <div
              key={wallet.id}
              className={`p-3 rounded-lg border text-xs transition-colors flex items-center justify-between gap-3 ${
                wallet.selected
                  ? 'bg-slate-950/90 border-slate-700/90'
                  : 'bg-slate-950/40 border-slate-800/60 opacity-60'
              }`}
            >
              {/* Checkbox & Address info */}
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  onClick={() => toggleSelect(wallet.id)}
                  className="text-slate-400 hover:text-emerald-400 shrink-0"
                >
                  {wallet.selected ? (
                    <CheckSquare className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-600" />
                  )}
                </button>

                <span className="text-slate-500 text-[11px] font-mono shrink-0">
                  #{idx + 1}
                </span>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-slate-200 font-medium truncate">
                      {formatAddress(wallet.address)}
                    </span>
                    <button
                      onClick={() => handleCopy(wallet.address, wallet.id)}
                      className="text-slate-500 hover:text-slate-300"
                      title="复制完整地址"
                    >
                      {copiedId === wallet.id ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                    {/* Badge */}
                    <span className={`text-[10px] px-1.5 py-0.2 rounded border ${
                      wallet.type === 'injected'
                        ? 'bg-cyan-950/60 text-cyan-400 border-cyan-800/50'
                        : wallet.type === 'generated'
                        ? 'bg-amber-950/60 text-amber-400 border-amber-800/50'
                        : 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50'
                    }`}>
                      {wallet.type === 'injected' ? '插件' : wallet.type === 'generated' ? '临时' : '私钥'}
                    </span>
                  </div>

                  {/* Private key preview for ephemeral wallet */}
                  {wallet.privateKey && wallet.type === 'generated' && (
                    <div className="text-[10px] text-slate-500 font-mono truncate max-w-xs mt-0.5">
                      私钥: {wallet.privateKey.substring(0, 10)}... (可导出)
                    </div>
                  )}
                </div>
              </div>

              {/* Status & Balance & Actions */}
              <div className="flex items-center gap-3 shrink-0">
                {/* Status indicator */}
                <div>
                  {wallet.status === 'pending' && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 bg-amber-950/60 border border-amber-800/40 px-2 py-0.5 rounded">
                      <div className="w-2 h-2 border border-amber-400 border-t-transparent rounded-full animate-spin" />
                      <span>正在广播</span>
                    </span>
                  )}
                  {wallet.status === 'submitted' && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-sky-400 bg-sky-950/60 border border-sky-800/40 px-2 py-0.5 rounded">
                      <div className="w-2 h-2 border border-sky-400 border-t-transparent rounded-full animate-spin" />
                      <span>已广播/打包中</span>
                      {wallet.lastTxHash && (
                        <a
                          href={`${chain.explorerUrl}/tx/${wallet.lastTxHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline ml-0.5 text-sky-300"
                          title="查看链上交易"
                        >
                          <ExternalLink className="w-2.5 h-2.5 inline" />
                        </a>
                      )}
                    </span>
                  )}
                  {wallet.status === 'simulating' && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-cyan-400 bg-cyan-950/60 border border-cyan-800/40 px-2 py-0.5 rounded">
                      <span>模拟中</span>
                    </span>
                  )}
                  {wallet.status === 'success' && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded">
                      <span>铸造成功</span>
                      {wallet.lastTxHash && (
                        <a
                          href={`${chain.explorerUrl}/tx/${wallet.lastTxHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline ml-0.5"
                          title="查看链上交易"
                        >
                          <ExternalLink className="w-2.5 h-2.5 inline" />
                        </a>
                      )}
                    </span>
                  )}
                  {wallet.status === 'failed' && (
                    <div className="flex flex-col items-end">
                      <span
                        className="inline-flex items-center gap-1 text-[11px] text-red-400 bg-red-950/60 border border-red-800/40 px-2 py-0.5 rounded cursor-help"
                        title={wallet.errorMessage || '发生错误'}
                      >
                        <span>执行失败</span>
                        {wallet.lastTxHash && (
                          <a
                            href={`${chain.explorerUrl}/tx/${wallet.lastTxHash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:underline ml-0.5"
                            title="查看链上交易"
                          >
                            <ExternalLink className="w-2.5 h-2.5 inline" />
                          </a>
                        )}
                      </span>
                      {wallet.errorMessage && (
                        <span className="text-[9px] text-red-400/80 max-w-[140px] truncate" title={wallet.errorMessage}>
                          {wallet.errorMessage.replace('模拟调用 Revert 失败: ', '')}
                        </span>
                      )}
                    </div>
                  )}
                  {wallet.status === 'ready' && (
                    <span className="text-[11px] text-emerald-400 font-medium">
                      校验通过
                    </span>
                  )}
                  {wallet.status === 'idle' && (
                    <span className="text-[11px] text-slate-500">
                      待命
                    </span>
                  )}
                </div>

                {/* Balance */}
                <div className="text-right">
                  <div className="font-semibold text-slate-200">
                    {wallet.balanceFormatted} {chain.nativeSymbol}
                  </div>
                </div>

                {/* Remove */}
                <button
                  onClick={() => removeWallet(wallet.id)}
                  className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                  title="移除此钱包"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Batch Private Key Import */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-base">批量导入私钥 (Private Keys)</h3>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                关闭
              </button>
            </div>

            <div className="bg-amber-950/30 border border-amber-800/50 rounded-lg p-3 text-xs text-amber-300 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-amber-200">安全提示:</span>
                <p className="mt-0.5 text-amber-300/90 leading-relaxed">
                  私钥只保存在当前前端页面运行内存中，并直接向区块链 RPC 节点签名，绝不会上传任何第三方后端服务器。为保障资产安全，强烈建议仅使用存有少量抢购 Gas 的临时专用子钱包！
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300">
                  私钥列表 (每行一个私钥，支持带或不带 0x)
                </label>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      if (text && text.trim()) {
                        setImportText(text.trim());
                      }
                    } catch (err) {
                      console.warn('Clipboard read failed:', err);
                    }
                  }}
                  className="px-2 py-0.5 text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-800/60 rounded flex items-center gap-1 transition-colors"
                  title="从剪贴板一键粘贴私钥"
                >
                  <Clipboard className="w-3 h-3" />
                  <span>一键粘贴</span>
                </button>
              </div>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="0x4f3edf983ac636a65a842ce7c78d5aa706d3b113bce9c46f30d7d21715b23b1d&#10;0x6cbed15c793ce57650b9877cf5e14ddee0eede4710091a294823e7b777fed9b1"
                rows={6}
                className="w-full bg-slate-950 border border-slate-700/90 rounded-lg p-3 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {importError && (
              <div className="text-xs text-red-400 bg-red-950/40 p-2.5 rounded border border-red-800/50">
                {importError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleImportPrivateKeys}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>确认导入</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
