import Link from "next/link";
import type { ReactNode } from "react";
import { IconBack } from "./FreeIcons";

// The bar on the free app's inner screens (profile, club, settings): a
// back arrow, the title in the middle, one control on the right.
export function FreeTopBar({
  back,
  title,
  right,
  overlay = false,
}: {
  back: string;
  title?: ReactNode;
  right?: ReactNode;
  overlay?: boolean; // over a photo: the round dark buttons of the club page
}) {
  const btn = overlay
    ? "grid h-11 w-11 place-items-center rounded-full bg-black/40 text-bone"
    : "grid h-11 w-11 place-items-center text-bone";
  return (
    <div className="mt-[26px] flex h-11 items-center justify-between px-[10px]">
      <Link href={back} aria-label="Back" className={btn}>
        <IconBack />
      </Link>
      <div className="flex min-w-0 items-center gap-1.5 text-[17px] font-bold">{title}</div>
      <div className="grid h-11 w-11 place-items-center">{right}</div>
    </div>
  );
}
