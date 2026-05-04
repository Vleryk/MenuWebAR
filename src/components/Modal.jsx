import { IconClose } from "./icons/IconClose";
import styles from "./Modal.module.css";
import { useEffect, useRef } from "react";

export const Modal = ({ isOpen, close, title, children }) => {
  const modalRef = useRef(null);

  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;

    if (isOpen) modal.showModal();
    else modal.close();
  }, [isOpen]);

  return (
    <dialog ref={modalRef} onClose={close} className={styles.modal} onClick={close}>
      <div className={styles.container}>
        <div className={styles.contentModal} onClick={(e) => e.stopPropagation()}>
          <header className={styles.headerModal}>
            <p className={styles.headerTitle}>{title ?? ""}</p>
            <button title="Cerrar Modal" className={styles.btnClose} onClick={close}>
              <IconClose />
            </button>
          </header>
          <div className={styles.modalBody}>{children}</div>
        </div>
      </div>
    </dialog>
  );
};
