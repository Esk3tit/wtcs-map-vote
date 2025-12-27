import { createFileRoute } from '@tanstack/react-router'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Trophy, X } from 'lucide-react'

interface BanHistoryItem {
  order: number
  team: string
  mapName: string
  mapImage: string
}

interface MapSummary {
  id: string
  name: string
  image: string
  isBanned: boolean
  isWinner: boolean
}

export const Route = createFileRoute('/results/$sessionId')({
  component: VotingResultsPage,
})

function VotingResultsPage() {
  const { sessionId } = Route.useParams()

  // Use sessionId to fetch real session data in the future
  console.log('Results session ID:', sessionId)

  const matchName = 'Match A5'
  const teamOne = 'Team Liquid'
  const teamTwo = 'Fnatic'
  const winningMap = 'Inferno'
  const isAdmin = false // Change based on user role

  const banHistory: BanHistoryItem[] = [
    { order: 1, team: teamOne, mapName: 'Dust II', mapImage: '/dust2.jpg' },
    { order: 2, team: teamTwo, mapName: 'Nuke', mapImage: '/nuke.jpg' },
    { order: 3, team: teamTwo, mapName: 'Ancient', mapImage: '/ancient.jpg' },
    { order: 4, team: teamOne, mapName: 'Mirage', mapImage: '/mirage.jpg' },
  ]

  const mapSummary: MapSummary[] = [
    { id: '1', name: 'Dust II', image: '/dust2.jpg', isBanned: true, isWinner: false },
    { id: '2', name: 'Nuke', image: '/nuke.jpg', isBanned: true, isWinner: false },
    { id: '3', name: 'Ancient', image: '/ancient.jpg', isBanned: true, isWinner: false },
    { id: '4', name: 'Mirage', image: '/mirage.jpg', isBanned: true, isWinner: false },
    { id: '5', name: 'Inferno', image: '/inferno.jpg', isBanned: false, isWinner: true },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground py-12 px-6">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header Section */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">{matchName}</h1>
          <p className="text-xl text-muted-foreground">
            {teamOne} vs {teamTwo}
          </p>
          <Badge variant="secondary" className="bg-green-950/50 text-green-400 border-green-600">
            COMPLETE
          </Badge>
        </div>

        {/* Winner Showcase */}
        <div className="flex flex-col items-center space-y-6">
          <Trophy className="w-16 h-16 text-primary" />

          <Card className="overflow-hidden border-2 border-primary shadow-2xl shadow-primary/30 max-w-md w-full">
            <div className="aspect-video relative">
              <img src="/inferno.jpg" alt={winningMap} className="w-full h-full object-cover" />
            </div>
            <div className="p-6 text-center space-y-3">
              <h2 className="text-4xl font-bold">{winningMap}</h2>
              <Badge className="bg-primary text-primary-foreground text-base px-4 py-1">WINNER</Badge>
            </div>
          </Card>
        </div>

        {/* Ban History Section */}
        <Card className="p-6">
          <h3 className="text-2xl font-bold mb-6">Ban Order</h3>
          <div className="space-y-4">
            {banHistory.map((ban) => (
              <div key={ban.order} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                <span className="text-lg font-bold text-muted-foreground w-8">{ban.order}.</span>
                <img
                  src={ban.mapImage || '/placeholder.svg'}
                  alt={ban.mapName}
                  className="w-16 h-10 object-cover rounded"
                />
                <div className="flex-1">
                  <span className="font-semibold text-foreground">{ban.team}</span>
                  <span className="text-muted-foreground"> banned </span>
                  <span className="font-semibold text-foreground">{ban.mapName}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Visual Map Summary */}
        <div>
          <h3 className="text-xl font-bold mb-4 text-center">Map Summary</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {mapSummary.map((map) => (
              <Card
                key={map.id}
                className={`overflow-hidden transition-all ${
                  map.isWinner ? 'border-2 border-primary ring-2 ring-primary/50' : ''
                } ${map.isBanned ? 'opacity-60' : ''}`}
              >
                <div className="aspect-video relative">
                  <img
                    src={map.image || '/placeholder.svg'}
                    alt={map.name}
                    className={`w-full h-full object-cover ${map.isBanned ? 'grayscale' : ''}`}
                  />

                  {map.isBanned && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <X className="w-12 h-12 text-red-600" strokeWidth={4} />
                    </div>
                  )}

                  {map.isWinner && (
                    <div className="absolute top-2 right-2">
                      <Trophy className="w-6 h-6 text-primary" />
                    </div>
                  )}
                </div>

                <div className="p-2">
                  <div className="text-sm font-semibold text-center">{map.name}</div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <div className="text-center">
          {isAdmin ? (
            <Button size="lg" className="px-8">
              Create New Session
            </Button>
          ) : (
            <p className="text-lg text-muted-foreground font-semibold">Session Complete</p>
          )}
        </div>
      </div>
    </div>
  )
}
