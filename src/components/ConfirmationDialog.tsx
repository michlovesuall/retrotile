import React from 'react';
import { AlertTriangle, Trash2, X, Check } from 'lucide-react';
import { soundEffects } from '../utils/soundEffects';

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'danger' | 'warning' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'danger',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const getConfirmStyle = () => {
    switch (confirmVariant) {
      case 'danger':
        return 'bg-[#ff7675] hover:bg-[#ff5252] text-black';
      case 'warning':
        return 'bg-[#ffdf00] hover:bg-[#fed330] text-black';
      case 'primary':
      default:
        return 'bg-[#86efac] hover:bg-[#6ee7b7] text-black';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="neo-card-lg bg-white w-full max-w-md p-6 shadow-[8px_8px_0px_#000] animate-in fade-in zoom-in-95 duration-150">
        {/* Dialog Header */}
        <div className="flex items-center gap-3 mb-4 pb-3 border-b-2 border-black">
          <div
            className={`w-10 h-10 neo-card flex items-center justify-center ${
              confirmVariant === 'danger' ? 'bg-[#ff7675]' : 'bg-[#ffdf00]'
            }`}
          >
            {confirmVariant === 'danger' ? (
              <Trash2 className="w-5 h-5 text-black stroke-[2.5]" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-black stroke-[2.5]" />
            )}
          </div>
          <div>
            <h3 className="font-heading text-lg text-black leading-tight">{title}</h3>
            <p className="text-[11px] font-mono font-bold text-slate-500">Action Confirmation</p>
          </div>
        </div>

        {/* Message */}
        <div className="font-sans text-sm text-slate-800 leading-relaxed mb-6">
          {message}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-black">
          <button
            type="button"
            onClick={() => {
              soundEffects.playTileClick();
              onCancel();
            }}
            className="neo-btn-sm bg-slate-100 hover:bg-slate-200 text-black px-4 py-2 text-xs font-heading"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={() => {
              onConfirm();
            }}
            className={`neo-btn px-5 py-2 text-xs font-heading flex items-center gap-1.5 ${getConfirmStyle()}`}
          >
            {confirmVariant === 'danger' ? (
              <Trash2 className="w-4 h-4 stroke-[2.5]" />
            ) : (
              <Check className="w-4 h-4 stroke-[2.5]" />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
