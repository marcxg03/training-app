import { drainQueue } from "@/lib/sync/drain";

export function setupDrainTriggers(userId: string) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleOnline = () => {
    void drainQueue(userId);
  };

  window.addEventListener("online", handleOnline);

  return () => {
    window.removeEventListener("online", handleOnline);
  };
}
