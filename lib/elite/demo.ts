import type {
  Achievement,
  Checkin,
  CoachNote,
  FilmUpload,
  Game,
  Homework,
  Message,
  ParentReport,
  Player,
  Progress,
  ProgressMetric,
  WeeklyPlan,
} from "./types";

// ---------------------------------------------------------------------------
// Strive Elite demo data.
//
// Powers the app in demo mode (no Supabase configured) and mirrors what the
// SQL seed inserts in production. Five realistic players, each with goals,
// homework, progress, film, notes, messages, weekly plans, parent reports,
// achievements, and statistics.
// ---------------------------------------------------------------------------

export const DEMO_COACH = {
  id: "coach-ramella",
  full_name: "Coach Yinka",
  email: "coach@strivesoccerfc.com",
  role: "coach" as const,
  avatar_color: "#F5C518",
};

const now = new Date(); // demo dates stay fresh relative to today
function daysFromNow(d: number): string {
  const t = new Date(now);
  t.setDate(t.getDate() + d);
  return t.toISOString();
}

export const DEMO_PLAYERS: Player[] = [
  {
    id: "p-marcus",
    profile_id: "u-marcus",
    coach_id: DEMO_COACH.id,
    full_name: "Marcus Bello",
    avatar_color: "#F5C518",
    age: 13,
    position: "Attacking Midfield",
    level: "Advanced",
    current_week: 7,
    today_focus: "Scan before you receive — two looks minimum",
    goals: [
      "Make the regional development squad by spring",
      "Two-footed under pressure",
      "Play a full game without losing composure",
    ],
    strengths: ["Close control", "Vision", "Work rate"],
    weaknesses: ["Weak foot finishing", "Slows down under a press", "Heading"],
    parent_name: "Adeola Bello",
    parent_email: "adeola@example.com",
    next_session_at: daysFromNow(2),
    last_session_at: daysFromNow(-3),
    joined_at: "2026-04-11",
    subscription_status: "active",
    club: "Riverside United U14",
    dominant_foot: "Right",
    coach_memory:
      "Responds to challenges, not repetition. Left-foot weakness is mental, not technical — keeps skipping weak-foot reps. Tight hamstrings; keep the plyos controlled. Loves a target to beat.",
    onboarded_at: "2026-04-11T00:00:00.000Z",
  },
  {
    id: "p-sofia",
    profile_id: "u-sofia",
    coach_id: DEMO_COACH.id,
    full_name: "Sofia Marín",
    avatar_color: "#7CC7FF",
    age: 12,
    position: "Winger",
    level: "Competitive",
    current_week: 5,
    today_focus: "First touch out of your feet, into space",
    goals: [
      "Beat a defender 1v1 with confidence",
      "Sharper first touch at speed",
      "Score with both feet",
    ],
    strengths: ["Acceleration", "Fearless 1v1", "Left foot"],
    weaknesses: ["First touch under pressure", "Decision making in the final third", "Right foot"],
    parent_name: "Elena Marín",
    parent_email: "elena@example.com",
    next_session_at: daysFromNow(1),
    last_session_at: daysFromNow(-4),
    joined_at: "2026-05-02",
    subscription_status: "active",
  },
  {
    id: "p-diego",
    profile_id: "u-diego",
    coach_id: DEMO_COACH.id,
    full_name: "Diego Santos",
    avatar_color: "#FF9F7C",
    age: 15,
    position: "Centre Back",
    level: "Elite",
    current_week: 11,
    today_focus: "Body shape when defending the half-turn",
    goals: [
      "Sign with an academy by end of year",
      "Command the back line vocally",
      "Cleaner progressive passing",
    ],
    strengths: ["Aerial dominance", "Positioning", "Composure"],
    weaknesses: ["Turning speed", "Passing range under pressure", "Recovery pace"],
    parent_name: "Marisol Santos",
    parent_email: "marisol@example.com",
    next_session_at: daysFromNow(3),
    last_session_at: daysFromNow(-2),
    joined_at: "2026-02-18",
    subscription_status: "active",
  },
  {
    id: "p-aisha",
    profile_id: "u-aisha",
    coach_id: DEMO_COACH.id,
    full_name: "Aisha Kone",
    avatar_color: "#C9A7FF",
    age: 11,
    position: "Striker",
    level: "Developing",
    current_week: 3,
    today_focus: "Finish first-time — don't take the extra touch",
    goals: [
      "Learn to shoot with laces cleanly",
      "Stop drifting out of the game",
      "Build confidence on the ball",
    ],
    strengths: ["Movement in the box", "Bravery", "Speed"],
    weaknesses: ["Shooting technique", "Confidence", "Ball mastery"],
    parent_name: "Fatou Kone",
    parent_email: "fatou@example.com",
    next_session_at: daysFromNow(4),
    last_session_at: daysFromNow(-5),
    joined_at: "2026-06-20",
    subscription_status: "trialing",
  },
  {
    id: "p-liam",
    profile_id: "u-liam",
    coach_id: DEMO_COACH.id,
    full_name: "Liam O'Connor",
    avatar_color: "#8FE3B0",
    age: 14,
    position: "Full Back",
    level: "Competitive",
    current_week: 6,
    today_focus: "Overlap timing — arrive as the ball is played",
    goals: [
      "Become a threat going forward",
      "Sharper 1v1 defending",
      "Deliver a consistent cross",
    ],
    strengths: ["Stamina", "1v1 defending", "Attitude"],
    weaknesses: ["Crossing", "Weak foot", "Attacking decisions"],
    parent_name: "Sean O'Connor",
    parent_email: "sean@example.com",
    next_session_at: daysFromNow(2),
    last_session_at: daysFromNow(-6),
    joined_at: "2026-04-29",
    subscription_status: "active",
  },
];

