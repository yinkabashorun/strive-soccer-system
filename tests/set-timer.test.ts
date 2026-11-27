import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  READY_SECONDS,
  clock,
  parseReps,
  planKey,
  planLine,
  stepSeconds,
  timerNext,
  timerStart,
  type TimerStep,
} from "../lib/elite/set-timer";
import { MILESTONE_HOURS, milestoneCrossed, milestoneLabel } from "../lib/elite/session-flow";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

// The set timer reads the coach's own words and never invents a time.
// Every string below is how the drill bank writes sets today.
describe("parseReps: the bank's own wording", () => {
  it("times a timed set with a written rest", () => {
    expect(parseReps("3 x 1 min, rest 30 sec")).toEqual({ sets: 3, workSec: 60, restSec: 30 });
    expect(parseReps("3 x 90 sec, rest 30 sec")).toEqual({ sets: 3, workSec: 90, restSec: 30 });
    expect(parseReps("3 x 20 sec, rest 30 sec")).toEqual({ sets: 3, workSec: 20, restSec: 30 });
    expect(parseReps("6 x 45 sec on, 45 sec off")).toEqual({ sets: 6, workSec: 45, restSec: 45 });
    expect(parseReps("4 x 45 sec on, 30 sec off")).toEqual({ sets: 4, workSec: 45, restSec: 30 });
    expect(parseReps("3 x 45 sec on, 30 sec rest")).toEqual({ sets: 3, workSec: 45, restSec: 30 });
    expect(parseReps("4 x 1 min, rest 20 sec")).toEqual({ sets: 4, workSec: 60, restSec: 20 });
  });

  it("times a timed set with no rest written, and invents no rest", () => {
    expect(parseReps("3 x 30 sec")).toEqual({ sets: 3, workSec: 30, restSec: null });
    expect(parseReps("3 x 20 seconds")).toEqual({ sets: 3, workSec: 20, restSec: null });
    expect(parseReps("5 mins")).toEqual({ sets: 1, workSec: 300, restSec: null });
  });

  it("times only the rest of a counted set", () => {
    expect(parseReps("3 x 10 reps, rest 30 sec")).toEqual({ sets: 3, workSec: null, restSec: 30 });
    expect(parseReps("3 x 12 each side, rest 45 sec")).toEqual({ sets: 3, workSec: null, restSec: 45 });
    expect(parseReps("3 x 10, rest 30 sec")).toEqual({ sets: 3, workSec: null, restSec: 30 });
    expect(parseReps("3 x 20 alternating drives, rest 30 sec")).toEqual({ sets: 3, workSec: null, restSec: 30 });
    // a range is the player's to count; the rest is still timed
    expect(parseReps("3 x 30 to 45 sec, rest 45 sec")).toEqual({ sets: 3, workSec: null, restSec: 45 });
  });

  it("offers no timer when the words give nothing to time", () => {
    for (const reps of [
      "3 x 8 each side",
      "3 x 6 each leg",
      "3 x 12",
      "3 x 5",
      "6 reps, walk back between each",
      "4 runs through the line, walk back between each",
      "4 runs through the line, full rest between each",
      "3 each side, walk back between each",
      "5 x 8 full speed, walk-back reset",
      "3 sets of 6 bounds each way, full rest between sets",
      "3 sets of 5 jumps, full rest between sets",
      "6 sprints, full rest between each",
      "4 rounds, full rest between each",
      "3 rounds of the three runs, full rest between rounds",
      "",
    ]) {
      expect(parseReps(reps), reps).toBeNull();
    }
    expect(parseReps(null)).toBeNull();
    expect(parseReps(undefined)).toBeNull();
  });

  it("refuses numbers no session would use", () => {
    expect(parseReps("99 x 1 min, rest 30 sec")).toBeNull();
    expect(parseReps("3 x 2 sec")).toBeNull();
    expect(parseReps("3 x 90 min")).toBeNull();
    expect(parseReps("3 x 1 min, rest 60 min")).toBeNull();
  });
});

