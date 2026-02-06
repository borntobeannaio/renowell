import { useProxiedAvatarUrl } from "@/lib/avatarProxy";
import { User } from "lucide-react";

interface ProxiedAvatarProps {
  url: string | null;
  alt: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "w-12 h-12",
  md: "w-20 h-20",
  lg: "w-24 h-24",
};

const iconSizes = {
  sm: "w-6 h-6",
  md: "w-10 h-10",
  lg: "w-12 h-12",
};

export function ProxiedAvatar({ url, alt, size = "sm" }: ProxiedAvatarProps) {
  const proxiedUrl = useProxiedAvatarUrl(url);

  if (proxiedUrl) {
    return (
      <img
        src={proxiedUrl}
        alt={alt}
        className={`${sizeClasses[size]} rounded-full bg-secondary object-cover`}
      />
    );
  }

  return (
    <div className={`${sizeClasses[size]} rounded-full bg-primary/10 flex items-center justify-center`}>
      <User className={`${iconSizes[size]} text-primary`} />
    </div>
  );
}
