import { createContext, useCallback, useContext, useMemo, useState } from "react";
import Modal from "../../components/ui/Modal.jsx";
import ImportForm from "./ImportForm.jsx";

const Ctx = createContext(null);

// Quick-import dialog available from anywhere inside the app.
export function ImportDialogProvider({ children }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ open: () => setOpen(true) }), []);
  return (
    <Ctx.Provider value={value}>
      {children}
      <Modal open={open} onClose={close} title="Import a repository">
        <ImportForm onDone={close} />
      </Modal>
    </Ctx.Provider>
  );
}

export const useImportDialog = () => useContext(Ctx);
