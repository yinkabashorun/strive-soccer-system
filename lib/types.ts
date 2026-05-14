export type Player = {
  id: string;
  name: string;
  age: number;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  package: "Group" | "Private" | "Course";
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
  partner?: string;
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
