import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ArrowLeft, Copy, Lock, CheckCircle2, Clock, X } from 'lucide-react'
import { useState } from 'react'

type SessionStatus = 'Waiting to Start' | 'Live' | 'Complete'

// Mock session data
const mockSessionData = {
  id: '1',
  matchName: 'Match A5',
  teamA: {
    name: 'Team Liquid',
    role: 'Player A - Bans 1st & 4th',
    accessCode: 'xK9mQ2',
    ipLocked: '192.168.1.100',
  },
  teamB: {
    name: 'Fnatic',
    role: 'Player B - Bans 2nd & 3rd',
    accessCode: 'pL7nR5',
    ipLocked: null,
  },
  format: 'ABBA',
  status: 'Waiting to Start' as SessionStatus,
  currentTurn: 'Team Liquid',
  timeRemaining: 45,
}

const maps = [
  { id: '1', name: 'Dust II', image: '/dust2.jpg', banned: false, bannedBy: null },
  { id: '2', name: 'Mirage', image: '/mirage.jpg', banned: true, bannedBy: 'Team Liquid' },
  { id: '3', name: 'Inferno', image: '/inferno.jpg', banned: false, bannedBy: null },
  { id: '4', name: 'Nuke', image: '/nuke.jpg', banned: false, bannedBy: null },
  { id: '5', name: 'Ancient', image: '/ancient.jpg', banned: true, bannedBy: 'Fnatic' },
  { id: '6', name: 'Anubis', image: '/anubis.jpg', banned: false, bannedBy: null },
  { id: '7', name: 'Vertigo', image: '/vertigo.jpg', banned: false, bannedBy: null },
]

const voteHistory = [
  { id: 1, team: 'Team Liquid', action: 'Banned', map: 'Dust II', time: '2:34 PM' },
  { id: 2, team: 'Fnatic', action: 'Banned', map: 'Mirage', time: '2:35 PM' },
]

export const Route = createFileRoute('/admin/session/$sessionId')({
  component: SessionDetailPage,
})

