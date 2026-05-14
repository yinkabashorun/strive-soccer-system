export type Player = {
  id: string;
  name: string;
  age: number;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  package: "Group" | "Private" | "Camp" | "Course";
  sessionsRemaining: number;
  sessionsTotal: number;
  paymentStatus: "Paid" | "Unpaid" | "Partial";
  joinedAt: string;
  coach: string;
  level: "Beginner" | "Intermediate" | "Advanced" | "Elite";
  progressNotes: string[];
  avatarColor: string;
};

export type Session = {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  coach: string;
  capacity: number;
  enrolled: string[];
  attended: string[];
  type: "Group" | "Private" | "Camp";
  notes?: string;
};

export type Lead = {
  id: string;
  name: string;
  source: "TikTok" | "Instagram" | "Referral" | "Website" | "GHL Form";
  interest: "Group Training" | "Private" | "Camp" | "Course";
  createdAt: string;
  status: "New" | "Contacted" | "Trial Booked" | "Converted" | "Lost";
  notes?: string;
};

export type CourseModule = {
  id: string;
  index: number;
  title: string;
  description: string;
  durationMin: number;
  lessons: CourseLesson[];
  locked: boolean;
};

export type CourseLesson = {
  id: string;
  title: string;
  durationSec: number;
  completed: boolean;
  type: "Video" | "Drill" | "Challenge";
};

export type ContentItem = {
  id: string;
  title: string;
  hook: string;
  caption: string;
  script: string;
  platform: "TikTok" | "Instagram" | "YouTube Shorts";
  status: "Idea" | "Scripted" | "Edited" | "Posted" | "Viral";
  scheduledFor?: string;
  postedAt?: string;
  views?: number;
  likes?: number;
  shares?: number;
  saves?: number;
  pillar: "Ball Mastery" | "Mindset" | "Behind the Scenes" | "Player Spotlight" | "Education";
};

export type CoachTask = {
  id: string;
  title: string;
  due: string;
  priority: "Low" | "Med" | "High";
  done: boolean;
  owner: string;
};

export type PipelineStage =
  | "New Lead"
  | "Proposal Sent"
  | "Followed up 1"
  | "Followed up 2x"
  | "Promised"
  | "Signed Up"
  | "Won"
  | "Lost";

export type Opportunity = {
  id: string;
  name: string;
  contactName: string;
  phone?: string;
  email?: string;
  stage: PipelineStage;
  /** $ value as recorded in GHL. 0 means not set yet. */
  leadValue: number;
  /** Estimated $ when leadValue is 0 (defaults to Development Pack $319). */
  expectedValue: number;
  source?: string;
  notes?: string;
  tags?: string[];
  status: "open" | "won" | "lost";
  createdAt: string;
  updatedAt: string;
  /** Whether the money has actually been collected (only meaningful for Won). */
  collected: boolean;
  contactId: string;
  pipelineId: string;
  pipelineStageId: string;
};

export type OperatorBucket =
  | "promised_uncollected"
  | "won_uncollected"
  | "needs_close"
  | "cooling"
  | "stale_followup"
  | "rescue_new"
  | "signed_unpaid";

export type BriefAction = {
  id: string;
  rank: number;
  opportunityId: string;
  bucket: OperatorBucket;
  headline: string;
  reason: string;
  script: string;
  channel: "call" | "sms" | "whatsapp" | "venmo";
};
