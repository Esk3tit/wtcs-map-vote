import { useState, useRef, useCallback, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, Link as LinkIcon, X, Loader2, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  validateImageFile,
  isValidUrl,
  formatFileSize,
  MAX_FILE_SIZE_MB,
  type ImageValidationResult,
} from "@/lib/image-validation";

export type ImageSourceType = "upload" | "url" | "none";

export type ImageSource =
  | { type: "upload"; file: File; previewUrl: string }
  | { type: "url"; url: string }
  | { type: "none" };

interface ImageSourcePickerProps {
  /**
   * Current image source state
   */
  value: ImageSource;
  /**
   * Callback when image source changes
   */
  onChange: (source: ImageSource) => void;
  /**
   * Currently saved/displayed image URL (for preview)
   */
  currentImageUrl?: string;
  /**
   * Whether the picker is in a loading state
   */
  isLoading?: boolean;
  /**
   * Error message to display
   */
  error?: string;
  /**
   * Optional class name for the container
   */
  className?: string;
  /**
   * Whether to allow removing the current image
   */
  allowRemove?: boolean;
  /**
   * Callback when remove is clicked
   */
  onRemove?: () => void;
  /**
   * Label text for the image picker
   * @default "Image (Optional)"
   */
  label?: string;
}

export function ImageSourcePicker({
  value,
  onChange,
  currentImageUrl,
  isLoading = false,
  error,
  className,
  allowRemove = false,
  onRemove,
  label = "Image (Optional)",
}: ImageSourcePickerProps) {
  const [urlInput, setUrlInput] = useState(
    value.type === "url" ? value.url : ""
  );
  const [urlError, setUrlError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  // Track which URL caused the error - imageLoadError is derived from this
  const [errorForUrl, setErrorForUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Track blob URL for cleanup on unmount (avoids stale closure issue)
  const blobUrlRef = useRef<string | null>(null);

  // Determine current tab based on value
  const currentTab: ImageSourceType =
    value.type === "upload" ? "upload" : value.type === "url" ? "url" : "upload";

  // Get preview URL to display
  const previewUrl =
    value.type === "upload"
      ? value.previewUrl
      : value.type === "url"
        ? value.url
        : currentImageUrl;

  // Derive imageLoadError from errorForUrl - automatically resets when previewUrl changes
  const imageLoadError = errorForUrl !== null && errorForUrl === previewUrl;

  // Track previous value for controlled component sync (React pattern: update state during render)
  const [prevValue, setPrevValue] = useState(value);
  if (prevValue !== value) {
    setPrevValue(value);
    setErrorForUrl(null); // Clear error state to allow retry of same URL
    if (value.type === "url") {
      setUrlInput(value.url);
    } else if (value.type === "none") {
      setUrlInput("");
    }
  }

  const handleFileSelect = useCallback(
    (file: File) => {
      setLocalError(null);

      // Validate BEFORE revoking old URL to preserve preview on validation failure
      const validation: ImageValidationResult = validateImageFile(file);
      if (!validation.valid) {
        setLocalError(validation.error.message);
        return;
      }

      // Revoke previous blob URL to prevent memory leak (only after validation passes)
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }

      // Create preview URL and track in ref for cleanup
      const previewUrl = URL.createObjectURL(file);
      blobUrlRef.current = previewUrl;
      onChange({ type: "upload", file, previewUrl });
    },
    [onChange]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleUrlSubmit = () => {
    const trimmedUrl = urlInput.trim();
    if (!trimmedUrl) {
      onChange({ type: "none" });
      setUrlError(null);
      return;
    }

    if (!isValidUrl(trimmedUrl)) {
      setUrlError("Please enter a valid HTTP or HTTPS URL");
      return;
    }

    setUrlError(null);
    onChange({ type: "url", url: trimmedUrl });
  };

  const handleUrlInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrlInput(e.target.value);
    setUrlError(null);
  };

  const handleClear = () => {
    // Revoke blob URL to prevent memory leak
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    setUrlInput("");
    setUrlError(null);
    setLocalError(null);
    setErrorForUrl(null); // Clear error state to allow retry of same URL
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onChange({ type: "none" });
  };

  // Cleanup blob URL on unmount using ref to avoid stale closure
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  const handleRemove = () => {
    handleClear();
    onRemove?.();
  };

  const displayError = error || localError || urlError;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {allowRemove && currentImageUrl && value.type === "none" && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            className="h-auto py-1 px-2 text-xs text-destructive hover:text-destructive"
          >
            <X className="w-3 h-3 mr-1" />
            Remove
          </Button>
        )}
      </div>

      {/* Preview Section */}
      {previewUrl && (
        <div className="relative rounded-lg border border-border/50 p-4 bg-muted/20">
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
              {!imageLoadError && (
                <img
                  src={previewUrl}
                  alt="Logo preview"
                  className="w-full h-full object-cover"
                  onError={() => setErrorForUrl(previewUrl ?? null)}
                />
              )}
              {imageLoadError && (
                <ImageIcon className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {value.type === "upload"
                  ? value.file.name
                  : value.type === "url"
                    ? "External URL"
                    : "Current Logo"}
              </p>
              <p className="text-xs text-muted-foreground">
                {value.type === "upload" && formatFileSize(value.file.size)}
                {value.type === "url" && (
                  <span className="truncate block">{value.url}</span>
                )}
                {value.type === "none" && currentImageUrl && "Saved"}
              </p>
            </div>
{/* Only show clear button for active selections (upload/url), not saved images */}
            {value.type !== "none" && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleClear}
                className="h-8 w-8 shrink-0"
                disabled={isLoading}
              >
                <X className="w-4 h-4" />
                <span className="sr-only">Clear selection</span>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Tabs for Upload/URL selection - only show if no preview */}
      {!previewUrl && (
        <Tabs defaultValue={currentTab} className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="upload" className="flex-1 gap-2">
              <Upload className="w-4 h-4" />
              Upload
            </TabsTrigger>
            <TabsTrigger value="url" className="flex-1 gap-2">
              <LinkIcon className="w-4 h-4" />
              URL
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileInputChange}
              className="hidden"
              disabled={isLoading}
            />
            <div
              role="button"
              tabIndex={isLoading ? -1 : 0}
              aria-label="Upload image. Drop file here or press Enter to browse."
              aria-disabled={isLoading}
              onClick={() => !isLoading && fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (!isLoading && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                "border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center gap-3 transition-colors cursor-pointer bg-muted/20 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-border/50 hover:border-primary/50",
                isLoading && "opacity-50 cursor-not-allowed"
              )}
            >
              {isLoading ? (
                <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
              ) : (
                <Upload className="w-8 h-8 text-muted-foreground" />
              )}
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  {isLoading
                    ? "Uploading..."
                    : "Drop logo here or click to browse"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG, WebP up to {MAX_FILE_SIZE_MB}MB
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="url" className="mt-3 space-y-3">
            <div className="flex gap-2">
              <Input
                type="url"
                placeholder="https://example.com/logo.png"
                value={urlInput}
                onChange={handleUrlInputChange}
                onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
                disabled={isLoading}
                className={cn(urlError && "border-destructive")}
              />
              <Button
                type="button"
                onClick={handleUrlSubmit}
                disabled={isLoading || !urlInput.trim()}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Use URL"
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Enter the URL of an image hosted externally.
            </p>
          </TabsContent>
        </Tabs>
      )}

      {/* Error Display */}
      {displayError && (
        <p className="text-sm text-destructive">{displayError}</p>
      )}
    </div>
  );
}
