import React, { useMemo } from 'react';
import { MasterItem, ReferenceRegistration, AuditLogEntry, AppConfig } from '../types';
import { ShieldCheck, Clock, Image, Database, Sparkles, User, Award, Users, ArrowRight } from 'lucide-react';

interface DashboardViewProps {
  masterItems: MasterItem[];
  registrations: ReferenceRegistration[];
  auditLogs: AuditLogEntry[];
  config: AppConfig;
  onNavigateTab: (tab: any) => void;
  onOpenRegisterModal: (item?: MasterItem) => void;
  onOpenMasterModal?: () => void;
  onViewReference?: (reg: ReferenceRegistration) => void;
  onOpenDetailModal: (reg: ReferenceRegistration) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  masterItems,
  registrations,
  onNavigateTab,
  onOpenDetailModal
}) => {
  const totalMaster = masterItems.length;
  const rmItems = masterItems.filter((i) => i.category === 'RM').length;
  const psItems = masterItems.filter((i) => i.category === 'PS').length;

  const registeredCount = registrations.length;
  const unregisteredCount = Math.max(0, totalMaster - registeredCount);
  const registrationPct = totalMaster > 0 ? Math.round((registeredCount / totalMaster) * 100) : 0;

  // Date helpers for Today and Yesterday calculation
  const { todayStr, yesterdayStr } = useMemo(() => {
    const now = new Date();
    const t = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    const yStr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
    return { todayStr: t, yesterdayStr: yStr };
  }, []);

  const getRegDateOnly = (reg: ReferenceRegistration) => {
    if (reg.registrationDate) {
      if (reg.registrationDate.length === 10) return reg.registrationDate;
      try {
        const d = new Date(reg.registrationDate);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      } catch {}
    }
    if (reg.createdAt) {
      try {
        const d = new Date(reg.createdAt);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      } catch {}
    }
    return '';
  };

  // Filtered registrations for Today and Yesterday
  const registeredTodayList = useMemo(() => {
    return registrations.filter((r) => getRegDateOnly(r) === todayStr);
  }, [registrations, todayStr]);

  const registeredYesterdayList = useMemo(() => {
    return registrations.filter((r) => getRegDateOnly(r) === yesterdayStr);
  }, [registrations, yesterdayStr]);

  // Breakdown for Today & Yesterday
  const todayRM = registeredTodayList.filter((r) => {
    const m = masterItems.find((item) => item.productCode.toLowerCase() === r.productCode.toLowerCase());
    return m?.category === 'RM';
  }).length;
  const todayPS = registeredTodayList.length - todayRM;

  const yesterdayRM = registeredYesterdayList.filter((r) => {
    const m = masterItems.find((item) => item.productCode.toLowerCase() === r.productCode.toLowerCase());
    return m?.category === 'RM';
  }).length;
  const yesterdayPS = registeredYesterdayList.length - yesterdayRM;

  // Operator counters based on registeredBy
  const operatorCounters = useMemo(() => {
    const map = new Map<
      string,
      {
        total: number;
        today: number;
        yesterday: number;
        rm: number;
        ps: number;
        firstDate: Date;
      }
    >();

    registrations.forEach((reg) => {
      const op = reg.registeredBy?.trim() || 'Default Inspector';
      const dateStr = getRegDateOnly(reg);
      const isToday = dateStr === todayStr;
      const isYesterday = dateStr === yesterdayStr;
      const master = masterItems.find((m) => m.productCode.toLowerCase() === reg.productCode.toLowerCase());
      const isRM = master?.category === 'RM';

      let regDate = new Date();
      if (reg.registrationDate) {
        const d = new Date(reg.registrationDate);
        if (!isNaN(d.getTime())) regDate = d;
      } else if (reg.createdAt) {
        const d = new Date(reg.createdAt);
        if (!isNaN(d.getTime())) regDate = d;
      }

      if (!map.has(op)) {
        map.set(op, { total: 0, today: 0, yesterday: 0, rm: 0, ps: 0, firstDate: regDate });
      }
      const stats = map.get(op)!;
      stats.total += 1;
      if (isToday) stats.today += 1;
      if (isYesterday) stats.yesterday += 1;
      if (isRM) stats.rm += 1;
      else stats.ps += 1;
      if (regDate < stats.firstDate) {
        stats.firstDate = regDate;
      }
    });

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return Array.from(map.entries())
      .map(([operator, stats]) => {
        const start = new Date(stats.firstDate);
        start.setHours(0, 0, 0, 0);
        const diffTime = Math.max(0, now.getTime() - start.getTime());
        const daysElapsed = Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1);
        const cumulativeGoal = daysElapsed * 5;
        const completionRate = Math.round((stats.total / cumulativeGoal) * 100);

        return {
          operator,
          ...stats,
          daysElapsed,
          cumulativeGoal,
          completionRate,
          firstDateStr: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [registrations, masterItems, todayStr, yesterdayStr]);

  // Latest registrations list (max 5 items)
  const latestRegistrationsList = useMemo(() => {
    return registrations.slice(0, 5);
  }, [registrations]);

  return (
    <div className="space-y-6 select-none">
      {/* Individual Performance Table */}
      <div className="bg-[#121212] rounded-xl border border-[#222] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-[#222] bg-[#1A1A1A] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider flex items-center gap-2">
                <span>Individual Performance Table</span>
                <span className="text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded font-mono font-normal">
                  {operatorCounters.length} Team Members
                </span>
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Clear breakdown per team member with daily tallies against 5 items/day goal
              </p>
            </div>
          </div>
          <div className="text-[11px] font-mono text-gray-400 bg-[#161616] px-3 py-1 rounded-lg border border-[#2A2A2A] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400"></span>
            <span>Daily Goal: <strong className="text-white">5 items / day</strong></span>
          </div>
        </div>

        {operatorCounters.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500">
            No team member registrations logged yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0A0A0A] text-gray-500 uppercase font-mono text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3 font-medium">Team Member</th>
                  <th className="px-4 py-3 font-medium">My Registered Items</th>
                  <th className="px-4 py-3 font-medium">Target</th>
                  <th className="px-4 py-3 font-medium">Completion Rate</th>
                  <th className="px-4 py-3 font-medium text-right">Performance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222]">
                {operatorCounters.map((op, idx) => {
                  const rate = op.completionRate;

                  let statusText = 'Below Expectations';
                  let statusClass = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
                  let barColor = 'bg-rose-400';

                  if (rate >= 120) {
                    statusText = 'Outstanding';
                    statusClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                    barColor = 'bg-emerald-400';
                  } else if (rate >= 100) {
                    statusText = 'Exceeds Expectations';
                    statusClass = 'bg-teal-500/10 text-teal-400 border-teal-500/20';
                    barColor = 'bg-teal-400';
                  } else if (rate >= 85) {
                    statusText = 'Meets Expectations';
                    statusClass = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                    barColor = 'bg-blue-400';
                  } else if (rate >= 70) {
                    statusText = 'Nearly Met Expectations';
                    statusClass = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                    barColor = 'bg-amber-400';
                  }

                  return (
                    <tr key={op.operator} className="hover:bg-[#1A1A1A] transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-200">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#222] border border-[#333] flex items-center justify-center text-blue-400 font-mono font-bold text-xs shrink-0">
                            {idx === 0 ? <Award className="w-3.5 h-3.5 text-amber-400" /> : <User className="w-3.5 h-3.5" />}
                          </div>
                          <div>
                            <span className="font-bold text-gray-200 block">{op.operator}</span>
                            <span className="text-[10px] text-gray-500 font-mono">Started: {op.firstDateStr}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono">
                        <div className="flex items-center gap-3">
                          <div>
                            <span className="text-gray-500 block uppercase font-mono text-[9px]">Today</span>
                            <span className="text-sm font-bold text-blue-400">{op.today}</span>
                          </div>
                          <div className="h-6 w-px bg-[#252525]"></div>
                          <div>
                            <span className="text-gray-500 block uppercase font-mono text-[9px]">Total</span>
                            <span className="text-sm font-bold text-gray-200">{op.total}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-300 font-semibold text-xs">
                        5 items / day
                      </td>
                      <td className="px-4 py-3 font-mono">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-200 text-xs">{rate}%</span>
                          <div className="w-16 bg-[#222] h-1.5 rounded-full overflow-hidden hidden sm:block">
                            <div
                              className={`h-1.5 rounded-full ${barColor}`}
                              style={{ width: `${Math.min(100, rate)}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded text-[11px] font-mono font-bold border ${statusClass}`}>
                          {statusText}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top Metric Cards - 5 Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
        {/* Card 1: Master Items */}
        <div className="bg-[#161616] p-4 rounded-xl border border-[#222] flex flex-col justify-between hover:border-[#333] transition-all">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase text-gray-500 tracking-wider mb-1 font-semibold">
                Total Master Items
              </p>
              <div className="p-1.5 rounded bg-[#222] text-blue-400 border border-[#333]">
                <Database className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white mt-1 font-mono">{totalMaster}</p>
          </div>
          <div className="flex items-center gap-1.5 mt-3 text-[10px]">
            <span className="bg-[#222] text-blue-400 border border-blue-900/40 px-1.5 py-0.5 rounded font-mono">
              {rmItems} RM
            </span>
            <span className="bg-[#222] text-purple-400 border border-purple-900/40 px-1.5 py-0.5 rounded font-mono">
              {psItems} PS
            </span>
          </div>
        </div>

        {/* Card 2: References Registered */}
        <div className="bg-[#161616] p-4 rounded-xl border border-[#222] flex flex-col justify-between hover:border-[#333] transition-all">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase text-gray-500 tracking-wider mb-1 font-semibold">
                Total Registered
              </p>
              <div className="p-1.5 rounded bg-[#222] text-green-400 border border-[#333]">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <p className="text-2xl font-bold text-green-400 font-mono">{registeredCount}</p>
              <span className="text-[10px] font-mono text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/20">
                {registrationPct}%
              </span>
            </div>
          </div>
          <div className="mt-3">
            <div className="w-full bg-[#222] rounded-full h-1 overflow-hidden">
              <div
                className="bg-green-500 h-1 rounded-full transition-all duration-500"
                style={{ width: `${registrationPct}%` }}
              ></div>
            </div>
            <p className="text-[9px] text-gray-500 mt-1 font-mono">{registeredCount} of {totalMaster} items</p>
          </div>
        </div>

        {/* Card 3: Registered Today */}
        <div className="bg-[#161616] p-4 rounded-xl border border-[#222] flex flex-col justify-between hover:border-[#333] transition-all">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase text-blue-400 tracking-wider mb-1 font-semibold flex items-center gap-1">
                <span>Registered Today</span>
              </p>
              <div className="p-1.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <p className="text-2xl font-bold text-blue-400 font-mono">{registeredTodayList.length}</p>
              <span className="text-[9px] font-mono text-blue-300 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                Today
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between mt-3 text-[10px]">
            <div className="flex items-center gap-1.5">
              <span className="bg-[#222] text-blue-300 border border-blue-900/40 px-1.5 py-0.5 rounded font-mono">
                {todayRM} RM
              </span>
              <span className="bg-[#222] text-purple-300 border border-purple-900/40 px-1.5 py-0.5 rounded font-mono">
                {todayPS} PS
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Registered Yesterday */}
        <div className="bg-[#161616] p-4 rounded-xl border border-[#222] flex flex-col justify-between hover:border-[#333] transition-all">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase text-purple-400 tracking-wider mb-1 font-semibold">
                Registered Yesterday
              </p>
              <div className="p-1.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <Clock className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <p className="text-2xl font-bold text-purple-400 font-mono">{registeredYesterdayList.length}</p>
              <span className="text-[9px] font-mono text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                Yesterday
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between mt-3 text-[10px]">
            <div className="flex items-center gap-1.5">
              <span className="bg-[#222] text-blue-300 border border-blue-900/40 px-1.5 py-0.5 rounded font-mono">
                {yesterdayRM} RM
              </span>
              <span className="bg-[#222] text-purple-300 border border-purple-900/40 px-1.5 py-0.5 rounded font-mono">
                {yesterdayPS} PS
              </span>
            </div>
          </div>
        </div>

        {/* Card 5: Pending Registry */}
        <div className="bg-[#161616] p-4 rounded-xl border border-[#222] flex flex-col justify-between hover:border-[#333] transition-all">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase text-gray-500 tracking-wider mb-1 font-semibold">
                Pending Registry
              </p>
              <div className="p-1.5 rounded bg-[#222] text-orange-400 border border-[#333]">
                <Clock className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-2xl font-bold text-orange-400 mt-1 font-mono">{unregisteredCount}</p>
          </div>
          <p className="text-[10px] text-gray-500 mt-3 flex items-center gap-1 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
            Awaiting Sample
          </p>
        </div>
      </div>

      {/* Latest Registrations Section (Max 5 items list format) */}
      <div className="bg-[#121212] rounded-xl border border-[#222] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-[#222] bg-[#1A1A1A] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-semibold text-white">Latest Registrations</h3>
            <span className="text-[10px] text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded font-mono font-semibold border border-purple-500/20">
              Max 5 Latest Items
            </span>
          </div>
          <button
            onClick={() => onNavigateTab('REGISTRATIONS')}
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1"
          >
            <span>View Full Registry</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {latestRegistrationsList.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-xs">
            No sample registrations logged yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0A0A0A] text-gray-500 uppercase font-mono text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3 font-medium">Specimen Photo</th>
                  <th className="px-4 py-3 font-medium">Product Code</th>
                  <th className="px-4 py-3 font-medium">Description & Specs</th>
                  <th className="px-4 py-3 font-medium">Revision</th>
                  <th className="px-4 py-3 font-medium">Registered Date / By</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222]">
                {latestRegistrationsList.map((reg) => {
                  const master = masterItems.find(
                    (m) => m.productCode.toLowerCase() === reg.productCode.toLowerCase()
                  );
                  return (
                    <tr key={reg.id} className="hover:bg-[#1A1A1A] transition-colors">
                      <td className="px-4 py-2.5">
                        {reg.photos && reg.photos.length > 0 ? (
                          <img
                            src={reg.photos[0].dataUrl}
                            alt={reg.productCode}
                            className="w-9 h-9 rounded object-cover border border-[#333] bg-[#161616]"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded bg-[#1A1A1A] border border-[#2A2A2A] flex items-center justify-center text-gray-500">
                            <Image className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-mono font-bold text-blue-400">
                        {reg.productCode}
                      </td>
                      <td className="px-4 py-2.5 max-w-xs">
                        <div className="text-gray-200 truncate font-medium">
                          {master?.description || reg.specification || 'QA Registered Specimen'}
                        </div>
                        <div className="text-[10px] text-gray-500 truncate mt-0.5">
                          {reg.specification || 'No specification text'}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[10px]">
                        <span className="bg-[#222] text-purple-300 border border-purple-900/40 px-2 py-0.5 rounded font-bold">
                          {reg.revision}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-400">
                        <div className="text-gray-300 text-xs font-semibold">{reg.registeredBy}</div>
                        <div className="text-[10px] text-gray-500 font-mono">{reg.registrationDate}</div>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => onOpenDetailModal(reg)}
                          className="px-2.5 py-1 text-xs font-semibold text-blue-400 bg-[#222] hover:bg-[#2A2A2A] hover:text-blue-300 rounded border border-[#333] transition-colors"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
