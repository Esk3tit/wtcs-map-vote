import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { SessionCard, type Session } from '@/components/session/session-card'

// Mock data for demonstration
const mockSessions: Session[] = [
  {
    id: '1',
    matchName: 'Match A5',
    teamA: 'Team Liquid',
    teamB: 'Fnatic',
    format: 'ABBA',
    status: 'In Progress',
    playersConnected: 2,
    maxPlayers: 2,
    createdAt: new Date('2024-01-15T14:30:00'),
  },
  {
    id: '2',
    matchName: 'Finals Match',
    teamA: 'G2 Esports',
    teamB: 'Cloud9',
    format: 'Multiplayer',
    status: 'Waiting',
    playersConnected: 3,
    maxPlayers: 4,
    createdAt: new Date('2024-01-15T15:45:00'),
  },
  {
    id: '3',
    matchName: 'Semi-Final B',
    teamA: 'NRG',
    teamB: 'Evil Geniuses',
    format: 'ABBA',
    status: 'Complete',
    playersConnected: 2,
    maxPlayers: 2,
    createdAt: new Date('2024-01-15T12:00:00'),
  },
]

export const Route = createFileRoute('/admin/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  const sessions = mockSessions
  const hasNoSessions = sessions.length === 0

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-border/50 bg-card/30 backdrop-blur-sm">
        <div className="px-8 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Active Sessions</h1>
          <Button size="default" className="gap-2" render={<Link to="/admin/create" />}>
            <Plus className="w-4 h-4" />
            Create Session
          </Button>
        </div>
      </header>

      <main className="flex-1 px-8 py-8">
        {hasNoSessions ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-64 h-64 mb-6 rounded-lg bg-muted/30 flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-24 h-24 text-muted-foreground/50"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="9" x2="15" y2="15" />
                <line x1="15" y1="9" x2="9" y2="15" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-foreground mb-2">No active sessions</h2>
            <p className="text-muted-foreground mb-6 text-center max-w-sm">
              Get started by creating your first voting session
            </p>
            <Button size="lg" className="gap-2" render={<Link to="/admin/create" />}>
              <Plus className="w-5 h-5" />
              Create Session
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
