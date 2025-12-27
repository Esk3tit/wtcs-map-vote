import { createFileRoute } from '@tanstack/react-router'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Lock, Loader2 } from 'lucide-react'

export const Route = createFileRoute('/lobby/$token')({
  component: PlayerLobbyPage,
})

function PlayerLobbyPage() {
  const { token } = Route.useParams()

  // Use token to fetch real session data in the future
  console.log('Lobby token:', token)

  const maps = [
    { name: 'Dust II', image: '/dust2.jpg' },
    { name: 'Mirage', image: '/mirage.jpg' },
    { name: 'Inferno', image: '/inferno.jpg' },
    { name: 'Nuke', image: '/nuke.jpg' },
    { name: 'Ancient', image: '/ancient.jpg' },
  ]

  const opponentConnected = true

  return (
    <div className="min-h-screen bg-background p-6 flex items-center justify-center">
      <div className="w-full max-w-2xl space-y-8">
        {/* Top Section */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold text-foreground">Match A5</h1>
          <Badge variant="outline" className="text-base px-4 py-1">
            ABBA Ban
          </Badge>
        </div>

        {/* Identity Card */}
        <Card className="p-6 border-primary/20">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">You are joining as:</p>
            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-foreground">Team Liquid</h2>
              <p className="text-lg text-muted-foreground">(Player A - Bans 1st & 4th)</p>
            </div>

            <div className="pt-4 border-t border-border space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Lock className="h-4 w-4" />
                <span>Session locked to your device</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-sm font-medium text-green-500">Connected</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Waiting Indicator */}
        <div className="flex flex-col items-center gap-4 py-8">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-lg text-muted-foreground">Waiting for admin to start the session...</p>
        </div>

        {/* Map Preview Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground text-center">Maps in this session:</h3>
          <div className="grid grid-cols-5 gap-4">
            {maps.map((map) => (
              <div key={map.name} className="space-y-2">
                <div className="relative aspect-video rounded-lg overflow-hidden border border-border">
                  <img
                    src={map.image || '/placeholder.svg'}
                    alt={map.name}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </div>
                <p className="text-xs text-center text-muted-foreground">{map.name}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Opponent Status */}
        <Card className="p-4 bg-card/50">
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold text-foreground">Fnatic</span>
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${opponentConnected ? 'bg-green-500' : 'bg-muted'}`} />
              <span className={`text-sm font-medium ${opponentConnected ? 'text-green-500' : 'text-muted-foreground'}`}>
                {opponentConnected ? 'Connected' : 'Not yet connected'}
              </span>
            </div>
          </div>
        </Card>

        {/* Footer */}
        <p className="text-sm text-center text-muted-foreground">
          The admin will start the session when all players are ready.
        </p>
      </div>
    </div>
  )
}