const progressFor = (
  playerId: string,
  values: Record<ProgressMetric, [number, number]>
): Progress[] =>
  (Object.keys(values) as ProgressMetric[]).map((metric, i) => ({
    id: `${playerId}-prog-${i}`,
    player_id: playerId,
    metric,
    value: values[metric][0],
    prev_value: values[metric][1],
    updated_at: daysFromNow(-3),
  }));

export const DEMO_PROGRESS: Progress[] = [
  ...progressFor("p-marcus", {
    "Ball Mastery": [82, 74],
    "Weak Foot": [54, 48],
    Passing: [78, 72],
    Scanning: [71, 58],
    "Decision Making": [69, 61],
    Confidence: [80, 70],
    Speed: [73, 70],
  }),
  ...progressFor("p-sofia", {
    "Ball Mastery": [68, 60],
    "Weak Foot": [45, 40],
    Passing: [62, 58],
    Scanning: [55, 47],
    "Decision Making": [58, 50],
    Confidence: [74, 66],
    Speed: [86, 82],
  }),
  ...progressFor("p-diego", {
    "Ball Mastery": [79, 76],
    "Weak Foot": [70, 64],
    Passing: [84, 77],
    Scanning: [88, 80],
    "Decision Making": [86, 79],
    Confidence: [90, 85],
    Speed: [66, 63],
  }),
  ...progressFor("p-aisha", {
    "Ball Mastery": [42, 34],
    "Weak Foot": [30, 26],
    Passing: [48, 44],
    Scanning: [40, 33],
    "Decision Making": [44, 38],
    Confidence: [52, 40],
    Speed: [80, 78],
  }),
  ...progressFor("p-liam", {
    "Ball Mastery": [64, 60],
    "Weak Foot": [50, 43],
    Passing: [70, 65],
    Scanning: [67, 60],
    "Decision Making": [63, 57],
    Confidence: [72, 68],
    Speed: [77, 74],
  }),
];

const hw = (
  playerId: string,
  week: number,
  items: Array<
    Partial<Homework> & { title: string; exercise: string; reps: string }
  >
): Homework[] =>
  items.map((it, i) => ({
    id: `${playerId}-hw-${week}-${i}`,
    player_id: playerId,
    week,
    session: it.session ?? 1,
    title: it.title,
    exercise: it.exercise,
    reps: it.reps,
    duration_min: it.duration_min ?? 15,
    video_url: it.video_url ?? null,
    notes: it.notes ?? null,
    completed: it.completed ?? false,
    completed_at: it.completed ? daysFromNow(-1) : null,
    sort: i,
  }));

