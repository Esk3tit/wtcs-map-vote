import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Plus, Pencil, Trash2, Users, Upload } from 'lucide-react'
import { useState } from 'react'

interface Team {
  id: string
  name: string
  logoUrl?: string
  sessionsCount: number
  dateAdded: Date
}

// Mock data for demonstration
const mockTeams: Team[] = [
  {
    id: '1',
    name: 'Team Liquid',
    sessionsCount: 12,
    dateAdded: new Date('2024-01-10'),
  },
  {
    id: '2',
    name: 'Fnatic',
    sessionsCount: 8,
    dateAdded: new Date('2024-01-12'),
  },
  {
    id: '3',
    name: 'G2 Esports',
    sessionsCount: 15,
    dateAdded: new Date('2024-01-08'),
  },
  {
    id: '4',
    name: 'Cloud9',
    sessionsCount: 10,
    dateAdded: new Date('2024-01-15'),
  },
]

export const Route = createFileRoute('/admin/teams')({
  component: TeamsPage,
})

function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>(mockTeams)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTeam, setEditingTeam] = useState<Team | null>(null)
  const [teamName, setTeamName] = useState('')

  const hasNoTeams = teams.length === 0

  const handleAddTeam = () => {
    setEditingTeam(null)
    setTeamName('')
    setIsDialogOpen(true)
  }

  const handleEditTeam = (team: Team) => {
    setEditingTeam(team)
    setTeamName(team.name)
    setIsDialogOpen(true)
  }

  const handleDeleteTeam = (teamId: string) => {
    if (confirm('Are you sure you want to delete this team?')) {
      setTeams(teams.filter((t) => t.id !== teamId))
    }
  }

  const handleSaveTeam = () => {
    if (!teamName.trim()) return

    if (editingTeam) {
      // Update existing team
      setTeams(teams.map((t) => (t.id === editingTeam.id ? { ...t, name: teamName } : t)))
    } else {
      // Add new team
      const newTeam: Team = {
        id: Date.now().toString(),
        name: teamName,
        sessionsCount: 0,
        dateAdded: new Date(),
      }
      setTeams([...teams, newTeam])
    }

    setIsDialogOpen(false)
    setTeamName('')
    setEditingTeam(null)
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  return (
    <>
      <div className="flex-1 flex flex-col">
        <header className="border-b border-border/50 bg-card/30 backdrop-blur-sm">
          <div className="px-8 py-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">Registered Teams</h1>
            <Button onClick={handleAddTeam} size="default" className="gap-2">
              <Plus className="w-4 h-4" />
              Add Team
            </Button>
          </div>
        </header>

        <main className="flex-1 px-8 py-8">
          {hasNoTeams ? (
            // Empty State
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="w-64 h-64 mb-6 rounded-lg bg-muted/30 flex items-center justify-center">
                <Users className="w-24 h-24 text-muted-foreground/50" />
              </div>
              <h2 className="text-2xl font-semibold text-foreground mb-2">No teams registered yet</h2>
              <p className="text-muted-foreground mb-6 text-center max-w-md">
                Add teams to quickly select them when creating voting sessions.
              </p>
              <Button onClick={handleAddTeam} size="lg" className="gap-2">
                <Plus className="w-5 h-5" />
                Add Team
              </Button>
            </div>
          ) : (
            // Teams Table
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50 hover:bg-transparent">
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Team Name</TableHead>
                      <TableHead className="text-center">Sessions</TableHead>
                      <TableHead>Date Added</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teams.map((team) => (
                      <TableRow key={team.id} className="border-border/50">
                        <TableCell>
                          <Avatar className="w-10 h-10">
                            <AvatarFallback className="bg-primary/20 text-primary font-semibold">
                              {team.name.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        </TableCell>
                        <TableCell className="font-medium">{team.name}</TableCell>
                        <TableCell className="text-center">{team.sessionsCount}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(team.dateAdded)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              onClick={() => handleEditTeam(team)}
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <Pencil className="w-4 h-4" />
                              <span className="sr-only">Edit {team.name}</span>
                            </Button>
                            <Button
                              onClick={() => handleDeleteTeam(team.id)}
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span className="sr-only">Delete {team.name}</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </main>
      </div>

      {/* Add/Edit Team Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingTeam ? 'Edit Team' : 'Add Team'}</DialogTitle>
            <DialogDescription>
              {editingTeam ? 'Update the team information below.' : 'Enter the details for the new team.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="teamName">
                Team Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="teamName"
                placeholder="Enter team name"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Team Logo (Optional)</Label>
              <div className="border-2 border-dashed border-border/50 rounded-lg p-8 flex flex-col items-center justify-center gap-3 hover:border-primary/50 transition-colors cursor-pointer bg-muted/20">
                <Upload className="w-8 h-8 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Drop logo here or click to browse</p>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 2MB</p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTeam} disabled={!teamName.trim()}>
              Save Team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
