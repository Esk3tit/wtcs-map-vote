import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Pencil, Trash2, Users, Loader2 } from "lucide-react";
import { useState, useCallback } from "react";
import { usePaginatedQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import {
  ImageSourcePicker,
  type ImageSource,
} from "@/components/ui/image-source-picker";

export const Route = createFileRoute("/admin/teams")({
  component: TeamsPage,
});

function TeamsPage() {
  const { results: teams, status, loadMore } = usePaginatedQuery(
    api.teams.listTeams,
    {},
    { initialNumItems: 50 }
  );
  const createTeam = useMutation(api.teams.createTeam);
  const updateTeam = useMutation(api.teams.updateTeam);
  const deleteTeam = useMutation(api.teams.deleteTeam);
  const generateUploadUrl = useMutation(api.teams.generateUploadUrl);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<Id<"teams"> | null>(null);
  const [teamName, setTeamName] = useState("");
  const [imageSource, setImageSource] = useState<ImageSource>({ type: "none" });
  const [currentImageUrl, setCurrentImageUrl] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isLoading = status === "LoadingFirstPage";
  const hasNoTeams = teams.length === 0 && status !== "LoadingFirstPage";

  const resetDialog = useCallback(() => {
    setTeamName("");
    setImageSource({ type: "none" });
    setCurrentImageUrl(undefined);
    setEditingTeamId(null);
    setSaveError(null);
  }, []);

  const handleAddTeam = () => {
    resetDialog();
    setIsDialogOpen(true);
  };

  const handleEditTeam = (team: (typeof teams)[number]) => {
    resetDialog();
    setEditingTeamId(team._id);
    setTeamName(team.name);
    setCurrentImageUrl(team.logoUrl ?? undefined);
    setIsDialogOpen(true);
  };

  const handleDeleteTeam = async (teamId: Id<"teams">, teamName: string) => {
    if (!confirm(`Are you sure you want to delete "${teamName}"?`)) return;

    try {
      await deleteTeam({ teamId });
      toast.success(`Team "${teamName}" deleted`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete team";
      toast.error(message);
    }
  };

  const handleRemoveLogo = () => {
    // Mark that we want to remove the current logo
    setCurrentImageUrl(undefined);
    // Also reset image source to ensure logo removal is detected
    setImageSource({ type: "none" });
  };

  const handleSaveTeam = async () => {
    if (!teamName.trim()) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      let logoStorageId: Id<"_storage"> | undefined;
      let logoUrl: string | undefined;

      // Handle image source
      if (imageSource.type === "upload") {
        // Upload file to Convex storage
        const uploadUrl = await generateUploadUrl();
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": imageSource.file.type },
          body: imageSource.file,
        });

        if (!response.ok) {
          throw new Error("Failed to upload image");
        }

        const { storageId } = await response.json();
        logoStorageId = storageId;
      } else if (imageSource.type === "url") {
        logoUrl = imageSource.url;
      }

      if (editingTeamId) {
        // Update existing team
        const updateArgs: {
          teamId: Id<"teams">;
          name?: string;
          logoUrl?: string | null;
          logoStorageId?: Id<"_storage"> | null;
        } = { teamId: editingTeamId };

        // Only update name if it changed
        const existingTeam = teams.find((t) => t._id === editingTeamId);
        if (existingTeam && teamName.trim() !== existingTeam.name) {
          updateArgs.name = teamName.trim();
        }

        // Handle logo updates
        if (logoStorageId) {
          updateArgs.logoStorageId = logoStorageId;
        } else if (logoUrl) {
          updateArgs.logoUrl = logoUrl;
        } else if (imageSource.type === "none" && !currentImageUrl) {
          // User explicitly removed the logo
          updateArgs.logoUrl = null;
          updateArgs.logoStorageId = null;
        }

        // Skip API call if nothing changed (only teamId in updateArgs)
        const hasChanges = Object.keys(updateArgs).length > 1;
        if (hasChanges) {
          await updateTeam(updateArgs);
          toast.success("Team updated");
        } else {
          toast.info("No changes to save");
        }
      } else {
        // Create new team
        await createTeam({
          name: teamName.trim(),
          logoUrl,
          logoStorageId,
        });
        toast.success("Team created");
      }

      setIsDialogOpen(false);
      resetDialog();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save team";
      setSaveError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 flex flex-col">
        <header className="border-b border-border/50 bg-card/30 backdrop-blur-sm">
          <div className="px-4 py-4 pl-16 md:px-8 md:pl-8 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">
              Registered Teams
            </h1>
            <Button onClick={handleAddTeam} size="default" className="gap-2">
              <Plus className="w-4 h-4" />
              Add Team
            </Button>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          {hasNoTeams ? (
            // Empty State
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="w-64 h-64 mb-6 rounded-lg bg-muted/30 flex items-center justify-center">
                <Users className="w-24 h-24 text-muted-foreground/50" />
              </div>
              <h2 className="text-2xl font-semibold text-foreground mb-2">
                No teams registered yet
              </h2>
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
            <div className="space-y-4">
              <Card className="border-border/50 bg-card/50 backdrop-blur-sm rounded-lg">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table className="min-w-[600px] table-fixed">
                      <TableHeader>
                        <TableRow className="border-border/50 hover:bg-transparent">
                          <TableHead className="w-[40%] h-9 text-muted-foreground text-xs font-medium uppercase tracking-wide">
                            Team
                          </TableHead>
                          <TableHead className="w-[35%] h-9 text-center text-muted-foreground text-xs font-medium uppercase tracking-wide">
                            Date Added
                          </TableHead>
                          <TableHead className="w-[25%] h-9 text-right pr-4 text-muted-foreground text-xs font-medium uppercase tracking-wide">
                            Actions
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teams.map((team) => (
                          <TableRow key={team._id} className="border-border/50">
                            <TableCell className="py-3 md:py-2">
                              <div className="flex items-center gap-3 md:gap-2">
                                <Avatar className="h-8 w-8 md:h-7 md:w-7">
                                  {team.logoUrl && (
                                    <AvatarImage
                                      src={team.logoUrl}
                                      alt={team.name}
                                    />
                                  )}
                                  <AvatarFallback className="bg-primary/20 text-primary text-[10px] md:text-xs font-semibold">
                                    {team.name.substring(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="font-medium text-foreground">
                                  {team.name}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="py-3 md:py-2 text-center text-xs md:text-sm text-muted-foreground">
                              {formatDate(team._creationTime)}
                            </TableCell>
                            <TableCell className="py-3 md:py-2">
                              <div className="flex items-center justify-end gap-1 md:gap-2">
                                <Button
                                  onClick={() => handleEditTeam(team)}
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9 md:h-8 md:w-8"
                                >
                                  <Pencil className="w-4 h-4" />
                                  <span className="sr-only">Edit {team.name}</span>
                                </Button>
                                <Button
                                  onClick={() =>
                                    handleDeleteTeam(team._id, team.name)
                                  }
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9 md:h-8 md:w-8 text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  <span className="sr-only">
                                    Delete {team.name}
                                  </span>
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Load More Button */}
              {status === "CanLoadMore" && (
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    onClick={() => loadMore(50)}
                  >
                    Load More Teams
                  </Button>
                </div>
              )}
              {status === "LoadingMore" && (
                <div className="flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Add/Edit Team Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingTeamId ? "Edit Team" : "Add Team"}
            </DialogTitle>
            <DialogDescription>
              {editingTeamId
                ? "Update the team information below."
                : "Enter the details for the new team."}
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
                disabled={isSaving}
              />
            </div>

            <ImageSourcePicker
              value={imageSource}
              onChange={setImageSource}
              currentImageUrl={currentImageUrl}
              isLoading={isSaving}
              error={saveError ?? undefined}
              allowRemove={!!editingTeamId && !!currentImageUrl}
              onRemove={handleRemoveLogo}
              label="Team Logo (Optional)"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveTeam}
              disabled={!teamName.trim() || isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Team"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