// A room plyometric warm-up to open each demo session.
const plyo = (variant: number) =>
  [
    {
      title: "Plyo warm-up — Pogo & Tuck",
      exercise:
        "Pogo hops x20, tuck jumps x10, split-squat jumps x8 each leg. Land soft, explode up.",
      reps: "3 rounds",
      duration_min: 10,
    },
    {
      title: "Plyo warm-up — Lateral Power",
      exercise:
        "Lateral bounds x10 each side, skater hops x12 each side, squat jumps x12.",
      reps: "3 rounds",
      duration_min: 10,
    },
    {
      title: "Plyo warm-up — Quick Feet",
      exercise:
        "Ankle pogos x30, broad-jump-to-stick x6, single-leg hops x8 each leg.",
      reps: "3 rounds",
      duration_min: 10,
    },
    {
      title: "Plyo warm-up — Explosive",
      exercise:
        "Tuck jumps x10, split jumps x10 each leg, step-down-to-jump x6.",
      reps: "3 rounds",
      duration_min: 10,
    },
  ][variant - 1];

export const DEMO_HOMEWORK: Homework[] = [
  ...hw("p-marcus", 7, [
    // Session 1 (done)
    { ...plyo(1), session: 1, completed: true },
    {
      title: "Wall pass mastery",
      exercise: "Two-touch wall passes, alternating feet, scan between reps",
      reps: "200 total",
      duration_min: 15,
      session: 1,
      completed: true,
    },
    // Session 2 (done)
    { ...plyo(2), session: 2, completed: true },
    {
      title: "Scanning under pressure",
      exercise: "Shadow rondo — two shoulder checks before every touch",
      reps: "3 x 5 min",
      duration_min: 45,
      session: 2,
      completed: true,
    },
    // Session 3 (in progress — Next up lands here)
    { ...plyo(3), session: 3 },
    {
      title: "Weak-foot finishing",
      exercise: "Left-foot finishes from the edge of the box, laces through",
      reps: "50 strikes",
      duration_min: 15,
      session: 3,
      notes: "Plant foot pointed at target.",
    },
    // Session 4
    { ...plyo(4), session: 4 },
    {
      title: "Study & apply",
      exercise: "Study Rodri's body shape before receiving, then 50 wall passes copying it.",
      reps: "1 clip + 50 reps",
      duration_min: 15,
      session: 4,
      video_url: "https://www.youtube.com/results?search_query=rodri+scanning",
    },
  ]),
  ...hw("p-sofia", 5, [
    {
      title: "First touch into space",
      exercise: "Receive from a wall, first touch across your body into a gate",
      reps: "120 touches",
      completed: true,
    },
    {
      title: "1v1 acceleration",
      exercise: "Cone 1v1 — explode past on the second touch",
      reps: "4 x 8 reps",
    },
    {
      title: "Right-foot reps",
      exercise: "Weak-foot toe-taps and push-pulls",
      reps: "5 min daily",
    },
  ]),
  ...hw("p-diego", 11, [
    {
      title: "Defensive body shape",
      exercise: "Half-turn defending — open hips, show them the line",
      reps: "3 x 6 min",
      completed: true,
    },
    {
      title: "Progressive passing",
      exercise: "Long diagonal switches to a target, both feet",
      reps: "60 passes",
      completed: true,
    },
    {
      title: "Turning speed",
      exercise: "180° turn drills off a trigger",
      reps: "4 x 10",
    },
  ]),
  ...hw("p-aisha", 3, [
    {
      title: "Laces finishing",
      exercise: "Strike a stationary ball with laces into an open net",
      reps: "40 strikes",
    },
    {
      title: "Ball mastery base",
      exercise: "Toe taps, foundations, sole rolls",
      reps: "5 min daily",
      completed: true,
    },
    {
      title: "Confidence reps",
      exercise: "Take a player on in the yard, no fear, film one",
      reps: "10 attempts",
    },
  ]),
  ...hw("p-liam", 6, [
    {
      title: "Crossing repetition",
      exercise: "Whipped crosses to the penalty spot from the byline",
      reps: "50 crosses",
      completed: true,
    },
    {
      title: "Overlap timing",
      exercise: "Shadow overlaps — arrive as the ball is released",
      reps: "3 x 8 reps",
    },
    {
      title: "Weak-foot passing",
      exercise: "Left-foot driven passes over 20 yards",
      reps: "60 passes",
    },
  ]),
];

