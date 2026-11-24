import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
export function Dialog({
  title,
  description,
  children,
  onClose,
  wide = false,
  className = '',
  headerAction,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  className?: string;
  headerAction?: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="modal-overlay" />
        <DialogPrimitive.Content className={`modal ${wide ? 'wide' : ''} ${className}`}>
          <div className="modal-heading">
            <div>
              <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
              <DialogPrimitive.Description>
                {description || 'Manage your finance workspace'}
              </DialogPrimitive.Description>
            </div>
            <div className="modal-heading-actions">
              {headerAction}
              <DialogPrimitive.Close className="icon-button" aria-label="Close dialog">
                <X size={20} />
              </DialogPrimitive.Close>
            </div>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
