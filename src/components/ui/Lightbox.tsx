import { useEffect } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Photo } from "@/types";

interface LightboxProps {
  photos: Photo[];
  currentIndex: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export function Lightbox({ photos, currentIndex, onClose, onPrev, onNext }: LightboxProps) {
  const currentPhoto = photos[currentIndex];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose, onPrev, onNext]);

  return (
    <div className="lightbox-overlay animate-fade-in" onClick={onClose}>
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-card/20 text-card hover:bg-card/40 transition-colors"
        aria-label="Закрыть"
      >
        <X className="w-6 h-6" />
      </button>

      {currentIndex > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-card/20 text-card hover:bg-card/40 transition-colors"
          aria-label="Предыдущее фото"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
      )}

      {currentIndex < photos.length - 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-card/20 text-card hover:bg-card/40 transition-colors"
          aria-label="Следующее фото"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      )}

      <div className="max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <img
          src={currentPhoto.url}
          alt={currentPhoto.title || "Фото"}
          className="max-w-full max-h-[85vh] object-contain rounded-lg"
        />
        {currentPhoto.title && (
          <p className="text-center text-card mt-4 text-lg">{currentPhoto.title}</p>
        )}
        <p className="text-center text-card/70 mt-2 text-sm">
          {currentIndex + 1} / {photos.length}
        </p>
      </div>
    </div>
  );
}
