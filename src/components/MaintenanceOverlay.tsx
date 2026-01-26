import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import renowellLogo from "@/assets/renowell-logo-black.png";

function getTargetTime(): Date {
  const now = new Date();
  // MSK is UTC+3
  const mskOffset = 3 * 60; // minutes
  const localOffset = now.getTimezoneOffset(); // minutes (negative for east of UTC)
  const diffMinutes = mskOffset + localOffset;
  
  // Create target time: 13:00 MSK today
  const target = new Date(now);
  target.setHours(13, 0, 0, 0);
  // Adjust for timezone difference
  target.setMinutes(target.getMinutes() - diffMinutes);
  
  return target;
}

function formatRemainingTime(targetDate: Date): string {
  const now = new Date();
  const diff = targetDate.getTime() - now.getTime();
  
  if (diff <= 0) {
    return "00:00:00";
  }
  
  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function MaintenanceOverlay() {
  const [targetTime] = useState(() => getTargetTime());
  const [remainingTime, setRemainingTime] = useState(() => formatRemainingTime(targetTime));
  const [isExpired, setIsExpired] = useState(() => new Date() >= targetTime);

  useEffect(() => {
    if (isExpired) return;

    const timerId = setInterval(() => {
      const now = new Date();
      if (now >= targetTime) {
        setIsExpired(true);
        setRemainingTime("00:00:00");
        clearInterval(timerId);
        // Reload page when timer expires
        window.location.reload();
      } else {
        setRemainingTime(formatRemainingTime(targetTime));
      }
    }, 1000);

    return () => clearInterval(timerId);
  }, [targetTime, isExpired]);

  // Don't show overlay if time has passed
  if (isExpired) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background">
      <div className="text-center space-y-8 p-8">
        {/* Logo */}
        <div className="flex justify-center">
          <img 
            src={renowellLogo} 
            alt="Renowell" 
            className="h-16 w-auto dark:invert"
          />
        </div>

        {/* Spinner */}
        <div className="flex justify-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Портал обновляется
          </h1>
          <p className="text-muted-foreground">
            Пожалуйста, подождите. Мы скоро вернёмся!
          </p>
        </div>

        {/* Countdown */}
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Осталось примерно:</p>
          <div className="text-4xl md:text-5xl font-mono font-bold text-primary tracking-wider">
            {remainingTime}
          </div>
        </div>
      </div>
    </div>
  );
}
