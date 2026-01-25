import type React from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { usePaginatedQuery, useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import {
  MIN_MAP_POOL_SIZE,
  MAX_MAP_POOL_SIZE,
  MIN_TURN_TIMER_SECONDS,
  MAX_TURN_TIMER_SECONDS,
} from '../../../convex/lib/constants'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ArrowLeft, Users, UserCircle2, Check, ChevronsUpDown, Loader2 } from 'lucide-react'
import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type SessionFormat = 'ABBA' | 'MULTIPLAYER'

interface Team {
  id: string
  name: string
}

function TeamCombobox({
  value,
  onChange,
  label,
  teams,
  isLoading,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  teams: Team[]
  isLoading?: boolean
}) {
  const [open, setOpen] = useState(false)

  const displayValue = isLoading ? 'Loading teams...' : value || 'Select team...'

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between bg-background/50"
              disabled={isLoading}
            />
          }
        >
          <span className={cn((!value || isLoading) && 'text-muted-foreground')}>{displayValue}</span>
          {isLoading ? (
            <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin" />
          ) : (
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          )}
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search teams..." />
            <CommandList>
              <CommandEmpty>No teams found. Add teams in the Teams CMS.</CommandEmpty>
              <CommandGroup>
                {teams.map((team) => (
                  <CommandItem
                    key={team.id}
                    value={team.name}
                    onSelect={(currentValue) => {
                      onChange(currentValue === value ? '' : currentValue)
                      setOpen(false)
                    }}
                  >
                    <Check className={cn('mr-2 h-4 w-4', value === team.name ? 'opacity-100' : 'opacity-0')} />
                    {team.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export const Route = createFileRoute('/admin/create')({
  component: CreateSessionPage,
})

function CreateSessionPage() {
  const navigate = useNavigate()

  // Load real data from Convex
  const teamsQuery = usePaginatedQuery(api.teams.listTeams, {}, { initialNumItems: 100 })
  const maps = useQuery(api.maps.listMaps, { includeInactive: false })
  const adminId = useQuery(api.admins.getFirstAdmin)

  // Derive teams array from paginated query (memoized to prevent unnecessary re-renders)
  const teams: Team[] = useMemo(
    () => teamsQuery.results?.map((t) => ({ id: t._id, name: t.name })) ?? [],
    [teamsQuery.results],
  )
  const isLoadingTeams = teamsQuery.status === 'LoadingFirstPage'
  const isLoadingMaps = maps === undefined

  // Mutations
  const createSession = useMutation(api.sessions.createSession)
  const assignPlayer = useMutation(api.sessions.assignPlayer)
  const setSessionMaps = useMutation(api.sessions.setSessionMaps)

  // Form state
  const [matchName, setMatchName] = useState('')
  const [format, setFormat] = useState<SessionFormat>('ABBA')
  const [playerA, setPlayerA] = useState('')
  const [playerB, setPlayerB] = useState('')
  const [player1, setPlayer1] = useState('')
  const [player2, setPlayer2] = useState('')
  const [player3, setPlayer3] = useState('')
  const [player4, setPlayer4] = useState('')
  const [selectedMaps, setSelectedMaps] = useState<Id<'maps'>[]>([])
  const [turnTimer, setTurnTimer] = useState('30')
  const [mapPoolSize, setMapPoolSize] = useState(5)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleMapToggle = (mapId: Id<'maps'>) => {
    setSelectedMaps((prev) =>
      prev.includes(mapId) ? prev.filter((id) => id !== mapId) : prev.length < mapPoolSize ? [...prev, mapId] : prev,
    )
  }

  const handleMapPoolSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value)
    const clampedValue = Math.max(MIN_MAP_POOL_SIZE, Math.min(MAX_MAP_POOL_SIZE, value || MIN_MAP_POOL_SIZE))
    setMapPoolSize(clampedValue)
    // Clear selection if it exceeds new pool size
    if (selectedMaps.length > clampedValue) {
      setSelectedMaps((prev) => prev.slice(0, clampedValue))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!adminId) {
      toast.error('No admin found. Please seed the database first.')
      return
    }

    if (selectedMaps.length !== mapPoolSize) {
      toast.error(`Please select exactly ${mapPoolSize} maps`)
      return
    }

    // Normalize and validate inputs
    const trimmedMatchName = matchName.trim()
    if (!trimmedMatchName) {
      toast.error('Match name cannot be empty')
      return
    }

    const parsedTurnTimer = parseInt(turnTimer, 10)
    if (isNaN(parsedTurnTimer) || parsedTurnTimer < MIN_TURN_TIMER_SECONDS || parsedTurnTimer > MAX_TURN_TIMER_SECONDS) {
      toast.error(`Turn timer must be between ${MIN_TURN_TIMER_SECONDS} and ${MAX_TURN_TIMER_SECONDS} seconds`)
      return
    }

    setIsSubmitting(true)

    try {
      // TODO: Consider atomic createSessionWithPlayers mutation to prevent partial sessions (Phase 2)
      // 1. Create the session
      const { sessionId } = await createSession({
        matchName: trimmedMatchName,
        format,
        playerCount: format === 'ABBA' ? 2 : 4,
        turnTimerSeconds: parsedTurnTimer,
        mapPoolSize,
        createdBy: adminId,
      })

      // 2. Assign players in parallel (generates tokens)
      if (format === 'ABBA') {
        await Promise.all([
          assignPlayer({ sessionId, role: 'Player A', teamName: playerA }),
          assignPlayer({ sessionId, role: 'Player B', teamName: playerB }),
        ])
      } else {
        await Promise.all([
          assignPlayer({ sessionId, role: 'Player 1', teamName: player1 }),
          assignPlayer({ sessionId, role: 'Player 2', teamName: player2 }),
          assignPlayer({ sessionId, role: 'Player 3', teamName: player3 }),
          assignPlayer({ sessionId, role: 'Player 4', teamName: player4 }),
        ])
      }

      // 3. Set map pool
      await setSessionMaps({ sessionId, mapIds: selectedMaps })

      toast.success('Session created successfully!')

      // 4. Navigate to session detail
      navigate({ to: `/admin/session/${sessionId}` })
    } catch (error) {
      console.error('Failed to create session:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create session')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Determine if form is valid for submission
  const turnTimerSeconds = parseInt(turnTimer, 10)
  const isTurnTimerValid = !isNaN(turnTimerSeconds) && turnTimerSeconds >= MIN_TURN_TIMER_SECONDS && turnTimerSeconds <= MAX_TURN_TIMER_SECONDS

  const isFormValid =
    !isSubmitting &&
    !isLoadingTeams &&
    !isLoadingMaps &&
    adminId != null &&
    selectedMaps.length === mapPoolSize &&
    matchName.trim() !== '' &&
    isTurnTimerValid &&
    (format === 'ABBA' ? playerA && playerB : player1 && player2 && player3 && player4)

  return (
    <div className="flex-1 flex flex-col bg-background">
      <header className="border-b border-border/50 bg-card/30 backdrop-blur-sm">
        <div className="px-8 py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: '/admin/dashboard' })}
            className="gap-2 mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Sessions
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Create New Session</h1>
        </div>
      </header>

      <main className="flex-1 px-8 py-8 overflow-y-auto">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-8">
          {/* Match Name */}
          <div className="space-y-2">
            <Label htmlFor="matchName" className="text-sm font-medium text-foreground">
              Match Name
            </Label>
            <Input
              id="matchName"
              placeholder="e.g., A5, B3, Grand Final"
              value={matchName}
              onChange={(e) => setMatchName(e.target.value)}
              className="bg-background/50"
            />
          </div>

          {/* Format Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-foreground">Format</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card
                className={cn(
                  'cursor-pointer transition-all hover:border-primary/50',
                  format === 'ABBA'
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                    : 'border-border/50 bg-card/50',
                )}
                onClick={() => setFormat('ABBA')}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-primary/10">
                      <UserCircle2 className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground mb-1">ABBA Ban</h3>
                      <p className="text-sm text-muted-foreground">2 players, alternating bans (A-B-B-A)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card
                className={cn(
                  'cursor-pointer transition-all hover:border-primary/50',
                  format === 'MULTIPLAYER'
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                    : 'border-border/50 bg-card/50',
                )}
                onClick={() => setFormat('MULTIPLAYER')}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-primary/10">
                      <Users className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground mb-1">Multiplayer Vote</h3>
                      <p className="text-sm text-muted-foreground">4 players, simultaneous voting rounds</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Team Assignment */}
          <div className="space-y-4">
            <Label className="text-sm font-medium text-foreground">Team Assignment</Label>

            {format === 'ABBA' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TeamCombobox
                  value={playerA}
                  onChange={setPlayerA}
                  label="Player A (bans 1st & 4th)"
                  teams={teams}
                  isLoading={isLoadingTeams}
                />
                <TeamCombobox
                  value={playerB}
                  onChange={setPlayerB}
                  label="Player B (bans 2nd & 3rd)"
                  teams={teams}
                  isLoading={isLoadingTeams}
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TeamCombobox
                  value={player1}
                  onChange={setPlayer1}
                  label="Player 1"
                  teams={teams}
                  isLoading={isLoadingTeams}
                />
                <TeamCombobox
                  value={player2}
                  onChange={setPlayer2}
                  label="Player 2"
                  teams={teams}
                  isLoading={isLoadingTeams}
                />
                <TeamCombobox
                  value={player3}
                  onChange={setPlayer3}
                  label="Player 3"
                  teams={teams}
                  isLoading={isLoadingTeams}
                />
                <TeamCombobox
                  value={player4}
                  onChange={setPlayer4}
                  label="Player 4"
                  teams={teams}
                  isLoading={isLoadingTeams}
                />
              </div>
            )}
          </div>

          {/* Turn Timer */}
          <div className="space-y-2">
            <Label htmlFor="turnTimer" className="text-sm font-medium text-foreground">
              Turn Timer
            </Label>
            <div className="flex items-center gap-3">
              <Input
                id="turnTimer"
                type="number"
                min={MIN_TURN_TIMER_SECONDS}
                max={MAX_TURN_TIMER_SECONDS}
                value={turnTimer}
                onChange={(e) => setTurnTimer(e.target.value)}
                className="w-32 bg-background/50"
              />
              <span className="text-sm text-muted-foreground">seconds per turn</span>
            </div>
            <p className="text-xs text-muted-foreground">Players will be auto-skipped if timer expires</p>
          </div>

          {/* Map Pool Size */}
          <div className="space-y-2">
            <Label htmlFor="mapPoolSize" className="text-sm font-medium text-foreground">
              Map Pool Size
            </Label>
            <div className="flex items-center gap-3">
              <Input
                id="mapPoolSize"
                type="number"
                min={MIN_MAP_POOL_SIZE}
                max={MAX_MAP_POOL_SIZE}
                value={mapPoolSize}
                onChange={handleMapPoolSizeChange}
                className="w-32 bg-background/50"
              />
              <span className="text-sm text-muted-foreground">maps in pool</span>
            </div>
            <p className="text-xs text-muted-foreground">Choose between {MIN_MAP_POOL_SIZE} and {MAX_MAP_POOL_SIZE} maps for the voting pool</p>
          </div>

          {/* Map Pool */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-foreground">Select Maps</Label>
              <Badge
                variant="outline"
                className={cn(
                  'font-mono',
                  selectedMaps.length === mapPoolSize ? 'bg-chart-4/20 text-chart-4 border-chart-4/30' : '',
                )}
              >
                {selectedMaps.length}/{mapPoolSize} maps selected
              </Badge>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {isLoadingMaps ? (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  Loading maps...
                </div>
              ) : maps && maps.length > 0 ? (
                maps.map((map) => {
                  const isSelected = selectedMaps.includes(map._id)
                  return (
                    <Card
                      key={map._id}
                      className={cn(
                        'cursor-pointer transition-all hover:border-primary/50 relative overflow-hidden',
                        isSelected
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                          : 'border-border/50 bg-card/50',
                      )}
                      onClick={() => handleMapToggle(map._id)}
                    >
                      <div className="aspect-video relative">
                        <img
                          src={map.imageUrl || '/placeholder.svg'}
                          alt={map.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-2 right-2">
                          <div
                            className={cn(
                              'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                              isSelected
                                ? 'bg-primary border-primary'
                                : 'bg-background/50 border-border backdrop-blur-sm',
                            )}
                          >
                            {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                          </div>
                        </div>
                      </div>
                      <CardContent className="p-3">
                        <p className="text-sm font-medium text-foreground text-center">{map.name}</p>
                      </CardContent>
                    </Card>
                  )
                })
              ) : (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  No maps available. Please add maps in the Maps CMS.
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <Button type="submit" size="lg" className="w-full" disabled={!isFormValid}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Session'
            )}
          </Button>
        </form>
      </main>
    </div>
  )
}
