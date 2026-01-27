import { Link, useMatchRoute, useNavigate } from '@tanstack/react-router'
import { useAuthActions } from '@convex-dev/auth/react'
import { useQuery, api } from '@/lib/convex'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LogOut, User, Users, Calendar, Map as MapIcon, Settings } from 'lucide-react'

interface AdminSidebarProps {
  onNavigate?: () => void
}

export function AdminSidebar({ onNavigate }: AdminSidebarProps) {
  const matchRoute = useMatchRoute()
  const navigate = useNavigate()
  const { signOut } = useAuthActions()
  const currentUser = useQuery(api.admins.getMe)

  const isSessionsActive = matchRoute({ to: '/admin/dashboard', fuzzy: true }) ||
                           matchRoute({ to: '/admin/create', fuzzy: true }) ||
                           matchRoute({ to: '/admin/session/$sessionId', fuzzy: true })
  const isTeamsActive = matchRoute({ to: '/admin/teams', fuzzy: true })
  const isMapsActive = matchRoute({ to: '/admin/maps', fuzzy: true })
  const isSettingsActive = matchRoute({ to: '/admin/settings', fuzzy: true })

  const handleLogout = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Logout failed:', error)
    } finally {
      // Always navigate to login - user intended to leave
      void navigate({ to: '/login', search: { error: undefined } })
    }
  }

  const handleNavClick = () => {
    onNavigate?.()
  }

  return (
    <aside className="w-64 border-r border-border/50 bg-card/30 backdrop-blur-sm flex flex-col h-full">
      <div className="p-6 pl-14 md:pl-6 border-b border-border/50">
        <h2 className="text-xl font-bold text-foreground">WTCS Map Vote</h2>
        <p className="text-sm text-muted-foreground">Admin Portal</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        <Button
          variant={isSessionsActive ? 'secondary' : 'ghost'}
          className="w-full justify-start gap-3"
          render={<Link to="/admin/dashboard" onClick={handleNavClick} />}
        >
          <Calendar className="w-5 h-5" />
          Sessions
        </Button>
        <Button
          variant={isTeamsActive ? 'secondary' : 'ghost'}
          className="w-full justify-start gap-3"
          render={<Link to="/admin/teams" onClick={handleNavClick} />}
        >
          <Users className="w-5 h-5" />
          Teams
        </Button>
        <Button
          variant={isMapsActive ? 'secondary' : 'ghost'}
          className="w-full justify-start gap-3"
          render={<Link to="/admin/maps" onClick={handleNavClick} />}
        >
          <MapIcon className="w-5 h-5" />
          Map Pool
        </Button>
        {currentUser?.isRootAdmin && (
          <Button
            variant={isSettingsActive ? 'secondary' : 'ghost'}
            className="w-full justify-start gap-3"
            render={<Link to="/admin/settings" onClick={handleNavClick} />}
          >
            <Settings className="w-5 h-5" />
            Admin Settings
          </Button>
        )}
      </nav>

      <div className="p-4 border-t border-border/50">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="w-10 h-10">
            <AvatarImage src={currentUser?.avatarUrl} alt={currentUser?.name ?? ''} />
            <AvatarFallback className="bg-primary/20 text-primary">
              <User className="w-5 h-5" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {currentUser?.name ?? "Loading..."}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {currentUser?.email ?? ""}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="w-full gap-2 bg-transparent" onClick={handleLogout}>
          <LogOut className="w-4 h-4" />
          Logout
        </Button>
      </div>
    </aside>
  )
}