describe("the timer walks the sets", () => {
  const walk = (reps: string) => {
    const plan = parseReps(reps)!;
    const steps: TimerStep[] = [];
    let step = timerStart(plan);
    for (let i = 0; i < 60 && step.phase !== "done"; i++) {
      steps.push(step);
      step = timerNext(plan, step);
    }
    steps.push(step);
    return { plan, phases: steps.map((s) => `${s.phase}${s.phase === "done" ? "" : s.set}`) };
  };

  it("timed sets with rest: ready, work, rest ... no rest after the last set", () => {
    const { plan, phases } = walk("3 x 1 min, rest 30 sec");
    expect(phases).toEqual(["ready1", "work1", "rest1", "work2", "rest2", "work3", "done"]);
    expect(stepSeconds(plan, { phase: "ready", set: 1 })).toBe(READY_SECONDS);
    expect(stepSeconds(plan, { phase: "work", set: 1 })).toBe(60);
    expect(stepSeconds(plan, { phase: "rest", set: 1 })).toBe(30);
  });

  it("timed sets with no rest written wait for the player between sets", () => {
    const { plan, phases } = walk("3 x 30 sec");
    expect(phases).toEqual(["ready1", "work1", "between1", "work2", "between2", "work3", "done"]);
    expect(stepSeconds(plan, { phase: "between", set: 1 })).toBeNull();
  });

  it("counted sets wait for Set done, then time the rest", () => {
    const { plan, phases } = walk("3 x 10 reps, rest 30 sec");
    expect(phases).toEqual(["work1", "rest1", "work2", "rest2", "work3", "done"]);
    expect(stepSeconds(plan, { phase: "work", set: 1 })).toBeNull();
  });

  it("one timed set is ready, work, done", () => {
    expect(walk("5 mins").phases).toEqual(["ready1", "work1", "done"]);
  });

  it("done stays done", () => {
    const plan = parseReps("3 x 30 sec")!;
    expect(timerNext(plan, { phase: "done", set: 3 })).toEqual({ phase: "done", set: 3 });
  });

  it("reads the clock the way a stopwatch does", () => {
    expect(clock(90)).toBe("1:30");
    expect(clock(47)).toBe("0:47");
    expect(clock(46.2)).toBe("0:47");
    expect(clock(0)).toBe("0:00");
    expect(clock(-3)).toBe("0:00");
  });

  it("never ticks the drill for the player, and can be silenced", () => {
    const timer = read("components/elite/SetTimer.tsx");
    expect(timer).not.toContain("onToggle");
    expect(timer).not.toContain("toggleHomework");
    expect(read("components/elite/DeviceSettings.tsx")).toContain("SOUND_PREF_KEY");
    expect(read("lib/elite/sound.ts")).toContain("SOUND_PREF_KEY");
  });
});

// Found on a phone, Nov 26 2026 (Coach Yinka: "the timer doesn't count down
// the same time as we put for the drill"): the iPhone app's timer restarted
// itself, back to its five second "Get ready", whenever the session behind
// it redrew with a new object for the same drill, which happens each time a
// tick saves. The timer now starts on what the sets ARE, never on the object.
describe("the iPhone app's timer starts once and shows the coach's own numbers", () => {
  it("two readings of the same words are the same timer", () => {
    const a = parseReps("3 x 1 min, rest 30 sec")!;
    const b = parseReps("3 x 1 min, rest 30 sec")!;
    expect(a).not.toBe(b);
    expect(planKey(a)).toBe(planKey(b));
    expect(planKey(a)).not.toBe(planKey(parseReps("3 x 90 sec, rest 30 sec")!));
    expect(planKey(parseReps("3 x 10 reps, rest 30 sec")!)).not.toBe(planKey(parseReps("3 x 30 sec")!));
  });

  it("the app starts the timer on the plan's value, and reads the plan from the words", () => {
    const timer = read("mobile/src/SetTimer.tsx");
    expect(timer).toContain("const key = planKey(plan);");
    expect(timer).toContain("}, [key]);");
    // the old effect, which ran again for every new object
    expect(timer).not.toContain("}, [plan, enter]);");
    const session = read("mobile/app/session/[n].tsx");
    expect(session).toContain("useMemo(() => (reps ? parseReps(reps) : null), [reps])");
    expect(session).not.toContain("parseReps(drill.reps) : null), [drill]");
  });

  it("a step's first frame never counts the time spent before the tap", () => {
    const timer = read("mobile/src/SetTimer.tsx");
    // entering a step and resuming both bring the screen's clock up to now
    expect(timer.match(/setNow\(t\);/g)?.length).toBe(2);
  });

  it("under Get ready it says what is about to run, in the coach's numbers", () => {
    expect(planLine(parseReps("3 x 1 min, rest 30 sec")!)).toBe("3 sets of 1 min. Rest 30 sec.");
    expect(planLine(parseReps("3 x 90 sec, rest 30 sec")!)).toBe("3 sets of 1 min 30 sec. Rest 30 sec.");
    expect(planLine(parseReps("6 x 45 sec on, 45 sec off")!)).toBe("6 sets of 45 sec. Rest 45 sec.");
    expect(planLine(parseReps("3 x 30 sec")!)).toBe("3 sets of 30 sec.");
    expect(planLine(parseReps("3 x 10 reps, rest 30 sec")!)).toBe("3 sets. Rest 30 sec.");
    expect(planLine(parseReps("5 mins")!)).toBe("1 set of 5 min.");
    expect(read("mobile/src/SetTimer.tsx")).toContain('step.phase === "ready"\n            ? planLine(plan)');
  });
});

describe("milestones: hours trained, all time", () => {
  it("fires once, when the session carries the total past the mark", () => {
    expect(milestoneCrossed(40, 62)).toBe(1);
    expect(milestoneCrossed(62, 100)).toBeNull();
    expect(milestoneCrossed(590, 600)).toBe(10);
    expect(milestoneCrossed(600, 640)).toBeNull(); // already there
    expect(milestoneCrossed(0, 0)).toBeNull();
  });

  it("names the highest mark when one long session passes two", () => {
    expect(milestoneCrossed(30, 200)).toBe(3);
  });

  it("only ever goes up, and is never a streak", () => {
    const sorted = [...MILESTONE_HOURS].sort((a, b) => a - b);
    expect(MILESTONE_HOURS).toEqual(sorted);
    expect(milestoneLabel(1)).toBe("1 hour trained");
    expect(milestoneLabel(25)).toBe("25 hours trained");
    const finish = read("components/elite/SessionPlayer.tsx");
    expect(finish).toContain("milestoneCrossed(");
    expect(finish.toLowerCase()).not.toContain("streak");
  });
});
