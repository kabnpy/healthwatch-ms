import type { ReactNode } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface DocumentViewerModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

export function DocumentViewerModal({
  isOpen,
  onClose,
  title = "Document Viewer",
  children,
}: DocumentViewerModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="h-[94vh] sm:max-w-6xl p-0 gap-0 overflow-hidden bg-slate-100 border shadow-2xl flex flex-col"
        showCloseButton={false}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 w-full h-full overflow-hidden flex flex-col">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  )
}
