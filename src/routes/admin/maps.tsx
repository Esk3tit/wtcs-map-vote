import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Pencil,
  Power,
  PowerOff,
  Map as MapIcon,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import React, { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import {
  ImageSourcePicker,
  type ImageSource,
} from "@/components/ui/image-source-picker";

export const Route = createFileRoute("/admin/maps")({
  component: MapsPage,
});

function MapsPage() {
  const [showInactive, setShowInactive] = useState(false);
  const maps = useQuery(api.maps.listMaps, { includeInactive: showInactive });
  const createMap = useMutation(api.maps.createMap);
  const updateMap = useMutation(api.maps.updateMap);
  const deactivateMap = useMutation(api.maps.deactivateMap);
  const reactivateMap = useMutation(api.maps.reactivateMap);
  const generateUploadUrl = useMutation(api.maps.generateUploadUrl);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMapId, setEditingMapId] = useState<Id<"maps"> | null>(null);
  const [mapName, setMapName] = useState("");
  const [imageSource, setImageSource] = useState<ImageSource>({ type: "none" });
  const [currentImageUrl, setCurrentImageUrl] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Deactivate confirmation dialog state
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [mapToDeactivate, setMapToDeactivate] = useState<{
    id: Id<"maps">;
    name: string;
  } | null>(null);

  const isLoading = maps === undefined;
  const hasNoMaps = maps?.length === 0;
  const { activeMaps, inactiveMaps } = useMemo(() => {
    if (!maps) return { activeMaps: [], inactiveMaps: [] };
    return {
      activeMaps: maps.filter((m) => m.isActive),
      inactiveMaps: maps.filter((m) => !m.isActive),
    };
  }, [maps]);

  const resetDialog = useCallback(() => {
    setMapName("");
    setImageSource({ type: "none" });
    setCurrentImageUrl(undefined);
    setEditingMapId(null);
    setSaveError(null);
  }, []);

  const handleAddMap = () => {
    resetDialog();
    setIsDialogOpen(true);
  };

  const handleEditMap = (map: NonNullable<typeof maps>[number]) => {
    resetDialog();
    setEditingMapId(map._id);
    setMapName(map.name);
    setCurrentImageUrl(map.imageUrl ?? undefined);
    setIsDialogOpen(true);
  };

  const handleDeactivateClick = (mapId: Id<"maps">, mapName: string) => {
    setMapToDeactivate({ id: mapId, name: mapName });
    setDeactivateDialogOpen(true);
  };

  const handleConfirmDeactivate = async () => {
    if (!mapToDeactivate) return;

    try {
      await deactivateMap({ mapId: mapToDeactivate.id });
      toast.success(`"${mapToDeactivate.name}" deactivated`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to deactivate map";
      toast.error(message);
    } finally {
      setDeactivateDialogOpen(false);
      setMapToDeactivate(null);
    }
  };

  const handleReactivate = async (mapId: Id<"maps">, mapName: string) => {
    try {
      await reactivateMap({ mapId });
      toast.success(`"${mapName}" reactivated`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to reactivate map";
      toast.error(message);
    }
  };

  const handleSaveMap = async () => {
    if (!mapName.trim()) return;

    // Validate that we have an image source for new maps
    // (currentImageUrl is only set when editing, so we just check imageSource.type)
    if (!editingMapId && imageSource.type === "none") {
      setSaveError("An image is required for maps.");
      toast.error("An image is required for maps.");
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      let imageStorageId: Id<"_storage"> | undefined;
      let imageUrl: string | undefined;

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
        imageStorageId = storageId;
      } else if (imageSource.type === "url") {
        imageUrl = imageSource.url;
      }

      if (editingMapId) {
        // Update existing map
        const updateArgs: {
          mapId: Id<"maps">;
          name?: string;
          imageUrl?: string | null;
          imageStorageId?: Id<"_storage"> | null;
        } = { mapId: editingMapId };

        // Only update name if it changed
        const existingMap = maps?.find((m) => m._id === editingMapId);
        if (existingMap && mapName.trim() !== existingMap.name) {
          updateArgs.name = mapName.trim();
        }

        // Handle image updates
        if (imageStorageId) {
          updateArgs.imageStorageId = imageStorageId;
        } else if (imageUrl) {
          updateArgs.imageUrl = imageUrl;
        }

        // Skip API call if nothing changed (only mapId in updateArgs)
        const hasChanges = Object.keys(updateArgs).length > 1;
        if (hasChanges) {
          await updateMap(updateArgs);
          toast.success("Map updated");
        } else {
          toast.info("No changes to save");
        }
      } else {
        // Create new map
        await createMap({
          name: mapName.trim(),
          imageUrl,
          imageStorageId,
        });
        toast.success("Map created");
      }

      setIsDialogOpen(false);
      resetDialog();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save map";
      setSaveError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
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
          <div className="px-4 py-4 pl-16 md:px-8 md:pl-8 flex items-center justify-between gap-4">
            <h1 className="text-2xl font-bold text-foreground">Map Pool</h1>
            <div className="flex items-center gap-3">
              <Button
                variant={showInactive ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setShowInactive(!showInactive)}
                className="gap-2"
              >
                {showInactive ? (
                  <>
                    <Eye className="w-4 h-4" />
                    <span className="hidden sm:inline">Showing Inactive</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="w-4 h-4" />
                    <span className="hidden sm:inline">Show Inactive</span>
                  </>
                )}
              </Button>
              <Button onClick={handleAddMap} size="default" className="gap-2">
                <Plus className="w-4 h-4" />
                Add Map
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8 overflow-y-auto">
          {hasNoMaps ? (
            // Empty State
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="w-64 h-64 mb-6 rounded-lg bg-muted/30 flex items-center justify-center">
                <MapIcon className="w-24 h-24 text-muted-foreground/50" />
              </div>
              <h2 className="text-2xl font-semibold text-foreground mb-2">
                No maps in the pool yet
              </h2>
              <p className="text-muted-foreground mb-6 text-center max-w-md">
                Add maps to create a pool for voting sessions.
              </p>
              <Button onClick={handleAddMap} size="lg" className="gap-2">
                <Plus className="w-5 h-5" />
                Add Map
              </Button>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Active Maps */}
              {activeMaps.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <h2 className="text-lg font-semibold text-foreground">
                      Active Maps
                    </h2>
                    <Badge variant="secondary" className="font-mono">
                      {activeMaps.length}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {activeMaps.map((map) => (
                      <MapCard
                        key={map._id}
                        map={map}
                        onEdit={() => handleEditMap(map)}
                        onDeactivate={() =>
                          handleDeactivateClick(map._id, map.name)
                        }
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Inactive Maps */}
              {showInactive && inactiveMaps.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <h2 className="text-lg font-semibold text-muted-foreground">
                      Inactive Maps
                    </h2>
                    <Badge variant="outline" className="font-mono">
                      {inactiveMaps.length}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {inactiveMaps.map((map) => (
                      <MapCard
                        key={map._id}
                        map={map}
                        isInactive
                        onEdit={() => handleEditMap(map)}
                        onReactivate={() => handleReactivate(map._id, map.name)}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Add/Edit Map Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingMapId ? "Edit Map" : "Add Map"}</DialogTitle>
            <DialogDescription>
              {editingMapId
                ? "Update the map information below."
                : "Enter the details for the new map."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="mapName">
                Map Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="mapName"
                placeholder="e.g., Dust II, Inferno, Ancient"
                value={mapName}
                onChange={(e) => setMapName(e.target.value)}
                disabled={isSaving}
              />
            </div>

            <ImageSourcePicker
              value={imageSource}
              onChange={setImageSource}
              currentImageUrl={currentImageUrl}
              isLoading={isSaving}
              error={saveError ?? undefined}
              label={
                editingMapId
                  ? "Map Image"
                  : "Map Image (Required)"
              }
            />
            <p className="text-xs text-muted-foreground -mt-4">
              Recommended: 16:9 aspect ratio (e.g., 1920x1080)
            </p>
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
              onClick={handleSaveMap}
              disabled={!mapName.trim() || isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Map"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Confirmation Dialog */}
      <AlertDialog
        open={deactivateDialogOpen}
        onOpenChange={setDeactivateDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Map?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove "{mapToDeactivate?.name}" from the active map
              pool. It won't be available for new voting sessions, but existing
              sessions won't be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeactivate}>
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Map type derived from API - keeps props in sync with backend schema
type MapFromApi = NonNullable<
  ReturnType<typeof useQuery<typeof api.maps.listMaps>>
>[number];

// Map Card Component - Memoized to prevent unnecessary re-renders
interface MapCardProps {
  map: MapFromApi;
  isInactive?: boolean;
  onEdit: () => void;
  onDeactivate?: () => void;
  onReactivate?: () => void;
}

const MapCard = React.memo(function MapCard({
  map,
  isInactive,
  onEdit,
  onDeactivate,
  onReactivate,
}: MapCardProps) {
  return (
    <Card
      className={`overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:border-border ${
        isInactive ? "opacity-60" : ""
      }`}
    >
      {/* 16:9 aspect ratio image container */}
      <div className="aspect-video relative bg-muted/30 overflow-hidden">
        {map.imageUrl ? (
          <img
            src={map.imageUrl}
            alt={map.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <MapIcon className="w-12 h-12 text-muted-foreground/30" />
          </div>
        )}
        {isInactive && (
          <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
            <Badge
              variant="outline"
              className="bg-background/80 text-muted-foreground"
            >
              Inactive
            </Badge>
          </div>
        )}
      </div>

      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-medium text-foreground truncate flex-1">
            {map.name}
          </h3>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={onEdit}
              className="h-8 w-8"
            >
              <Pencil className="w-4 h-4" />
              <span className="sr-only">Edit {map.name}</span>
            </Button>
            {isInactive ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={onReactivate}
                className="h-8 w-8 text-chart-4 hover:text-chart-4"
              >
                <Power className="w-4 h-4" />
                <span className="sr-only">Reactivate {map.name}</span>
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={onDeactivate}
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
              >
                <PowerOff className="w-4 h-4" />
                <span className="sr-only">Deactivate {map.name}</span>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
