import { Link } from "@tanstack/react-router"
import { EllipsisVertical, Eye } from "lucide-react"
import { useState } from "react"

import type { InsurerPublic } from "@/client"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import DeleteInsurer from "./DeleteInsurer"
import EditInsurer from "./EditInsurer"

interface InsurerActionsMenuProps {
  insurer: InsurerPublic
}

export const InsurerActionsMenu = ({ insurer }: InsurerActionsMenuProps) => {
  const [open, setOpen] = useState(false)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Insurer actions">
          <EllipsisVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link
            to="/catalog/insurers/$insurerId"
            params={{ insurerId: insurer.id }}
          >
            <Eye className="mr-2 h-4 w-4" />
            View Details
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <EditInsurer insurer={insurer} onSuccess={() => setOpen(false)} />
        <DeleteInsurer id={insurer.id} onSuccess={() => setOpen(false)} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