export const DEMO_FILM: FilmUpload[] = [
  {
    id: "f-marcus-1",
    player_id: "p-marcus",
    month: 2,
    title: "League game vs. Riverside — full half",
    url: null,
    thumbnail: null,
    coach_notes:
      "Great composure in the first 20. Watch 12:30 — you had a runner in behind and didn't scan. Two looks earlier and that's an assist.",
    status: "Reviewed",
    created_at: daysFromNow(-4),
  },
  {
    id: "f-marcus-2",
    player_id: "p-marcus",
    month: 1,
    title: "Weak-foot finishing session",
    url: null,
    thumbnail: null,
    coach_notes: null,
    status: "Uploaded",
    created_at: daysFromNow(-1),
  },
  {
    id: "f-sofia-1",
    player_id: "p-sofia",
    title: "1v1 clips — training",
    url: null,
    thumbnail: null,
    coach_notes:
      "Your acceleration is elite. First touch on 3 of 6 was heavy — push it further into space and you're gone.",
    status: "Reviewed",
    created_at: daysFromNow(-5),
  },
  {
    id: "f-diego-1",
    player_id: "p-diego",
    title: "Academy trial — full game",
    url: null,
    thumbnail: null,
    coach_notes:
      "Dominant in the air. One turn at 38:00 you got caught — trust the early body shape.",
    status: "Analyzing",
    created_at: daysFromNow(-2),
  },
];

export const DEMO_NOTES: CoachNote[] = [
  {
    id: "n-marcus-1",
    player_id: "p-marcus",
    body: "Marcus is turning a corner mentally. Scanning is becoming automatic. Next block: weak-foot finishing under fatigue.",
    created_at: daysFromNow(-3),
  },
  {
    id: "n-sofia-1",
    player_id: "p-sofia",
    body: "Fearless in 1v1. If we sharpen the first touch she's a real problem for defenders. Confidence is high — keep feeding it.",
    created_at: daysFromNow(-4),
  },
];

export const DEMO_MESSAGES: Message[] = [
  {
    id: "m-marcus-1",
    player_id: "p-marcus",
    from_role: "coach",
    from_name: "Coach Yinka",
    body: "Loved your work rate at the last session. This week is all about the weak foot — send me 5 clips by Friday.",
    created_at: daysFromNow(-2),
    read: false,
  },
  {
    id: "m-sofia-1",
    player_id: "p-sofia",
    from_role: "coach",
    from_name: "Coach Yinka",
    body: "Your acceleration is unfair. Let's make that first touch just as scary. See you tomorrow.",
    created_at: daysFromNow(-1),
    read: false,
  },
  {
    id: "m-diego-1",
    player_id: "p-diego",
    from_role: "coach",
    from_name: "Coach Yinka",
    body: "Academy scout was impressed. Keep commanding that back line. Full breakdown of your trial film coming today.",
    created_at: daysFromNow(-1),
    read: true,
  },
  {
    id: "m-aisha-1",
    player_id: "p-aisha",
    from_role: "coach",
    from_name: "Coach Yinka",
    body: "You were braver in the box last session — I saw it. Keep finishing first-time and the goals will come.",
    created_at: daysFromNow(-2),
    read: false,
  },
  {
    id: "m-liam-1",
    player_id: "p-liam",
    from_role: "coach",
    from_name: "Coach Yinka",
    body: "Your crossing is getting sharp. This week we time the overlaps. Big season ahead.",
    created_at: daysFromNow(-3),
    read: true,
  },
];

export const DEMO_GAMES: Game[] = [
  {
    id: "g-marcus-1",
    player_id: "p-marcus",
    game_date: daysFromNow(4).slice(0, 10),
    kickoff: "10:30 AM",
    opponent: "Loudoun United U14",
    location: "Haymarket, VA",
    notes: "League game — starting CAM",
    coach_attending: true,
    created_at: daysFromNow(-2),
  },
  {
    id: "g-marcus-2",
    player_id: "p-marcus",
    game_date: daysFromNow(11).slice(0, 10),
    kickoff: "1:00 PM",
    opponent: "Arlington SA",
    location: "Arlington, VA",
    notes: "",
    coach_attending: false,
    created_at: daysFromNow(-1),
  },
];

