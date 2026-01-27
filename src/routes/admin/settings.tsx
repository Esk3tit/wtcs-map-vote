import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/lib/convex'
import type { Id } from '../../../convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'sonner'
import {
  Trash2,
  ShieldCheck,
  ShieldOff,
  UserPlus,
  MoreHorizontal,
  LogOut,
  User,
  Loader2,
} from 'lucide-react'

export const Route = createFileRoute('/admin/settings')({
  component: AdminSettings,
})

function AdminSettings() {
  const me = useQuery(api.admins.getMe)
  const admins = useQuery(api.admins.listAdmins)
  const addAdminMutation = useMutation(api.admins.addAdmin)
  const removeAdminMutation = useMutation(api.admins.removeAdmin)
  const updateRoleMutation = useMutation(api.admins.updateAdminRole)
  const invalidateSessionsMutation = useMutation(api.admins.invalidateAdminSessions)

  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')
  const [makeRoot, setMakeRoot] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Loading state
  if (me === undefined || admins === undefined) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Access denied for non-root admins
  if (!me?.isRootAdmin) {
    return (
      <div className="p-6">
        <Card className="p-6 max-w-md mx-auto text-center">
          <ShieldOff className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground">
            Only root admins can access admin management.
          </p>
        </Card>
      </div>
    )
  }

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await addAdminMutation({
        email: newEmail,
        name: newName,
        isRootAdmin: makeRoot,
      })
      toast.success(`Added ${newEmail} to whitelist`)
      setNewEmail('')
      setNewName('')
      setMakeRoot(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add admin')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRemove = async (adminId: Id<'admins'>, email: string) => {
    try {
      await removeAdminMutation({ adminId })
      toast.success(`Removed ${email} from whitelist (sessions invalidated)`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove admin')
    }
  }

  const handleToggleRole = async (adminId: Id<'admins'>, currentIsRoot: boolean, email: string) => {
    try {
      await updateRoleMutation({ adminId, isRootAdmin: !currentIsRoot })
      toast.success(`${currentIsRoot ? 'Demoted' : 'Promoted'} ${email}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update role')
    }
  }

  const handleForceLogout = async (adminId: Id<'admins'>, email: string) => {
    try {
      await invalidateSessionsMutation({ adminId })
      toast.success(`Force logged out ${email}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to invalidate sessions')
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Admin Management</h1>
        <p className="text-muted-foreground">
          Manage admin whitelist and permissions
        </p>
      </div>

      {/* Add Admin Form */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Add New Admin
        </h2>
        <form onSubmit={handleAddAdmin} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="admin@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="John Doe"
                required
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="makeRoot"
              checked={makeRoot}
              onCheckedChange={(checked) => setMakeRoot(checked === true)}
            />
            <Label htmlFor="makeRoot" className="cursor-pointer text-sm">
              Grant root admin privileges
            </Label>
          </div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              'Add Admin'
            )}
          </Button>
        </form>
      </Card>

      {/* Admin List */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Admin</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {admins.map((admin) => (
              <TableRow
                key={admin._id}
                className={admin._id === me._id ? 'bg-muted/50' : ''}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={admin.avatarUrl} alt={admin.name} />
                      <AvatarFallback className="bg-primary/20 text-primary">
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">
                        {admin.name}
                        {admin._id === me._id && (
                          <span className="text-muted-foreground ml-2">(you)</span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {admin.email}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {admin.isRootAdmin ? (
                    <Badge>Root Admin</Badge>
                  ) : (
                    <Badge variant="secondary">Admin</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {admin.lastLoginAt > 0
                    ? new Date(admin.lastLoginAt).toLocaleDateString()
                    : 'Never'}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={<Button variant="ghost" size="sm" />}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {/* Toggle Role */}
                      <DropdownMenuItem
                        onClick={() =>
                          handleToggleRole(admin._id, admin.isRootAdmin, admin.email)
                        }
                      >
                        {admin.isRootAdmin ? (
                          <>
                            <ShieldOff className="mr-2 h-4 w-4" />
                            Demote to Admin
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="mr-2 h-4 w-4" />
                            Promote to Root Admin
                          </>
                        )}
                      </DropdownMenuItem>

                      {/* Force Logout */}
                      <DropdownMenuItem
                        onClick={() => handleForceLogout(admin._id, admin.email)}
                        disabled={admin._id === me._id}
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Force Logout
                      </DropdownMenuItem>

                      <DropdownMenuSeparator />

                      {/* Remove Admin */}
                      <RemoveAdminDialog
                        admin={admin}
                        isCurrentUser={admin._id === me._id}
                        onRemove={() => handleRemove(admin._id, admin.email)}
                      />
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}

interface RemoveAdminDialogProps {
  admin: {
    _id: string
    name: string
    email: string
  }
  isCurrentUser: boolean
  onRemove: () => void
}

function RemoveAdminDialog({ admin, isCurrentUser, onRemove }: RemoveAdminDialogProps) {
  const [open, setOpen] = useState(false)

  const handleRemove = () => {
    onRemove()
    setOpen(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <DropdownMenuItem
            variant="destructive"
            onSelect={(e) => {
              e.preventDefault()
              setOpen(true)
            }}
          />
        }
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Remove Admin
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove Admin?</AlertDialogTitle>
          <AlertDialogDescription>
            This will revoke {admin.name}'s admin access and immediately log them
            out of all active sessions.
            {isCurrentUser && (
              <span className="block mt-2 text-destructive font-medium">
                Warning: You are removing yourself!
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleRemove}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Remove Admin
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
