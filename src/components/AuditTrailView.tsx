import React, { useState, useMemo } from 'react';
import { AuditLogEntry } from '../types';
import { History, Search, Filter, Download, User, Calendar, ShieldCheck, Database, FileText, HardDrive, RefreshCw } from 'lucide-react';
import { excelService } from '../services/excelService';

interface AuditTrailViewProps {
  logs: AuditLogEntry[];
  onRefresh: () => Promise<void>;
}

export const AuditTrailView: React.FC<AuditTrailViewProps> = ({ logs, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const term = searchTerm.toLowerCase();
      const searchMatch =
        searchTerm === '' ||
        (log.entityKey && log.entityKey.toLowerCase().includes(term)) ||
        log.performedBy.toLowerCase().includes(term) ||
        (log.details && log.details.toLowerCase().includes(term)) ||
        log.action.toLowerCase().includes(term);

      const actionMatch = actionFilter === 'ALL' || log.action === actionFilter;

      return searchMatch && actionMatch;
    });
  }, [logs, searchTerm, actionFilter]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setIsRefreshing(false);
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'CREATE':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-green-500/10 text-green-400 border border-green-500/20">CREATE</span>;
      case 'UPDATE':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">UPDATE</span>;
      case 'DELETE':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-red-500/10 text-red-400 border border-red-500/20">DELETE</span>;
      case 'EXCEL_IMPORT':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">EXCEL IMPORT</span>;
      case 'GENERATE_WORD_FORM':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">WORD DOCX</span>;
      case 'BACKUP':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">BACKUP</span>;
      case 'RESTORE':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">RESTORE</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#222] text-gray-400 border border-[#333]">{action}</span>;
    }
  };

  return (
    <div className="space-y-4 select-none">
      {/* Control Header */}
      <div className="bg-[#141414] p-4 rounded-xl border border-[#222] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search audit trail by Product Code, Inspector Name, or Details..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-[#1A1A1A] border border-[#333] text-gray-200 placeholder-gray-500 rounded-lg focus:outline-hidden focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Filter & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-[#1A1A1A] border border-[#333] px-2.5 py-1.5 rounded-lg text-xs">
            <span className="text-gray-400 font-medium">Action:</span>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="bg-transparent font-semibold text-gray-200 focus:outline-hidden cursor-pointer"
            >
              <option value="ALL" className="bg-[#1A1A1A] text-gray-200">All Actions</option>
              <option value="CREATE" className="bg-[#1A1A1A] text-gray-200">Create</option>
              <option value="UPDATE" className="bg-[#1A1A1A] text-gray-200">Update</option>
              <option value="DELETE" className="bg-[#1A1A1A] text-gray-200">Delete</option>
              <option value="EXCEL_IMPORT" className="bg-[#1A1A1A] text-gray-200">Excel Import</option>
              <option value="GENERATE_WORD_FORM" className="bg-[#1A1A1A] text-gray-200">Word Form</option>
              <option value="BACKUP" className="bg-[#1A1A1A] text-gray-200">Backup</option>
              <option value="RESTORE" className="bg-[#1A1A1A] text-gray-200">Restore</option>
            </select>
          </div>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 text-gray-400 hover:text-gray-200 bg-[#1A1A1A] hover:bg-[#252525] rounded-lg border border-[#333] transition-colors"
            title="Refresh Audit Trail"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Audit Trail Table */}
      <div className="bg-[#121212] rounded-xl border border-[#222] overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#0A0A0A] border-b border-[#222] text-gray-500 font-mono font-medium uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4 w-44">Timestamp</th>
                <th className="py-3 px-3 w-32">Action</th>
                <th className="py-3 px-3 w-36">Entity Type</th>
                <th className="py-3 px-3 w-40">Entity / Product Code</th>
                <th className="py-3 px-3 w-36">Performed By</th>
                <th className="py-3 px-4">Audit Details / Changes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222]">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500">
                    <History className="w-8 h-8 mx-auto text-gray-600 mb-2" />
                    <p className="font-semibold text-gray-400">No audit log entries matched.</p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#1A1A1A] transition-colors group">
                    <td className="py-3 px-4 font-mono text-[11px] text-gray-500 whitespace-nowrap">
                      {log.timestamp}
                    </td>
                    <td className="py-3 px-3">
                      {getActionBadge(log.action)}
                    </td>
                    <td className="py-3 px-3 text-gray-300 font-medium">
                      {log.entityType}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-blue-400">
                      {log.entityKey || '-'}
                    </td>
                    <td className="py-3 px-3 text-gray-300 font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        <User className="w-3 h-3 text-gray-500" />
                        {log.performedBy}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-400 text-xs">
                      {log.details || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-[#0A0A0A] border-t border-[#222] flex items-center justify-between text-xs text-gray-500 font-mono">
          <div>
            Showing <strong className="text-gray-300">{filteredLogs.length}</strong> recorded audit events
          </div>
          <div className="text-[11px] text-gray-500">
            Immutable QA Change Log
          </div>
        </div>
      </div>
    </div>
  );
};
