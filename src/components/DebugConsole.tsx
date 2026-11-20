import React, { useState, useEffect } from 'react';
import { Terminal, X, Trash2, ChevronDown, ChevronRight, Activity } from 'lucide-react';
import { logger, LogEntry } from '../utils/logger';

interface DebugConsoleProps {
  isOpen: boolean;
  onClose: () => void;
}

const safeStringifyDetails = (details: unknown): string => {
  if (typeof details !== 'object' || details === null) return String(details);
  try {
    const seen = new WeakSet<object>();
    return JSON.stringify(
      details,
      (_key, value) => {
        if (value instanceof Error) {
          return { name: value.name, message: value.message, stack: value.stack };
        }
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return '[Circular]';
          seen.add(value);
        }
        return value;
      },
      2
    );
  } catch {
    return String(details);
  }
};

export const DebugConsole: React.FC<DebugConsoleProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>(logger.getLogs());
  const [filter, setFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all');
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unsubscribe = logger.subscribe((newLogs) => {
      setLogs([...newLogs]);
    });
    return unsubscribe;
  }, []);

  if (!isOpen) return null;

  const filteredLogs = logs.filter(log => filter === 'all' || log.level === filter);

  const toggleExpand = (id: string) => {
    const next = new Set(expandedLogs);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedLogs(next);
  };

  const getLogColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-500';
      case 'warn': return 'text-yellow-500';
      case 'info': return 'text-blue-400';
      default: return 'text-text';
    }
  };

  const getLogBg = (level: string) => {
    switch (level) {
      case 'error': return 'bg-red-500/10 border-red-500/20';
      case 'warn': return 'bg-yellow-500/10 border-yellow-500/20';
      case 'info': return 'bg-blue-500/10 border-blue-500/20';
      default: return 'bg-surface border-border';
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 max-h-[50vh] md:max-h-[40vh] bg-bg/95 backdrop-blur-xl border-t border-border shadow-2xl z-50 flex flex-col font-mono text-xs" dir="ltr">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface">
        <div className="flex items-center gap-2 text-text font-bold">
          <Terminal size={14} className="text-accent" />
          <span>Debug Console</span>
        </div>
        
        <div className="flex items-center gap-2">
          <select 
            value={filter} 
            onChange={e => setFilter(e.target.value as any)}
            className="bg-bg text-text text-xs border border-border rounded px-2 py-1 outline-none"
          >
            <option value="all">All Logs ({logs.length})</option>
            <option value="info">Info</option>
            <option value="warn">Warnings</option>
            <option value="error">Errors</option>
          </select>
          
          <button 
            onClick={() => logger.clear()} 
            className="p-1.5 text-text/60 hover:text-red-400 hover:bg-bg rounded transition-colors"
            title="Clear Logs"
          >
            <Trash2 size={14} />
          </button>
          
          <div className="w-px h-4 bg-border mx-1"></div>
          
          <button 
            onClick={onClose}
            className="p-1.5 text-text/60 hover:text-text hover:bg-bg rounded transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Log List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text/40 pt-8 pb-4">
            <Activity size={24} className="mb-2 opacity-50" />
            <p>No {filter !== 'all' ? filter : ''} logs to display</p>
          </div>
        ) : (
          filteredLogs.map(log => {
             const isExpanded = expandedLogs.has(log.id);
             return (
               <div key={log.id} className={`flex flex-col rounded border ${getLogBg(log.level)}`}>
                 <div 
                  className="flex items-start gap-2 p-2 cursor-pointer hover:bg-text/5"
                  onClick={() => log.details && toggleExpand(log.id)}
                 >
                   <div className="flex-shrink-0 pt-0.5 w-4 flex justify-center">
                     {log.details ? (
                       isExpanded ? <ChevronDown size={12} className="text-text/50"/> : <ChevronRight size={12} className="text-text/50"/>
                     ) : <span className="w-3"></span>}
                   </div>
                   <div className="flex-shrink-0 w-20 text-text/50 whitespace-nowrap">
                     {log.timestamp.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' }) + '.' + log.timestamp.getMilliseconds().toString().padStart(3, '0')}
                   </div>
                   <div className={`flex-shrink-0 w-10 font-bold uppercase ${getLogColor(log.level)}`}>
                     {log.level}
                   </div>
                   <div className="flex-1 leading-snug break-words text-text/90">
                     {log.message}
                   </div>
                 </div>
                 
                 {isExpanded && log.details && (
                   <div className="px-8 pb-2 pt-1 border-t border-text/5 overflow-x-auto text-text/70 whitespace-pre text-[10px] sm:text-xs">
                     {safeStringifyDetails(log.details)}
                   </div>
                 )}
               </div>
             );
          })
        )}
      </div>
    </div>
  );
};
