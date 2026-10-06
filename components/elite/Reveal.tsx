"use client";

import { createElement, useEffect, useRef, type CSSProperties, type ReactNode, type Ref } from "react";
import { cn } from "@/lib/utils";

// Scroll-triggered entrance. The element starts hidden (see .rv in
// globals.css) and gets data-in once it enters the viewport, which plays
// its CSS transition. `delay` staggers siblings; `variant` picks the move:
//   up    - rise + unblur (default, paragraphs and tiles)
//   build - scale up from 96% with a soft settle (cards, the offer block)
//   line  - draw a rule from left to right (gold hairlines)
// Reduced-motion users get a plain fade (handled in CSS).
export function Reveal({
  children,
  className,
  delay = 0,
  variant = "up",
  as: Tag = "div",
  once = true,
  style,
}: {
  children?: ReactNode;
  className?: string;
  delay?: number;
  variant?: "up" | "build" | "line";
  as?: "div" | "section" | "p" | "h1" | "h2" | "span";
  once?: boolean;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      el.setAttribute("data-in", "");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            el.setAttribute("data-in", "");
            if (once) io.unobserve(el);
          } else if (!once) {
            el.removeAttribute("data-in");
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once]);
  return createElement(
    Tag,
    {
      ref: ref as Ref<HTMLDivElement>,
      className: cn("rv", `rv-${variant}`, className),
      style: { ...style, transitionDelay: `${delay}ms` },
    },
    children
  );
}

// Word-by-word build for a headline: each word rises into place a few
// frames after the one before it, so the sentence assembles itself.
export function RevealWords({
  text,
  className,
  accent,
  startDelay = 0,
  step = 55,
}: {
  text: string;
  className?: string;
  // words (exact match, case-insensitive) that should render in the accent color
  accent?: string[];
  startDelay?: number;
  step?: number;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const t = window.setTimeout(() => el.setAttribute("data-in", ""), 30);
    return () => window.clearTimeout(t);
  }, []);
  const words = text.split(" ");
  const acc = new Set((accent ?? []).map((w) => w.toLowerCase()));
  return (
    <span ref={ref} className={cn("rv-words", className)}>
      {words.map((w, i) => (
        <span
          key={`${w}-${i}`}
          className={cn("rv-word", acc.has(w.toLowerCase().replace(/[^a-z']/g, "")) && "text-accent")}
          style={{ transitionDelay: `${startDelay + i * step}ms` }}
        >
          {w}
        </span>
      )).flatMap((el, i) => (i < words.length - 1 ? [el, " "] : [el]))}
    </span>
  );
}
