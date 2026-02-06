import { useState, useEffect } from "react";
import { Loader2, ImageOff } from "lucide-react";
import { fetchYandexPhotoBlob } from "@/lib/mediaProxy";

interface Props {
  publicUrl: string;
  path: string;
  alt: string;
  onClick?: () => void;
}

export function ProxiedYandexPhoto({ publicUrl, path, alt, onClick }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    fetchYandexPhotoBlob(publicUrl, path).then((url) => {
      if (cancelled) return;
      if (url) {
        setBlobUrl(url);
      } else {
        setError(true);
      }
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [publicUrl, path]);

  return (
    <button
      onClick={onClick}
      className="aspect-square rounded-lg overflow-hidden bg-secondary hover:opacity-90 transition-opacity relative group"
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <ImageOff className="w-6 h-6 text-muted-foreground" />
        </div>
      )}
      {blobUrl && (
        <>
          <img src={blobUrl} alt={alt} className="w-full h-full object-cover" loading="lazy" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
        </>
      )}
    </button>
  );
}