function SessionDetailPage() {
  const { sessionId } = Route.useParams()
  const navigate = useNavigate()
  const [session] = useState(mockSessionData)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>(session.status)

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const handleStartSession = () => {
    setSessionStatus('Live')
  }

  const handleEndSession = () => {
    setSessionStatus('Complete')
  }

  const isLive = sessionStatus === 'Live'
  const isComplete = sessionStatus === 'Complete'

  // Use sessionId to fetch real data in the future
  console.log('Session ID:', sessionId)

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/30 backdrop-blur-sm">
        <div className="px-8 py-4 space-y-4">
          <Button
            variant="ghost"
            onClick={() => navigate({ to: '/admin/dashboard' })}
            className="gap-2 -ml-3 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Sessions
          </Button>

          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-foreground">{session.matchName}</h1>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs">
                  {session.format}
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    isLive
                      ? 'bg-primary/20 text-primary border-primary/30'
                      : isComplete
                        ? 'bg-muted text-muted-foreground border-border'
                        : 'bg-chart-4/20 text-chart-4 border-chart-4/30'
                  }
                >
                  {sessionStatus}
                </Badge>
              </div>
            </div>

            <div>
              {!isComplete && !isLive && (
                <Button onClick={handleStartSession} className="gap-2 bg-chart-4 hover:bg-chart-4/90">
                  <CheckCircle2 className="w-4 h-4" />
                  Start Session
                </Button>
              )}
              {isLive && (
                <Button onClick={handleEndSession} variant="destructive" className="gap-2">
                  <X className="w-4 h-4" />
                  End Session
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-8 py-8 space-y-6">
        {/* Player Access Codes Card */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Player Access Codes</CardTitle>
            <CardDescription>Share these codes with each team. Codes lock to their IP on first use.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Team A */}
            <div className="flex items-center gap-4 p-4 rounded-lg border border-border/50 bg-background/50">
              <div className="flex-1 space-y-1">
                <p className="font-semibold text-foreground">{session.teamA.name}</p>
                <p className="text-sm text-muted-foreground">{session.teamA.role}</p>
              </div>
              <div className="flex items-center gap-3">
                <Input
                  value={session.teamA.accessCode}
                  readOnly
                  className="w-32 font-mono text-center bg-muted border-border/50"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleCopyCode(session.teamA.accessCode)}
                  className="shrink-0"
                >
                  {copiedCode === session.teamA.accessCode ? (
                    <CheckCircle2 className="w-4 h-4 text-chart-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
                {session.teamA.ipLocked ? (
                  <Badge variant="outline" className="gap-1 bg-chart-4/20 text-chart-4 border-chart-4/30">
                    <Lock className="w-3 h-3" />
                    Locked to {session.teamA.ipLocked}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-muted text-muted-foreground border-border">
                    Not activated
                  </Badge>
                )}
              </div>
            </div>

            {/* Team B */}
            <div className="flex items-center gap-4 p-4 rounded-lg border border-border/50 bg-background/50">
              <div className="flex-1 space-y-1">
                <p className="font-semibold text-foreground">{session.teamB.name}</p>
                <p className="text-sm text-muted-foreground">{session.teamB.role}</p>
              </div>
              <div className="flex items-center gap-3">
                <Input
                  value={session.teamB.accessCode}
                  readOnly
                  className="w-32 font-mono text-center bg-muted border-border/50"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleCopyCode(session.teamB.accessCode)}
                  className="shrink-0"
                >
                  {copiedCode === session.teamB.accessCode ? (
                    <CheckCircle2 className="w-4 h-4 text-chart-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
                {session.teamB.ipLocked ? (
                  <Badge variant="outline" className="gap-1 bg-chart-4/20 text-chart-4 border-chart-4/30">
                    <Lock className="w-3 h-3" />
                    Locked to {session.teamB.ipLocked}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-muted text-muted-foreground border-border">
                    Not activated
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live Status Card */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Live Status</CardTitle>
          </CardHeader>
          <CardContent>
            {!isLive ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Clock className="w-12 h-12 text-muted-foreground/50 mb-4" />
                <p className="text-lg font-medium text-muted-foreground">Waiting for players...</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Session will begin when you click Start Session</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Current Turn Banner */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-primary/10 border border-primary/30">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <div>
                      <p className="text-sm text-muted-foreground">Current Turn</p>
                      <p className="font-semibold text-foreground">{session.currentTurn} is banning</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 rounded-md bg-background/50 border border-border/50">
                    <Clock className="w-4 h-4 text-primary" />
                    <span className="font-mono text-lg font-bold text-foreground">{session.timeRemaining}s</span>
                  </div>
                </div>

                {/* Maps Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  {maps.map((map) => (
                    <div
                      key={map.id}
                      className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                        map.banned
                          ? 'border-destructive/50 opacity-40'
                          : 'border-border/50 hover:border-primary/50 shadow-lg'
                      }`}
                    >
                      <img
                        src={map.image || '/placeholder.svg'}
                        alt={map.name}
                        className="w-full aspect-[3/4] object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-2">
                        <p className="text-xs font-semibold text-white text-center">{map.name}</p>
                      </div>
                      {map.banned && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
                          <X className="w-8 h-8 text-destructive mb-1" />
                          <p className="text-xs text-white font-medium px-2 text-center">Banned by {map.bannedBy}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Vote Log Card */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Vote History</CardTitle>
          </CardHeader>
          <CardContent>
            {voteHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-lg font-medium text-muted-foreground">No votes recorded yet</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Vote history will appear here once the session starts
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="w-16">#</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Map</TableHead>
                    <TableHead className="text-right">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {voteHistory.map((vote) => (
                    <TableRow key={vote.id} className="border-border/50">
                      <TableCell className="font-mono text-muted-foreground">{vote.id}</TableCell>
                      <TableCell className="font-medium">{vote.team}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-destructive/20 text-destructive border-destructive/30">
                          {vote.action}
                        </Badge>
                      </TableCell>
                      <TableCell>{vote.map}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{vote.time}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
