import React from 'react';

export interface AdminStatTrend {
  value: string;
  isPositive?: boolean;
}

interface AdminStatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: React.ReactNode;
  trend?: string | AdminStatTrend;
  className?: string;
}

export const AdminStatCard: React.FC<AdminStatCardProps> = ({
  label,
  value,
  subValue,
  icon,
  trend,
  className = '',
}) => {
  const trendText = typeof trend === 'object' && trend !== null ? trend.value : typeof trend === 'string' ? trend : '';
  const isPositive = typeof trend === 'object' && trend !== null ? trend.isPositive !== false : true;

  return (
    <div className={`bg-white/80 backdrop-blur-md border border-[var(--border-admin-subtle)] rounded-3xl p-5 sm:p-6 shadow-xs hover:shadow-sm transition-all relative overflow-hidden ${className}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-micro uppercase tracking-widest text-[10px] text-gray-500 font-semibold mb-1">
            {label}
          </p>
          <p className="font-display text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            {value}
          </p>
          {subValue && (
            <p className="font-micro text-[10px] text-gray-400 mt-1 uppercase tracking-wider">
              {subValue}
            </p>
          )}
          {trendText && (
            <p className={`text-[11px] font-semibold mt-1.5 flex items-center gap-1 ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
              <span>{isPositive ? '↑' : '↓'}</span> {trendText}
            </p>
          )}
        </div>
        {icon && (
          <div className="w-10 h-10 rounded-2xl bg-[var(--border-admin-subtle)]/30 border border-[var(--border-admin-subtle)] text-[var(--border-admin)] flex items-center justify-center shrink-0">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};
