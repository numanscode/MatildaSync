import React from 'react';
import { X } from 'lucide-react';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  children: React.ReactNode;
  icon?: React.ReactNode;
}

const maxWidthMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
};

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  maxWidth = 'md',
  children,
  icon,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-150">
      <div 
        className={`bg-white rounded-3xl p-6 sm:p-8 w-full ${maxWidthMap[maxWidth]} border border-[var(--border-admin-subtle)] shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-black p-1.5 rounded-full hover:bg-gray-100 transition-colors"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-3.5 mb-6 pr-8">
          {icon && (
            <div className="w-10 h-10 rounded-2xl bg-[var(--border-admin-subtle)]/40 border border-[var(--border-admin-subtle)] text-[var(--border-admin)] flex items-center justify-center shrink-0">
              {icon}
            </div>
          )}
          <div>
            <h3 className="font-display text-xl sm:text-2xl font-bold lowercase tracking-tight text-gray-900">
              {title}
            </h3>
            {subtitle && (
              <p className="font-micro uppercase tracking-widest text-[9px] text-gray-500 mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {children}
      </div>
    </div>
  );
};