export const DEMO_CHECKINS: Checkin[] = [
  {
    id: "ci-marcus-7",
    player_id: "p-marcus",
    week: 7,
    rating: 4,
    energy: 3,
    went_well: "Scanning is becoming automatic — caught myself checking both shoulders without thinking.",
    struggled: "Weak-foot finishing still feels awkward under any pressure.",
    note: "Legs a bit heavy midweek but pushed through all four sessions.",
    coach_feedback:
      "That scanning progress is exactly what we're after — it's a habit now. We'll take the weak foot slower this week, unopposed first, then add a defender.",
    coach_feedback_at: daysFromNow(-2),
    created_at: daysFromNow(-3),
  },
  {
    id: "ci-marcus-6",
    player_id: "p-marcus",
    week: 6,
    rating: 3,
    energy: 4,
    went_well: "Hit every session. Wall passes felt sharp.",
    struggled: "Got frustrated with the weak-foot reps and rushed them.",
    note: "",
    coach_feedback: "",
    coach_feedback_at: null,
    created_at: daysFromNow(-10),
  },
];

export const DEMO_WEEKLY_PLANS: WeeklyPlan[] = [
  {
    id: "wp-marcus-7",
    player_id: "p-marcus",
    week: 7,
    focus: "Scan before you receive — turn composure into decisions",
    objectives: [
      "Two shoulder checks before every touch in games",
      "Weak-foot finishing to a repeatable standard",
      "Play forward on the half-turn when it's on",
    ],
    homework: [
      { title: "Wall pass mastery", exercise: "Two-touch, alternating feet", reps: "200" },
      { title: "Weak-foot finishing", exercise: "Left-foot from the box", reps: "50" },
    ],
    created_at: daysFromNow(-3),
  },
];

export const DEMO_PARENT_REPORTS: ParentReport[] = [
  {
    id: "pr-marcus-1",
    player_id: "p-marcus",
    summary:
      "This week Marcus worked on scanning before receiving and staying composed under a press. His decision-making is visibly sharper.",
    improvement:
      "Scanning jumped from 58 to 71. He's now checking his shoulder automatically — a habit that separates good players from great ones.",
    homework:
      "200 wall passes, weak-foot finishing (50 strikes), and a Rodri film study focused on body shape.",
    next_focus:
      "Weak-foot finishing under fatigue and playing forward on the half-turn.",
    created_at: daysFromNow(-3),
  },
];

export const DEMO_ACHIEVEMENTS: Achievement[] = [
  {
    id: "a-marcus-1",
    player_id: "p-marcus",
    title: "Scanning Streak",
    detail: "7 sessions of consistent shoulder checks",
    icon: "Eye",
    earned_at: daysFromNow(-2),
  },
  {
    id: "a-marcus-2",
    player_id: "p-marcus",
    title: "Homework Hero",
    detail: "100% homework completion, 3 weeks running",
    icon: "CheckCircle2",
    earned_at: daysFromNow(-7),
  },
  {
    id: "a-marcus-3",
    player_id: "p-marcus",
    title: "Confidence +10",
    detail: "Biggest confidence gain in the squad this month",
    icon: "Flame",
    earned_at: daysFromNow(-5),
  },
  {
    id: "a-sofia-1",
    player_id: "p-sofia",
    title: "Speed Demon",
    detail: "Fastest 1v1 acceleration in the group",
    icon: "Zap",
    earned_at: daysFromNow(-4),
  },
  {
    id: "a-diego-1",
    player_id: "p-diego",
    title: "Aerial King",
    detail: "Won 9 of 10 aerial duels in his trial",
    icon: "Trophy",
    earned_at: daysFromNow(-2),
  },
  {
    id: "a-aisha-1",
    player_id: "p-aisha",
    title: "First Steps",
    detail: "Completed her first full week of homework",
    icon: "Sparkles",
    earned_at: daysFromNow(-3),
  },
];

// The player the demo "player login" signs in as.
export const DEMO_PLAYER_ID = "p-marcus";
