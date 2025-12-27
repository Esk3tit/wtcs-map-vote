"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ArrowLeft, Users, UserCircle2, Check, ChevronsUpDown } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

type SessionFormat = "ABBA" | "Multiplayer"

interface Team {
  id: string
  name: string
}

// Mock teams data
const mockTeams: Team[] = [
  { id: "1", name: "Team Liquid" },
  { id: "2", name: "Fnatic" },
  { id: "3", name: "G2 Esports" },
  { id: "4", name: "Cloud9" },
  { id: "5", name: "NRG" },
  { id: "6", name: "Evil Geniuses" },
]

const CS2_MAPS = [
  { id: "dust2", name: "Dust II", image: "/dust2.jpg" },
  { id: "mirage", name: "Mirage", image: "/mirage.jpg" },
  { id: "inferno", name: "Inferno", image: "/inferno.jpg" },
  { id: "nuke", name: "Nuke", image: "/nuke.jpg" },
  { id: "ancient", name: "Ancient", image: "/ancient.jpg" },
  { id: "anubis", name: "Anubis", image: "/anubis.jpg" },
  { id: "vertigo", name: "Vertigo", image: "/vertigo.jpg" },
]

function TeamCombobox({
  value,
  onChange,
  label,
  teams,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  teams: Team[]
}) {
  const [open, setOpen] = useState(false)
  const [customValue, setCustomValue] = useState("")

  const selectedTeam = teams.find((team) => team.name === value)
  const displayValue = value || "Select team..."

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between bg-background/50"
          >
            <span className={cn(!value && "text-muted-foreground")}>{displayValue}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search teams or type custom name..."
              value={customValue}
              onValueChange={setCustomValue}
            />
            <CommandList>
              <CommandEmpty>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-left"
                  onClick={() => {
                    onChange(customValue)
                    setOpen(false)
                    setCustomValue("")
                  }}
                >
                  Use "{customValue}"
                </Button>
              </CommandEmpty>
              <CommandGroup>
                {teams.map((team) => (
                  <CommandItem
                    key={team.id}
                    value={team.name}
                    onSelect={(currentValue) => {
                      onChange(currentValue === value ? "" : currentValue)
                      setOpen(false)
                      setCustomValue("")
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === team.name ? "opacity-100" : "opacity-0")} />
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

export function CreateSessionForm({ onBack }: { onBack: () => void }) {
  const [matchName, setMatchName] = useState("")
  const [format, setFormat] = useState<SessionFormat>("ABBA")
  const [playerA, setPlayerA] = useState("")
  const [playerB, setPlayerB] = useState("")
  const [player1, setPlayer1] = useState("")
  const [player2, setPlayer2] = useState("")
  const [player3, setPlayer3] = useState("")
  const [player4, setPlayer4] = useState("")
  const [selectedMaps, setSelectedMaps] = useState<string[]>([])
  const [turnTimer, setTurnTimer] = useState("30")

  const handleMapToggle = (mapId: string) => {
    setSelectedMaps((prev) =>
      prev.includes(mapId) ? prev.filter((id) => id !== mapId) : prev.length < 5 ? [...prev, mapId] : prev,
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("[v0] Form submitted:", {
      matchName,
      format,
      teams: format === "ABBA" ? { playerA, playerB } : { player1, player2, player3, player4 },
      selectedMaps,
      turnTimer,
    })
    // TODO: Implement session creation
  }

  return (
    <div className="flex-1 flex flex-col bg-background">
      <header className="border-b border-border/50 bg-card/30 backdrop-blur-sm">
        <div className="px-8 py-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-2 mb-3">
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
                  "cursor-pointer transition-all hover:border-primary/50",
                  format === "ABBA"
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "border-border/50 bg-card/50",
                )}
                onClick={() => setFormat("ABBA")}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-primary/10">
                      <UserCircle2 className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground mb-1">ABBA Ban</h3>
                      <p className="text-sm text-muted-foreground">2 players, alternating bans (A→B→B→A)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card
                className={cn(
                  "cursor-pointer transition-all hover:border-primary/50",
                  format === "Multiplayer"
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "border-border/50 bg-card/50",
                )}
                onClick={() => setFormat("Multiplayer")}
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

            {format === "ABBA" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TeamCombobox
                  value={playerA}
                  onChange={setPlayerA}
                  label="Player A (bans 1st & 4th)"
                  teams={mockTeams}
                />
                <TeamCombobox
                  value={playerB}
                  onChange={setPlayerB}
                  label="Player B (bans 2nd & 3rd)"
                  teams={mockTeams}
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TeamCombobox value={player1} onChange={setPlayer1} label="Player 1" teams={mockTeams} />
                <TeamCombobox value={player2} onChange={setPlayer2} label="Player 2" teams={mockTeams} />
                <TeamCombobox value={player3} onChange={setPlayer3} label="Player 3" teams={mockTeams} />
                <TeamCombobox value={player4} onChange={setPlayer4} label="Player 4" teams={mockTeams} />
              </div>
            )}
          </div>

          {/* Map Pool */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-foreground">Select Maps</Label>
              <Badge
                variant="outline"
                className={cn(
                  "font-mono",
                  selectedMaps.length === 5 ? "bg-chart-4/20 text-chart-4 border-chart-4/30" : "",
                )}
              >
                {selectedMaps.length}/5 maps selected
              </Badge>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {CS2_MAPS.map((map) => {
                const isSelected = selectedMaps.includes(map.id)
                return (
                  <Card
                    key={map.id}
                    className={cn(
                      "cursor-pointer transition-all hover:border-primary/50 relative overflow-hidden",
                      isSelected ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border/50 bg-card/50",
                    )}
                    onClick={() => handleMapToggle(map.id)}
                  >
                    <div className="aspect-video relative">
                      <img
                        src={map.image || "/placeholder.svg"}
                        alt={map.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 right-2">
                        <div
                          className={cn(
                            "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                            isSelected
                              ? "bg-primary border-primary"
                              : "bg-background/50 border-border backdrop-blur-sm",
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
              })}
            </div>
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
                min="10"
                max="120"
                value={turnTimer}
                onChange={(e) => setTurnTimer(e.target.value)}
                className="w-32 bg-background/50"
              />
              <span className="text-sm text-muted-foreground">seconds per turn</span>
            </div>
            <p className="text-xs text-muted-foreground">Players will be auto-skipped if timer expires</p>
          </div>

          {/* Submit Button */}
          <Button type="submit" size="lg" className="w-full" disabled={selectedMaps.length !== 5}>
            Create Session
          </Button>
        </form>
      </main>
    </div>
  )
}
