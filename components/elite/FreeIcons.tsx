import type { ReactNode, SVGProps } from "react";

// The free app's line icons, drawn the way the approved mock draws them
// (marketing/free-log/mock/mock2.html): 24 px, a 2 px round stroke.
function Line({ children, size = 24, ...rest }: { children: ReactNode; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

type P = { size?: number; className?: string };

export const IconBack = (p: P) => <Line {...p}><path d="M15 5l-7 7 7 7" /></Line>;
export const IconChevron = (p: P) => <Line {...p}><path d="M9 5l7 7-7 7" /></Line>;
export const IconMore = (p: P) => (
  <Line {...p}>
    <circle cx="5" cy="12" r="1" fill="currentColor" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
    <circle cx="19" cy="12" r="1" fill="currentColor" />
  </Line>
);
export const IconCheck = (p: P) => <Line {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Line>;
export const IconBolt = (p: P) => <Line {...p}><path d="M13 2L4.5 13.5H11L10 22l8.5-11.5H12z" /></Line>;
export const IconFlag = (p: P) => <Line {...p}><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></Line>;
export const IconBlock = (p: P) => (
  <Line {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M6 6l12 12" />
  </Line>
);
export const IconPerson = (p: P) => (
  <Line {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c1-4 4-6 8-6s7 2 8 6" />
  </Line>
);
export const IconShare = (p: P) => <Line {...p}><path d="M4 12v7h16v-7M12 3v12M7.5 7.5L12 3l4.5 4.5" /></Line>;
export const IconGrid = (p: P) => (
  <Line {...p}>
    <rect x="4" y="4" width="16" height="16" rx="1.5" />
    <path d="M4 9.5h16M4 14.5h16M9.5 4v16M14.5 4v16" />
  </Line>
);
export const IconClock = (p: P) => (
  <Line {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Line>
);
export const IconFriends = (p: P) => (
  <Line {...p}>
    <circle cx="9" cy="9" r="3.2" />
    <path d="M3 19c.6-3.2 2.9-5 6-5s5.4 1.8 6 5" />
    <circle cx="17" cy="8" r="2.4" />
    <path d="M16.5 13.2c2.4.2 4 1.8 4.5 4.3" />
  </Line>
);
export const IconPlus = (p: P) => <Line {...p}><path d="M12 5v14M5 12h14" /></Line>;
export const IconLink = (p: P) => (
  <Line {...p}>
    <path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" />
  </Line>
);
export const IconCalendar = (p: P) => (
  <Line {...p}>
    <rect x="4" y="5" width="16" height="15" rx="2" />
    <path d="M4 10h16M9 3v4M15 3v4" />
  </Line>
);
export const IconHelp = (p: P) => (
  <Line {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1.1-1.5 2.2M12 17h.01" />
  </Line>
);
export const IconShield = (p: P) => <Line {...p}><path d="M12 3l8 3v6c0 5-3.4 8.4-8 9-4.6-.6-8-4-8-9V6z" /></Line>;
export const IconLock = (p: P) => (
  <Line {...p}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 018 0v3" />
  </Line>
);
export const IconGear = (p: P) => (
  <Line {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
  </Line>
);
export const IconCamera = (p: P) => (
  <Line {...p}>
    <path d="M4 8h3l2-2.5h6L17 8h3v11H4z" />
    <circle cx="12" cy="13" r="3.5" />
  </Line>
);
export const IconTrash = (p: P) => <Line {...p}><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" /></Line>;
export const IconExit = (p: P) => <Line {...p}><path d="M14 5h5v14h-5M10 8l-4 4 4 4M6 12h10" /></Line>;
export const IconPencil = (p: P) => <Line {...p}><path d="M4 20h4L19 9l-4-4L4 16z" /></Line>;
export const IconRanking = (p: P) => <Line {...p}><path d="M6 20V11M12 20V5M18 20v-6" /></Line>;
export const IconPin = (p: P) => (
  <Line {...p}>
    <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
    <circle cx="12" cy="10" r="2.5" />
  </Line>
);
