import { ReactNode, useEffect } from "react";

interface ModalProps {
  open: boolean;
  title?: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ open, title, description, onClose, children }: ModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
        aria-describedby={description ? "modal-description" : undefined}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {(title || description) && (
          <header className="modal-header">
            {title && (
              <h2 id="modal-title">
                {title}
              </h2>
            )}
            {description && (
              <p id="modal-description">
                {description}
              </p>
            )}
          </header>
        )}
        <div className="modal-body">{children}</div>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close dialog">
          <span />
        </button>
      </div>
    </div>
  );
}
