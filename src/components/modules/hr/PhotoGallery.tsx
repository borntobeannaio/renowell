import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Folder, ArrowLeft, Image, Loader2 } from "lucide-react";
import { Lightbox } from "@/components/ui/Lightbox";
import { proxyEdgeFunction, fetchYandexPhotoBlob } from "@/lib/mediaProxy";
import { ProxiedYandexPhoto } from "./ProxiedYandexPhoto";

interface PhotoFolder {
  id: string;
  name: string;
  yandexDiskUrl: string;
  coverEmoji?: string;
}

interface YandexPhoto {
  id: string;
  name: string;
  path: string;
  mimeType?: string;
  size?: number;
  previewUrl?: string | null;
}

interface YandexFolder {
  id: string;
  name: string;
  path: string;
}

interface FetchResult {
  photos: YandexPhoto[];
  folders: YandexFolder[];
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

// Fetch photos and folders from Yandex Disk via proxy
async function fetchYandexContents(publicUrl: string, subPath?: string): Promise<FetchResult> {
  const result = await proxyEdgeFunction<{ photos: YandexPhoto[]; folders: YandexFolder[] }>(
    "yandex-disk-proxy",
    { action: "list", publicUrl, path: subPath }
  );

  return {
    photos: result?.photos || [],
    folders: result?.folders || [],
  };
}

export function PhotoGallery() {
  const [selectedFolder, setSelectedFolder] = useState<PhotoFolder | null>(null);
  const [subPath, setSubPath] = useState<string | undefined>(undefined);
  const [pathHistory, setPathHistory] = useState<{ path?: string; name: string }[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxUrls, setLightboxUrls] = useState<Map<string, string>>(new Map());

  const { data, isLoading, error } = useQuery({
    queryKey: ['yandex-contents', selectedFolder?.id, subPath],
    queryFn: () => fetchYandexContents(selectedFolder!.yandexDiskUrl, subPath),
    enabled: !!selectedFolder,
    staleTime: 5 * 60 * 1000,
  });

  const photos = data?.photos || [];
  const folders = data?.folders || [];

  // Navigate into subfolder
  const navigateToSubfolder = (folder: YandexFolder) => {
    setPathHistory(prev => [...prev, { path: subPath, name: selectedFolder?.name || '' }]);
    setSubPath(folder.path);
  };

  // Go back to parent folder
  const goBack = () => {
    if (pathHistory.length > 0) {
      const previous = pathHistory[pathHistory.length - 1];
      setPathHistory(prev => prev.slice(0, -1));
      setSubPath(previous.path);
    } else {
      setSelectedFolder(null);
      setSubPath(undefined);
    }
  };

  // Root folder view
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

  // Build display list from photos (use path for proxied loading)
  const displayPhotos = photos.map(photo => ({
    id: photo.id,
    title: photo.name,
    path: photo.path,
  }));

  const currentFolderName = subPath 
    ? subPath.split('/').filter(Boolean).pop() || selectedFolder.name
    : selectedFolder.name;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={goBack}
          className="p-2 rounded-lg hover:bg-accent transition-colors"
          title="Назад"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{selectedFolder.coverEmoji}</span>
          <h3 className="font-semibold text-lg">{currentFolderName}</h3>
        </div>
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Загрузка...</p>
        </div>
      )}

      {error && (
        <div className="text-center py-12">
          <p className="text-destructive mb-2">Не удалось загрузить содержимое</p>
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

      {!isLoading && !error && folders.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {folders.map((folder) => (
            <button
              key={folder.id}
              onClick={() => navigateToSubfolder(folder)}
              className="card-base p-4 flex flex-col items-center gap-2 hover:border-primary/30 hover:bg-accent/50 transition-all"
            >
              <Folder className="w-10 h-10 text-primary" />
              <span className="text-sm text-foreground text-center line-clamp-2">
                {folder.name}
              </span>
            </button>
          ))}
        </div>
      )}

      {!isLoading && !error && displayPhotos.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {displayPhotos.map((photo, index) => (
            <ProxiedYandexPhoto
              key={photo.id}
              publicUrl={selectedFolder.yandexDiskUrl}
              path={photo.path}
              alt={photo.title}
              onClick={() => {
                // Fetch blob for lightbox if not cached
                const cached = lightboxUrls.get(photo.path);
                if (cached) {
                  setLightboxIndex(index);
                } else {
                  fetchYandexPhotoBlob(selectedFolder.yandexDiskUrl, photo.path).then(url => {
                    if (url) {
                      setLightboxUrls(prev => new Map(prev).set(photo.path, url));
                    }
                    setLightboxIndex(index);
                  });
                }
              }}
            />
          ))}
        </div>
      )}

      {!isLoading && !error && displayPhotos.length === 0 && folders.length === 0 && (
        <div className="text-center py-12">
          <Image className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Папка пуста</p>
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

      {lightboxIndex !== null && displayPhotos.length > 0 && (
        <Lightbox
          photos={displayPhotos.map(p => ({ 
            id: p.id, 
            url: lightboxUrls.get(p.path) || "", 
            title: p.title 
          }))}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex((i) => Math.max(0, (i || 0) - 1))}
          onNext={() =>
            setLightboxIndex((i) => Math.min(displayPhotos.length - 1, (i || 0) + 1))
          }
        />
      )}
    </div>
  );
}
