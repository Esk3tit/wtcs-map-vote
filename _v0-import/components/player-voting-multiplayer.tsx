"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Lock, Check, Loader2 } from "lucide-react"
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

const mockMaps = [
  { id: 1, name: "Dust 2", image: "/dust2.jpg", eliminated: false, voteCount: 0 },
  { id: 2, name: "Mirage", image: "/mirage.jpg", eliminated: false, voteCount: 0 },
  { id: 3, name: "Inferno", image: "/inferno.jpg", eliminated: true, voteCount: 3 },
  { id: 4, name: "Nuke", image: "/nuke.jpg", eliminated: false, voteCount: 0 },
  { id: 5, name: "Ancient", image: "/ancient.jpg", eliminated: false, voteCount: 0 },
  { id: 6, name: "Anubis", image: "/anubis.jpg", eliminated: false, voteCount: 0 },
  { id: 7, name: "Vertigo", image: "/vertigo.jpg", eliminated: true, voteCount: 2 },
]

const mockPlayers = [
  { id: 1, teamName: "Team Liquid", playerName: "Twistzz", hasVoted: false },
  { id: 2, teamName: "Fnatic", playerName: "KRIMZ", hasVoted: false },
  { id: 3, teamName: "G2 Esports", playerName: "NiKo", hasVoted: false, isCurrentUser: true },
  { id: 4, teamName: "Navi", playerName: "s1mple", hasVoted: false },
]

type VotingState = "voting" | "waiting" | "reveal"

