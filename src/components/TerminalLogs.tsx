import React from 'react';
import { Terminal, Trash2, Copy, ExternalLink, Filter, Check, ArrowDownCircle } from 'lucide-react';
import { LogEntry, ChainConfig } from '../types';

interface TerminalLogsProps {
  logs: LogEntry[];
  onClearLogs: () => void;
  chain: ChainConfig;
  heightClass?: string;
}

export const TerminalLogs: React.FC<TerminalLogsProps> = ({
  logs,
  onClearLogs,
  chain,
  heightClass = 'h-56 sm:h-64',
}) => {
  const [filter, setFilter] = React.useState<string>('all');
  const [autoScroll, setAutoScroll] = React.useState(true);
  const [copied, setCopied] = React.useState(false);
  const logEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const copyAllLogs = () => {
    const text = logs
      .map(
        l =>
          `[${new Date(l.timestamp).toLocaleTimeString()}] [${l.level.toUpperCase()}] ${l.text} ${
            l.txHash ? `(Tx: ${l.txHash})` : ''
          }`
      )
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const filteredLogs = logs.filter(log => {
    if (filter === 'all') return true;
    return log.level === filter;
  });

  const getLevelStyle = (level: LogEntry['level']) => {
    switch (level) {
      case 'success':
        return 'text-emerald-400 font-semibold';
      case 'error':
        return 'text-red-400 font-semibold';
      case 'warn':
        return 'text-amber-300';
      case 'sniper':
        return 'text-cyan-400 font-bold';
      default:
        return 'text-slate-300';
    }
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-md flex flex-col font-mono">
      {/* Terminal Titlebar */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          {/* Traffic lights */}
          <div className="flex items-center gap-1.5 mr-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
          </div>
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span className="text-white font-semibold">执行终端 & 链上日志 (Console Output)</span>
          <span className="text-[10px] text-slate-500">
            [{filteredLogs.length} 条记录]
          </span>
        </div>

        {/* Filters and Actions */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 text-[11px]">
            <Filter className="w-3 h-3 text-slate-500" />
            {['all', 'sniper', 'success', 'error'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-1.5 py-0.5 rounded transition-colors ${
                  filter === f
                    ? 'bg-slate-800 text-white font-medium'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {f === 'all' ? '全部' : f === 'sniper' ? '抢购' : f === 'success' ? '成功' : '错误'}
              </button>
            ))}
          </div>

          <button
            onClick={copyAllLogs}
            className="p-1 text-slate-400 hover:text-white transition-colors"
            title="复制全部日志"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={onClearLogs}
            className="p-1 text-slate-400 hover:text-red-400 transition-colors"
            title="清空终端"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Body */}
      <div className={`p-3 sm:p-4 ${heightClass} overflow-y-auto space-y-1.5 text-xs text-slate-300 custom-scrollbar select-text`}>
        {filteredLogs.length === 0 ? (
          <div className="text-slate-600 italic py-8 text-center">
            暂无日志输出。请输入合约地址并点击查询，或点击「模拟校验」开始测试。
          </div>
        ) : (
          filteredLogs.map(log => (
            <div key={log.id} className="leading-relaxed flex items-start gap-2 hover:bg-slate-900/40 px-1 rounded">
              <span className="text-slate-600 shrink-0 text-[11px]">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>

              <span className={`text-[10px] px-1 py-0.2 rounded shrink-0 ${
                log.level === 'success'
                  ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/40'
                  : log.level === 'error'
                  ? 'bg-red-950/80 text-red-400 border border-red-800/40'
                  : log.level === 'sniper'
                  ? 'bg-cyan-950/80 text-cyan-400 border border-cyan-800/40'
                  : 'bg-slate-800 text-slate-400'
              }`}>
                {log.level.toUpperCase()}
              </span>

              <div className="flex-1 break-all">
                <span className={getLevelStyle(log.level)}>{log.text}</span>

                {log.txHash && (
                  <a
                    href={`${chain.explorerUrl}/tx/${log.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-0.5 ml-2 text-emerald-400 hover:underline text-[11px]"
                  >
                    <span>[查看 Tx: {log.txHash.slice(0, 10)}...]</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
};
