"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Check, Lock, Volume2, X } from "lucide-react"

type MapStatus = "available" | "banned"

interface MapData {
  id: string
  name: string
  image: string
  status: MapStatus
  bannedBy?: string
}

interface BanStep {
  step: number
  team: string
  completed: boolean
}

export function PlayerVotingAbba() {
  const [timeLeft, setTimeLeft] = useState(27)
  const [isYourTurn, setIsYourTurn] = useState(true)
  const [hoveredMap, setHoveredMap] = useState<string | null>(null)
  const [confirmBanMap, setConfirmBanMap] = useState<MapData | null>(null)

  const matchName = "Match A5"
  const playerName = "s1mple"
  const yourTeam = "Team Liquid"
  const opponentTeam = "Fnatic"

  const [maps, setMaps] = useState<MapData[]>([
    { id: "1", name: "Dust 2", image: "/dust2.jpg", status: "available" },
    { id: "2", name: "Mirage", image: "/mirage.jpg", status: "banned", bannedBy: "Team Liquid" },
    { id: "3", name: "Inferno", image: "/inferno.jpg", status: "available" },
    { id: "4", name: "Nuke", image: "/nuke.jpg", status: "banned", bannedBy: "Fnatic" },
    { id: "5", name: "Ancient", image: "/ancient.jpg", status: "available" },
  ])

  const banSteps: BanStep[] = [
    { step: 1, team: yourTeam, completed: true },
    { step: 2, team: opponentTeam, completed: true },
    { step: 3, team: opponentTeam, completed: false },
    { step: 4, team: yourTeam, completed: false },
  ]

  const currentStep = banSteps.findIndex((step) => !step.completed)

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) return

    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)

    return () => clearInterval(timer)
  }, [timeLeft])

  const handleBanMap = (mapId: string) => {
    if (!isYourTurn) return
    const mapToBan = maps.find((map) => map.id === mapId)
    if (mapToBan) {
      setConfirmBanMap(mapToBan)
    }
  }

  const confirmBan = () => {
    if (!confirmBanMap) return

    setMaps(maps.map((map) => (map.id === confirmBanMap.id ? { ...map, status: "banned", bannedBy: yourTeam } : map)))

    // Simulate turn change
    setIsYourTurn(false)
    setTimeLeft(30)
    setConfirmBanMap(null)
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">{matchName}</h1>
            <Badge variant="secondary" className="bg-muted">
              ABBA Ban
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">You are:</span>
            <span className="text-sm font-bold text-foreground">{playerName}</span>
            <span className="text-sm text-muted-foreground">({yourTeam})</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 py-8">
        {/* Turn Status Section */}
        <div className="max-w-5xl mx-auto mb-8">
          <div
            className={`rounded-lg p-6 text-center mb-4 ${
              isYourTurn ? "bg-green-950/50 border-2 border-green-600" : "bg-muted border-2 border-border"
            }`}
          >
            <div className="text-2xl font-bold mb-2">
              {isYourTurn ? "YOUR TURN TO BAN" : `Waiting for ${opponentTeam} to ban...`}
            </div>
          </div>

          <div
            className={`text-center mb-4 font-mono text-7xl font-bold ${
              isYourTurn ? "text-primary" : "text-muted-foreground"
            }`}
          >
            0:{timeLeft.toString().padStart(2, "0")}
          </div>

          {isYourTurn && <p className="text-center text-muted-foreground text-lg">Select a map to ban</p>}
        </div>

        {/* Map Grid */}
        <div className="max-w-6xl mx-auto mb-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {maps.map((map) => (
              <Card
                key={map.id}
                className={`overflow-hidden transition-all duration-200 relative group ${
                  map.status === "available" && isYourTurn
                    ? "cursor-pointer hover:ring-2 hover:ring-primary hover:shadow-lg hover:shadow-primary/20"
                    : ""
                } ${map.status === "banned" ? "opacity-60" : ""}`}
                onMouseEnter={() => map.status === "available" && isYourTurn && setHoveredMap(map.id)}
                onMouseLeave={() => setHoveredMap(null)}
              >
                <div className="aspect-video relative overflow-hidden">
                  <img
                    src={map.image || "/placeholder.svg"}
                    alt={map.name}
                    className={`w-full h-full object-cover ${map.status === "banned" ? "grayscale" : ""}`}
                  />

                  {/* Banned Overlay */}
                  {map.status === "banned" && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <X className="w-16 h-16 text-red-600" strokeWidth={4} />
                    </div>
                  )}

                  {/* Hover Ban Button */}
                  {map.status === "available" && isYourTurn && hoveredMap === map.id && (
                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                      <Button
                        variant="destructive"
                        size="lg"
                        onClick={() => handleBanMap(map.id)}
                        className="font-bold"
                      >
                        BAN
                      </Button>
                    </div>
                  )}
                </div>

                <div className="p-3">
                  <div className="font-semibold text-center">{map.name}</div>
                  {map.status === "banned" && map.bannedBy && (
                    <div className="text-xs text-center text-muted-foreground mt-1">Banned by {map.bannedBy}</div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Progress Tracker */}
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            {banSteps.map((step, index) => (
              <div key={index} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2 mb-2 ${
                      step.completed
                        ? "bg-primary border-primary"
                        : currentStep === index
                          ? "bg-primary/20 border-primary"
                          : "bg-muted border-border"
                    }`}
                  >
                    {step.completed ? (
                      <Check className="w-5 h-5 text-primary-foreground" />
                    ) : (
                      <span className={currentStep === index ? "text-primary font-bold" : "text-muted-foreground"}>
                        {step.step}
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-sm text-center ${
                      currentStep === index ? "text-foreground font-semibold" : "text-muted-foreground"
                    }`}
                  >
                    {step.team}
                  </span>
                </div>
                {index < banSteps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-4 ${step.completed ? "bg-primary" : "bg-border"}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="w-4 h-4" />
            <span>Session locked to your device</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Volume2 className="w-4 h-4" />
            <span>Audio alerts enabled</span>
          </div>
        </div>
      </footer>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmBanMap} onOpenChange={(open) => !open && setConfirmBanMap(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Ban</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to ban <span className="font-semibold text-foreground">{confirmBanMap?.name}</span>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBan}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirm Ban
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
