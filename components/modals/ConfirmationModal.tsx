import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isConfirming?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'تأكيد الحذف',
  cancelText = 'إلغاء',
  isConfirming = false,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center backdrop-blur-sm"
      onClick={onClose}
      dir="rtl"
    >
      <Card
        className="w-full max-w-md bg-white shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
              <AlertTriangle className="h-6 w-6 text-red-600" aria-hidden="true" />
            </div>
            <div className="flex-1 text-right">
              <h3 className="text-lg font-semibold leading-6 text-gray-900" id="modal-title">
                {title}
              </h3>
              <div className="mt-2">
                <p className="text-sm text-gray-600">
                  {message}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 rounded-b-lg">
          <Button
            onClick={onConfirm}
            disabled={isConfirming}
            className="w-full sm:ml-3 sm:w-auto bg-red-600 hover:bg-red-700 text-white"
          >
            {isConfirming ? 'جاري الحذف...' : confirmText}
          </Button>
          <Button
            onClick={onClose}
            disabled={isConfirming}
            variant="secondary"
            className="mt-3 w-full sm:mt-0 sm:w-auto"
          >
            {cancelText}
          </Button>
        </div>
      </Card>
    </div>
  );
};