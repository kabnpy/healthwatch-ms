import {
  CreditCard,
  LayoutDashboard,
  Library,
  RefreshCw,
  Shield,
  UserCheck,
  UserRound,
} from "lucide-react"

import { SidebarAppearance } from "@/components/Common/Appearance"
import { Logo } from "@/components/Common/Logo"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar"
import useAuth from "@/hooks/useAuth"
import { type Item, Main } from "./Main"
import { User } from "./User"

const baseItems: Item[] = [
  { icon: LayoutDashboard, title: "Dashboard", path: "/" },
  { icon: UserRound, title: "Clients", path: "/clients" },
  { icon: Shield, title: "Policies", path: "/policies" },
  { icon: RefreshCw, title: "Renewals", path: "/renewals" },
  { icon: CreditCard, title: "Financials", path: "/financials" },
]

export function AppSidebar() {
  const { user: currentUser } = useAuth()

  const items = currentUser?.is_superuser
    ? [
        ...baseItems,
        { icon: Library, title: "Catalog", path: "/catalog/products" },
        { icon: UserCheck, title: "Admin", path: "/admin" },
      ]
    : baseItems

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-6 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:items-center">
        <Logo variant="responsive" />
      </SidebarHeader>
      <SidebarContent>
        <Main items={items} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarAppearance />
        <User user={currentUser} />
      </SidebarFooter>
    </Sidebar>
  )
}

export default AppSidebar
