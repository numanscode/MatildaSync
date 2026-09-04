import React from 'react';
import { AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import { AdminModal } from './AdminModal';

interface AdminConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmLabel?: string;
  isDestructive?: boolean;
  loading?: boolean;
}

export const AdminConfirmModal: React.FC<AdminConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  isDestructive = true,
  loading = false,
}) => {
  return (
    <AdminModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth="sm"
      icon={
        isDestructive ? (
          <AlertTriangle className="w-5 h-5 text-red-600" />
        ) : undefined
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-gray-600 leading-relaxed font-body">
          {message}
        </p>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-full text-xs font-micro uppercase tracking-widest text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`flex-1 px-4 py-2.5 rounded-full text-xs font-micro uppercase tracking-widest text-white transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 ${
              isDestructive
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-[var(--border-admin)] hover:opacity-90'
            }`}
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isDestructive ? (
              <Trash2 className="w-3.5 h-3.5" />
            ) : null}
            <span>{loading ? 'Processing...' : confirmLabel}</span>
          </button>
        </div>
      </div>
    </AdminModal>
  );
};
