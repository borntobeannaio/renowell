import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Folder, ArrowLeft, Image, Loader2 } from "lucide-react";
import { Lightbox } from "@/components/ui/Lightbox";

interface PhotoFolder {
  id: string;
  name: string;
  yandexDiskUrl: string;
  coverEmoji?: string;
}

interface YandexPhoto {
  id: string;
  url: string;
  preview: string;
  title: string;
}

// Predefined folders with Yandex Disk links
const PHOTO_FOLDERS: PhotoFolder[] = [
  {
    id: "offices",
    name: "Офисы",
    yandexDiskUrl: "https://disk.yandex.ru/d/J5HJ3LK1aiIfaw",
    coverEmoji: "🏢",
  },
  {
    id: "retail",
    name: "Ритейл",
    yandexDiskUrl: "https://disk.yandex.ru/d/DsLl1jkAP14YAA",
    coverEmoji: "🛒",
  },
  {
    id: "new-year-2025",
    name: "Новогодний корпоратив 2025",
    yandexDiskUrl: "https://disk.yandex.ru/d/hMMBFOj0q-IY_Q",
    coverEmoji: "🎄",
  },
  {
    id: "kids-new-year-2025",
    name: "Детский новогодний корпоратив 2025",
    yandexDiskUrl: "https://disk.yandex.ru/d/iw9uX0yjbAeoCA",
    coverEmoji: "🎅",
  },
];

// Extract public key from Yandex Disk URL
function extractPublicKey(url: string): string {
  // URL format: https://disk.yandex.ru/d/XXXXX
  const match = url.match(/\/d\/([^/?]+)/);
  return match ? match[1] : url;
}

// Fetch photos from Yandex Disk public folder
async function fetchYandexPhotos(publicUrl: string): Promise<YandexPhoto[]> {
  const publicKey = extractPublicKey(publicUrl);
  
  // Use Yandex Disk API to get public folder contents
  const apiUrl = `https://cloud-api.yandex.net/v1/disk/public/resources?public_key=${encodeURIComponent(publicUrl)}&limit=100`;
  
  try {
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`Yandex API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Filter only image files
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    const items = data._embedded?.items || [];
    
    const photos: YandexPhoto[] = items
      .filter((item: any) => {
        if (item.type !== 'file') return false;
        const name = item.name.toLowerCase();
        return imageExtensions.some(ext => name.endsWith(ext));
      })
      .map((item: any) => ({
        id: item.resource_id || item.name,
        url: item.file || item.preview?.replace('size=S', 'size=XXXL') || '',
        preview: item.preview || '',
        title: item.name,
      }));
    
    return photos;
  } catch (error) {
    console.error('Error fetching Yandex photos:', error);
    throw error;
  }
}

export function PhotoGallery() {
  const [selectedFolder, setSelectedFolder] = useState<PhotoFolder | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const { data: photos = [], isLoading, error } = useQuery({
    queryKey: ['yandex-photos', selectedFolder?.id],
    queryFn: () => fetchYandexPhotos(selectedFolder!.yandexDiskUrl),
    enabled: !!selectedFolder,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Folder view
  if (!selectedFolder) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {PHOTO_FOLDERS.map((folder) => (
          <button
            key={folder.id}
            onClick={() => setSelectedFolder(folder)}
            className="card-base p-6 flex flex-col items-center gap-3 hover:border-primary/30 hover:bg-accent/50 transition-all"
          >
            <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center text-3xl">
              {folder.coverEmoji || <Folder className="w-8 h-8 text-primary" />}
            </div>
            <span className="font-medium text-foreground text-center text-sm">
              {folder.name}
            </span>
          </button>
        ))}
      </div>
    );
  }

  // Photos view inside folder
  return (
    <div className="space-y-4">
      {/* Header with back button */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSelectedFolder(null)}
          className="p-2 rounded-lg hover:bg-accent transition-colors"
          title="Назад к папкам"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{selectedFolder.coverEmoji}</span>
          <h3 className="font-semibold text-lg">{selectedFolder.name}</h3>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Загрузка фотографий...</p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="text-center py-12">
          <p className="text-destructive mb-2">Не удалось загрузить фотографии</p>
          <a
            href={selectedFolder.yandexDiskUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline text-sm"
          >
            Открыть на Яндекс.Диске →
          </a>
        </div>
      )}

      {/* Photos grid */}
      {!isLoading && !error && photos.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {photos.map((photo, index) => (
            <button
              key={photo.id}
              onClick={() => setLightboxIndex(index)}
              className="aspect-square rounded-lg overflow-hidden bg-secondary hover:opacity-90 transition-opacity relative group"
            >
              <img
                src={photo.preview || photo.url}
                alt={photo.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
            </button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && photos.length === 0 && (
        <div className="text-center py-12">
          <Image className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Нет фотографий в этой папке</p>
          <a
            href={selectedFolder.yandexDiskUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline text-sm mt-2 inline-block"
          >
            Открыть на Яндекс.Диске →
          </a>
        </div>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && photos.length > 0 && (
        <Lightbox
          photos={photos.map(p => ({ id: p.id, url: p.url, title: p.title }))}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex((i) => Math.max(0, (i || 0) - 1))}
          onNext={() =>
            setLightboxIndex((i) => Math.min(photos.length - 1, (i || 0) + 1))
          }
        />
      )}
    </div>
  );
}
