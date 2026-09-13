import React from 'react';
import { Settings, Server, Check, AlertCircle, RefreshCcw } from 'lucide-react';
import { ChainConfig } from '../types';

interface CustomRpcModalProps {
  chain: ChainConfig;
  customRpc: string;
  onSaveRpc: (rpc: string) => void;
  onClose: () => void;
}

export const CustomRpcModal: React.FC<CustomRpcModalProps> = ({
  chain,
  customRpc,
  onSaveRpc,
  onClose,
}) => {
  const [rpcInput, setRpcInput] = React.useState(customRpc || '');

  const handleSave = () => {
    onSaveRpc(rpcInput.trim());
    onClose();
  };

  const handleReset = () => {
    setRpcInput('');
    onSaveRpc('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-white text-base">配置网络独享 RPC 节点</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xs">
            关闭
          </button>
        </div>

        <div className="text-xs text-slate-400 leading-relaxed">
          公用 RPC 节点可能会在高峰期出现速率限制 (Rate Limit) 或响应延迟。强烈建议在正式抢购时填入 Alchemy、Infura、QuickNode 等专属 RPC 节点。
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 flex justify-between">
            <span>当前网络: {chain.name}</span>
            <span className="text-[11px] text-slate-500">Chain ID: {chain.id}</span>
          </label>

          <input
            type="url"
            value={rpcInput}
            onChange={(e) => setRpcInput(e.target.value)}
            placeholder={chain.rpcUrl}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
          />

          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
            <span>默认公共节点:</span>
            <span className="font-mono text-slate-400 truncate max-w-xs">{chain.rpcUrl}</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <button
            onClick={handleReset}
            className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
          >
            <RefreshCcw className="w-3 h-3" />
            <span>恢复公共默认节点</span>
          </button>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-1"
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