export default function PlayerVotingMultiplayer() {
  const [timeLeft, setTimeLeft] = useState(18)
  const [selectedMap, setSelectedMap] = useState<number | null>(null)
  const [votingState, setVotingState] = useState<VotingState>("voting")
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [mapToConfirm, setMapToConfirm] = useState<number | null>(null)
  const [players, setPlayers] = useState(mockPlayers)
  const [maps, setMaps] = useState(mockMaps)
  const currentPlayer = players.find((p) => p.isCurrentUser)

  // Countdown timer
  useEffect(() => {
    if (timeLeft > 0 && votingState !== "reveal") {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [timeLeft, votingState])

  useEffect(() => {
    if (votingState === "waiting") {
      const allVotedTimer = setTimeout(() => {
        // Simulate other players voting
        setPlayers((prev) => prev.map((p) => ({ ...p, hasVoted: true })))

        // Simulate vote results
        setMaps((prev) =>
          prev.map((m) => {
            if (m.id === 2) return { ...m, voteCount: 2 } // Mirage gets 2 votes
            if (m.id === 4) return { ...m, voteCount: 0 } // Nuke gets 0 votes
            return m
          }),
        )

        setVotingState("reveal")
      }, 3000)
      return () => clearTimeout(allVotedTimer)
    }
  }, [votingState])

  useEffect(() => {
    if (votingState === "reveal") {
      const revealTimer = setTimeout(() => {
        // Animate elimination
        setMaps((prev) =>
          prev.map((m) => {
            if (m.voteCount > 0) return { ...m, eliminated: true }
            return m
          }),
        )
      }, 3000)
      return () => clearTimeout(revealTimer)
    }
  }, [votingState])

  const handleMapClick = (mapId: number) => {
    if (votingState !== "voting") return
    setMapToConfirm(mapId)
    setShowConfirmDialog(true)
  }

  const handleConfirmSubmit = () => {
    if (mapToConfirm) {
      setSelectedMap(mapToConfirm)
      setPlayers((prev) => prev.map((p) => (p.isCurrentUser ? { ...p, hasVoted: true } : p)))
      setVotingState("waiting")
    }
    setShowConfirmDialog(false)
    setMapToConfirm(null)
  }

  const activeMaps = maps.filter((m) => !m.eliminated)
  const eliminatedMaps = maps.filter((m) => m.eliminated)

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 pb-32">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold">Match B3</h1>
            <Badge variant="outline" className="border-zinc-700">
              Multiplayer Vote
            </Badge>
            <Badge variant="secondary">Round 2</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-400">You are:</span>
            <span className="font-semibold text-amber-500">{currentPlayer?.playerName}</span>
            <span className="text-sm text-zinc-500">({currentPlayer?.teamName})</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {/* Status Section */}
        <div className="mb-8 space-y-4 text-center">
          {votingState === "voting" && (
            <>
              <Badge variant="default" className="text-base px-4 py-2 bg-amber-600 hover:bg-amber-700">
                SELECT A MAP TO ELIMINATE
              </Badge>
              <div className="font-mono text-6xl font-bold tabular-nums">{timeLeft}s</div>
              <p className="text-zinc-400">Choose one map you want to eliminate</p>
            </>
          )}
          {votingState === "waiting" && (
            <>
              <Badge variant="secondary" className="text-base px-4 py-2">
                VOTE SUBMITTED - WAITING FOR OTHERS
              </Badge>
              <div className="font-mono text-6xl font-bold tabular-nums text-zinc-500">{timeLeft}s</div>
              <p className="text-zinc-400">Waiting for other players to vote...</p>
            </>
          )}
          {votingState === "reveal" && (
            <>
              <Badge variant="default" className="text-base px-4 py-2 bg-blue-600 hover:bg-blue-700">
                ROUND 2 RESULTS
              </Badge>
              <div className="font-mono text-4xl font-bold text-zinc-400">Revealing votes...</div>
              <p className="text-zinc-400">Next round starting soon</p>
            </>
          )}
        </div>

        {/* Active Maps Grid */}
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {activeMaps.map((map) => (
            <Card
              key={map.id}
              className={`group relative transition-all ${
                votingState === "voting" && "cursor-pointer hover:border-amber-500"
              } ${
                selectedMap === map.id && votingState === "waiting" ? "border-amber-500 border-2" : "border-zinc-800"
              } ${votingState === "reveal" && map.voteCount > 0 ? "border-red-500 border-2" : ""}`}
            >
              <CardContent className="relative p-0">
                <img
                  src={map.image || "/placeholder.svg"}
                  alt={map.name}
                  className={`aspect-video w-full rounded-t-lg object-cover transition-all ${
                    votingState === "reveal" && map.voteCount > 0 ? "grayscale" : ""
                  }`}
                />
                {votingState === "voting" && (
                  <div
                    className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => handleMapClick(map.id)}
                  >
                    <Button size="lg" className="bg-red-600 hover:bg-red-700 text-white font-bold">
                      BAN
                    </Button>
                  </div>
                )}
                {selectedMap === map.id && votingState === "waiting" && (
                  <div className="absolute top-2 right-2">
                    <Badge className="bg-amber-600 hover:bg-amber-700">Your vote</Badge>
                  </div>
                )}
                {votingState === "reveal" && (
                  <>
                    <div className="absolute top-2 right-2">
                      {map.voteCount > 0 ? (
                        <Badge className="bg-red-600">{map.voteCount} votes</Badge>
                      ) : (
                        <Badge className="bg-green-600">Safe</Badge>
                      )}
                    </div>
                    {map.voteCount > 0 && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-in fade-in duration-500">
                        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-red-500/90">
                          <span className="text-5xl font-bold text-white">✕</span>
                        </div>
                      </div>
                    )}
                  </>
                )}
                <div className="p-3">
                  <h3 className="font-semibold">{map.name}</h3>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Eliminated Maps */}
        {eliminatedMaps.length > 0 && (
          <div className="mb-8">
            <h3 className="mb-4 text-sm font-semibold text-zinc-400">ELIMINATED MAPS</h3>
            <div className="grid grid-cols-3 gap-3 md:grid-cols-5 lg:grid-cols-7">
              {eliminatedMaps.map((map) => (
                <div key={map.id} className="relative">
                  <Card className="border-zinc-800 opacity-40">
                    <CardContent className="p-0">
                      <img
                        src={map.image || "/placeholder.svg"}
                        alt={map.name}
                        className="aspect-video w-full rounded-t-lg object-cover grayscale"
                      />
                      <div className="p-2">
                        <p className="text-xs text-zinc-500">{map.name}</p>
                        {map.voteCount > 0 && <p className="text-xs text-zinc-600">({map.voteCount} votes)</p>}
                      </div>
                    </CardContent>
                  </Card>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/90">
                      <span className="text-2xl font-bold text-white">✕</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Player Status Bar */}
      <footer className="fixed bottom-0 left-0 right-0 border-t border-zinc-800 bg-zinc-900/95 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="mb-2 flex flex-wrap items-center justify-center gap-6">
            {players.map((player, index) => (
              <div key={player.id} className="flex items-center gap-2">
                <span className={`text-sm ${player.isCurrentUser ? "font-semibold text-amber-500" : "text-zinc-400"}`}>
                  {player.playerName}
                </span>
                <span className="text-xs text-zinc-600">({player.teamName})</span>
                {player.hasVoted ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
                )}
                {player.isCurrentUser && <span className="text-xs text-zinc-500">(you)</span>}
                {index < players.length - 1 && <span className="text-zinc-700">|</span>}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-zinc-500">
            <Lock className="h-3 w-3" />
            <span>Session locked to your device</span>
          </div>
        </div>
      </footer>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="border-zinc-800 bg-zinc-900">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Your Vote</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Are you sure you want to vote to eliminate:
              <div className="mt-3">
                <div className="font-semibold text-red-400 text-lg">
                  {maps.find((m) => m.id === mapToConfirm)?.name}
                </div>
              </div>
              <div className="mt-4 text-sm">Once submitted, you cannot change your vote for this round.</div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zinc-700">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSubmit} className="bg-red-600 hover:bg-red-700">
              Confirm Vote
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
