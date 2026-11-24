import type { Metadata } from "next";
import { Wordmark } from "@/components/elite/Wordmark";
import { ParentStartForm } from "@/components/elite/ParentStartForm";
import { PARENT_ALREADY_ON, PARENT_NOT_FOUND, PARENT_WHAT, parentHeadline } from "@/lib/elite/parent-link";
import { parentPageFor } from "@/lib/elite/parent-link-server";

export const metadata: Metadata = { title: "Strive Pro", robots: { index: false } };
export const dynamic = "force-dynamic";

// The page a parent opens from the link their player sent them
// (lib/elite/parent-link.ts). It signs nobody in: it shows the player's
// first name, what their first week goes after and the price, and the
// parent agrees and pays here. No guarantee, no countdown, nothing invented.
export default async function ParentPage({ params }: { params: { code: string } }) {
  const page = await parentPageFor(params.code);

  return (
    <div className="mx-auto flex min-h-[100svh] w-full max-w-md flex-col px-6 py-10">
      <Wordmark href={null} size="lg" />
      {!page ? (
        <p className="mt-10 text-[16px] leading-relaxed text-white/75">{PARENT_NOT_FOUND}</p>
      ) : (
        <>
          <h1 className="mt-10 font-display text-[38px] font-black uppercase leading-[1.02]">{parentHeadline(page.first)}</h1>
          <p className="mt-4 text-[16px] leading-relaxed text-white/80">
            {page.areas
              ? `${page.first} took our quiz. Their first week goes after ${page.areas.replace(/^your /, "their ")}.`
              : `${page.first} wants a training week built around them.`}
          </p>
          {page.proof && <p className="mt-3 text-[16px] font-semibold leading-relaxed text-bone">{page.proof}</p>}
          <ul className="mt-6 space-y-3">
            {PARENT_WHAT.map((line) => (
              <li key={line} className="flex gap-3 text-[15px] leading-relaxed text-white/80">
                <span aria-hidden className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-bone" />
                {line}
              </li>
            ))}
          </ul>
          <p className="mt-7 font-display text-[30px] font-black uppercase leading-none">{page.price}</p>
          {page.on ? (
            <p className="mt-6 text-[15px] leading-relaxed text-white/80">{PARENT_ALREADY_ON}</p>
          ) : (
            <ParentStartForm code={params.code} first={page.first} />
          )}
        </>
      )}
    </div>
  );
}
