import { useEffect, useState } from "react";
import { useMe } from "./api/queries";
import { authHeaders } from "./api/client";

// The signed-in account's own profile photo (081) as an image source: our
// own address (the same while the photo is the same, so it is downloaded
// once and kept) with the bearer token, since the photo is private.
export function useMyPhoto(): { uri: string; headers: Record<string, string> } | null {
  const url = useMe().data?.profileSetup?.photoUrl ?? null;
  const [headers, setHeaders] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    let alive = true;
    if (url) void authHeaders().then((h) => alive && setHeaders(h));
    return () => {
      alive = false;
    };
  }, [url]);
  return url && headers ? { uri: url, headers } : null;
}
