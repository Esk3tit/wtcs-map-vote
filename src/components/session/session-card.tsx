import { Link } from '@tanstack/react-router'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Eye } from 'lucide-react'

type SessionFormat = 'ABBA' | 'Multiplayer'
type SessionStatus = 'Waiting' | 'In Progress' | 'Complete'

export interface Session {
  id: string
  matchName: string
  teamA: string
  teamB: string
  format: SessionFormat
  status: SessionStatus
  playersConnected: number
  maxPlayers: number
  createdAt: Date
}

const getStatusColor = (status: SessionStatus) => {
  switch (status) {
    case 'Waiting':
      return 'bg-chart-4/20 text-chart-4 border-chart-4/30'
    case 'In Progress':
      return 'bg-primary/20 text-primary border-primary/30'
    case 'Complete':
      return 'bg-muted text-muted-foreground border-border'
    default:
      return 'bg-muted text-muted-foreground border-border'
  }
}

const formatTimestamp = (date: Date) => {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return date.toLocaleDateString()
}

interface SessionCardProps {
  session: Session
}

export function SessionCard({ session }: SessionCardProps) {
  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg font-semibold text-foreground">{session.matchName}</CardTitle>
          <Badge variant="outline" className="shrink-0 font-mono text-xs">
            {session.format}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {session.teamA} vs {session.teamB}
        </p>
      </CardHeader>

      <CardContent className="space-y-3 pb-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`${getStatusColor(session.status)} font-medium`}>
            {session.status}
          </Badge>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Connection</span>
            <span className="font-medium text-foreground">
              {session.playersConnected}/{session.maxPlayers} connected
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Created</span>
            <span className="font-medium text-foreground">{formatTimestamp(session.createdAt)}</span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-3 border-t border-border/30">
        <Button
          variant="secondary"
          size="sm"
          className="w-full gap-2"
          render={<Link to="/admin/session/$sessionId" params={{ sessionId: session.id }} />}
        >
          <Eye className="w-4 h-4" />
          View
        </Button>
      </CardFooter>
    </Card>
  )
}
