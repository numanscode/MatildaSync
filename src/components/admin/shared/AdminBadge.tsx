import React from 'react';

interface AdminBadgeProps {
  variant?: 'pending' | 'paid' | 'shipped' | 'rejected' | 'active' | 'inactive' | 'default';
  children: React.ReactNode;
  className?: string;
}

const variantStyles = {
  pending: 'border-amber-400 text-amber-700 bg-amber-50',
  paid: 'border-emerald-500 text-emerald-700 bg-emerald-50',
  shipped: 'border-blue-500 text-blue-700 bg-blue-50',
  rejected: 'border-rose-400 text-rose-700 bg-rose-50',
  active: 'border-emerald-500 text-emerald-700 bg-emerald-50',
  inactive: 'border-gray-300 text-gray-600 bg-gray-50',
  default: 'border-gray-300 text-gray-700 bg-gray-50',
};

export const AdminBadge: React.FC<AdminBadgeProps> = ({
  variant = 'default',
  children,
  className = '',
}) => {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 border rounded-full font-micro uppercase tracking-widest text-[9px] font-semibold ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
};
