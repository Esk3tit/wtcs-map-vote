"use client"

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Plus, Eye, LogOut, User, Users, Calendar } from "lucide-react"
import { useState } from "react"
import { TeamsManagement } from "./teams-management"
import { CreateSessionForm } from "./create-session-form"
import { SessionDetail } from "./session-detail"

type SessionFormat = "ABBA" | "Multiplayer"
type SessionStatus = "Waiting" | "In Progress" | "Complete"

interface Session {
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

// Mock data for demonstration
const mockSessions: Session[] = [
  {
    id: "1",
    matchName: "Match A5",
    teamA: "Team Liquid",
    teamB: "Fnatic",
    format: "ABBA",
    status: "In Progress",
    playersConnected: 2,
    maxPlayers: 2,
    createdAt: new Date("2024-01-15T14:30:00"),
  },
  {
    id: "2",
    matchName: "Finals Match",
    teamA: "G2 Esports",
    teamB: "Cloud9",
    format: "Multiplayer",
    status: "Waiting",
    playersConnected: 3,
    maxPlayers: 4,
    createdAt: new Date("2024-01-15T15:45:00"),
  },
  {
    id: "3",
    matchName: "Semi-Final B",
    teamA: "NRG",
    teamB: "Evil Geniuses",
    format: "ABBA",
    status: "Complete",
    playersConnected: 2,
    maxPlayers: 2,
    createdAt: new Date("2024-01-15T12:00:00"),
  },
]

const getStatusColor = (status: SessionStatus) => {
  switch (status) {
    case "Waiting":
      return "bg-chart-4/20 text-chart-4 border-chart-4/30"
    case "In Progress":
      return "bg-primary/20 text-primary border-primary/30"
    case "Complete":
      return "bg-muted text-muted-foreground border-border"
    default:
      return "bg-muted text-muted-foreground border-border"
  }
}

const formatTimestamp = (date: Date) => {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)

  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return date.toLocaleDateString()
}

export function AdminDashboard() {
  const [activeNav, setActiveNav] = useState<"sessions" | "teams">("sessions")
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const sessions = mockSessions
  const hasNoSessions = sessions.length === 0

  const handleCreateSession = () => {
    setShowCreateForm(true)
  }

  const handleViewSession = (sessionId: string) => {
    setSelectedSessionId(sessionId)
  }

  const handleLogout = () => {
    console.log("Logout clicked")
    // TODO: Implement logout
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-64 border-r border-border/50 bg-card/30 backdrop-blur-sm flex flex-col">
        <div className="p-6 border-b border-border/50">
          <h2 className="text-xl font-bold text-foreground">WTCS Map Vote</h2>
          <p className="text-sm text-muted-foreground">Admin Portal</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <Button
            variant={activeNav === "sessions" ? "secondary" : "ghost"}
            className="w-full justify-start gap-3"
            onClick={() => setActiveNav("sessions")}
          >
            <Calendar className="w-5 h-5" />
            Sessions
          </Button>
          <Button
            variant={activeNav === "teams" ? "secondary" : "ghost"}
            className="w-full justify-start gap-3"
            onClick={() => setActiveNav("teams")}
          >
            <Users className="w-5 h-5" />
            Teams
          </Button>
        </nav>

        <div className="p-4 border-t border-border/50">
          <div className="flex items-center gap-3 mb-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src="/admin-interface.png" />
              <AvatarFallback className="bg-primary/20 text-primary">
                <User className="w-5 h-5" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">Admin User</p>
              <p className="text-xs text-muted-foreground truncate">admin@wtcs.gg</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="w-full gap-2 bg-transparent" onClick={handleLogout}>
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      {activeNav === "sessions" && selectedSessionId ? (
        <SessionDetail sessionId={selectedSessionId} onBack={() => setSelectedSessionId(null)} />
      ) : activeNav === "sessions" && showCreateForm ? (
        <CreateSessionForm onBack={() => setShowCreateForm(false)} />
      ) : activeNav === "sessions" ? (
        <div className="flex-1 flex flex-col">
          <header className="border-b border-border/50 bg-card/30 backdrop-blur-sm">
            <div className="px-8 py-4 flex items-center justify-between">
              <h1 className="text-2xl font-bold text-foreground">Active Sessions</h1>
              <Button onClick={handleCreateSession} size="default" className="gap-2">
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
                <Button onClick={handleCreateSession} size="lg" className="gap-2">
                  <Plus className="w-5 h-5" />
                  Create Session
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sessions.map((session) => (
                  <Card
                    key={session.id}
                    className="border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-colors"
                  >
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
                        onClick={() => handleViewSession(session.id)}
                        variant="secondary"
                        size="sm"
                        className="w-full gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </main>
        </div>
      ) : (
        <TeamsManagement />
      )}
    </div>
  )
}
