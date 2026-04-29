"use client";

import { useState, useCallback, useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $nodesOfType } from "lexical";
import { ImageNode } from "@ascend/editor";
import { XIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * ImageBlock: decorator renderer for ImageNode.
 *
 * Renders the image inline with rounded corners and max-width. Clicking
 * the image opens a fullscreen lightbox modal with arrow-key navigation
 * across all ImageNode instances in the document.
 *
 * Zoom levels: Fit (default), 100%, 200%. Toggleable via buttons.
 *
 * v1 limitation: presigned R2 URLs in src will expire after 5 minutes.
 * If the entry is idle-opened for longer, images may fail to load.
 */

interface ImageBlockProps {
  nodeKey: string;
  src: string;
  alt: string | null;
  caption: string | null;
}

type ZoomLevel = "fit" | "100" | "200";

export function ImageBlock({ nodeKey, src, alt, caption }: ImageBlockProps) {
  const [editor] = useLexicalComposerContext();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [allImages, setAllImages] = useState<
    Array<{ key: string; src: string; alt: string | null }>
  >([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [zoom, setZoom] = useState<ZoomLevel>("fit");

  const openLightbox = useCallback(() => {
    // Collect all ImageNodes in document order for arrow nav
    editor.getEditorState().read(() => {
      const imageNodes = $nodesOfType(ImageNode);
      const images = imageNodes.map((node) => ({
        key: node.getKey(),
        src: node.getSrc(),
        alt: node.getAlt(),
      }));
      setAllImages(images);
      const idx = images.findIndex((img) => img.key === nodeKey);
      setCurrentIndex(idx >= 0 ? idx : 0);
    });
    setZoom("fit");
    setLightboxOpen(true);
  }, [editor, nodeKey]);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
  }, []);

  const goToPrev = useCallback(() => {
    setCurrentIndex((i) => (i > 0 ? i - 1 : allImages.length - 1));
    setZoom("fit");
  }, [allImages.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((i) => (i < allImages.length - 1 ? i + 1 : 0));
    setZoom("fit");
  }, [allImages.length]);

  // Keyboard handler for lightbox
  useEffect(() => {
    if (!lightboxOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeLightbox();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goToNext();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxOpen, closeLightbox, goToPrev, goToNext]);

  const zoomClass =
    zoom === "fit"
      ? "max-w-full max-h-[85vh] object-contain"
      : zoom === "100"
        ? "w-auto h-auto"
        : "w-auto h-auto scale-200 origin-center";

  const currentImage = allImages[currentIndex];

  return (
    <>
      {/* Inline image */}
      <figure className="my-2">
        <button
          type="button"
          onClick={openLightbox}
          className="block w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
          aria-label={alt ? `View "${alt}" fullscreen` : "View image fullscreen"}
        >
          <img
            src={src}
            alt={alt ?? ""}
            className="w-full max-w-full rounded-lg object-contain"
            loading="lazy"
          />
        </button>
        {caption && (
          <figcaption className="mt-1.5 text-center text-xs text-muted-foreground">
            {caption}
          </figcaption>
        )}
      </figure>

      {/* Lightbox modal */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
          aria-label="Image lightbox"
        >
          {/* Prevent clicks on controls from closing */}
          <div
            className="relative flex flex-col items-center gap-3 p-4 max-w-full max-h-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top bar: zoom controls + close + counter */}
            <div className="flex items-center gap-2">
              {allImages.length > 1 && (
                <span className="text-sm text-white/70">
                  {currentIndex + 1} / {allImages.length}
                </span>
              )}
              <div className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-1">
                {(["fit", "100", "200"] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setZoom(level)}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                      zoom === level
                        ? "bg-white text-black"
                        : "text-white/70 hover:text-white"
                    }`}
                    aria-label={`Zoom ${level === "fit" ? "to fit" : `${level}%`}`}
                  >
                    {level === "fit" ? "Fit" : `${level}%`}
                  </button>
                ))}
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-white hover:bg-white/10"
                onClick={closeLightbox}
                aria-label="Close lightbox"
              >
                <XIcon className="size-4" />
              </Button>
            </div>

            {/* Image */}
            <div className="overflow-auto max-w-[90vw] max-h-[85vh]">
              <img
                src={currentImage?.src ?? src}
                alt={currentImage?.alt ?? alt ?? ""}
                className={`transition-transform ${zoomClass}`}
              />
            </div>

            {/* Arrow navigation */}
            {allImages.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-white hover:bg-white/10"
                  onClick={goToPrev}
                  aria-label="Previous image"
                >
                  <ChevronLeft className="size-6" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-white hover:bg-white/10"
                  onClick={goToNext}
                  aria-label="Next image"
                >
                  <ChevronRight className="size-6" />
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
