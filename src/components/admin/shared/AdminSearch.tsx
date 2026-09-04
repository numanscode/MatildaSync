import React from 'react';
import { Search, X } from 'lucide-react';

interface AdminSearchProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

export const AdminSearch: React.FC<AdminSearchProps> = ({
  value,
  onChange,
  placeholder = 'Search...',
  className = '',
}) => {
  return (
    <div className={`relative flex items-center ${className}`}>
      <Search className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-9 py-2 bg-white/90 border border-gray-200 rounded-full text-xs placeholder:text-gray-400 focus:outline-none focus:border-[var(--border-admin)] focus:ring-1 focus:ring-[var(--border-admin)] transition-all font-body text-gray-800 shadow-xs"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-3 text-gray-400 hover:text-gray-600 p-0.5"
          title="Clear search"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
