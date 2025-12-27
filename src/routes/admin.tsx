import { createFileRoute, Outlet } from '@tanstack/react-router'
import { AdminSidebar } from '@/components/layout/admin-sidebar'

export const Route = createFileRoute('/admin')({
  component: AdminLayout,
})

function AdminLayout() {
  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
