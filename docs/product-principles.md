# Strive product principles

Adopted Nov 22 2026 from the behavior-design notes Coach Yinka sent
(Fogg, Deci and Ryan, Clear, Eyal, goal-gradient research, Duolingo).
Every build is checked against this list before it ships. Where a
principle collides with one of his standing rules, his rule wins, and the
collision is written down here.

## The one idea

A player does not want a soccer app. They want to become a better player,
and they want evidence that they are getting there. Strive is the place
where that happens: a personal progression system, not a catalog.

## The ten rules

1. **Give a meaningful goal.** The player's own goal (onboarding, the
   3-month program quiz) sits on Home, broken down: goal, this block,
   this week, today.
2. **Say exactly what to do next.** Home is one card and one button. The
   app decides; the player starts. Good defaults over menus.
3. **Make doing it easy.** One tap from opening the app to training. No
   navigation, no choosing a program, no finding a drill.
4. **Give immediate evidence of success.** Every finished session ends on
   a reward: the ring, the minutes added, the next milestone, a new best.
5. **Show progress closing on a goal.** "2 of 4 this week", "One more
   session completes your week." Distance shrinking pulls people forward.
6. **Show real improvement, not just effort.** The progress video for
   members, and My Drills in the free app (Then and now, the progress
   reel), turn an invisible change into a picture the player can see.
7. **Let them see who they are becoming.** Profile, history, member card,
   aura, milestones: "I'm a Strive player" built from what they did.
8. **Let the right people see it.** Friends, clubs, the county. Never a
   board of thousands of strangers where they are #4,821.
9. **Make history valuable.** Every session, take, post and club result
   stays and adds up. The account gets more valuable every week.
10. **Prompts come from the player's life, not from our need for an
    open.** "Today's session is ready" at the hour they usually train,
    once a day at most, never on a break, never once the week is done.

## Where his rules override

- **No streaks, ever** (Oct 12 2026: a break never costs a player
  anything). Progress is time trained, weeks completed and milestones, all
  numbers that only go up.
- **Never invent a number.** No "+4% weak foot" unless the player
  measured it. Every improvement number comes from the player's own
  counts or from the coach, and is labelled that way.
- **Members are ranked against nobody.** Comparison lives in the free
  app, and there only among friends, inside clubs, and clubs by county.
- **Never "AI" or "automated" in anything a player or parent sees.**
- **Habit-forming, not addictive.** The measure is valuable behavior
  (training done), never screen time. No feeds built to be scrolled for
  their own sake, no notifications to win an open.

## Protect the channel (Nov 24 2026)

A notification is the one way the app reaches a player who is not looking
at it, and a player who turns it off never turns it back on. So:

- **Wording and timing may be improved at any time. Volume may not.** A new
  kind of notification, or more of an existing one, needs Coach Yinka's
  word first.
- **One event, one notice.** The database enforces it, so a bug cannot
  repeat one.
- **It informs.** It never tells the player to do a task, never sells,
  never counts what was missed. Every notice is one entry in one list
  (the catalogue in lib/elite) and a test reads every word of it.
- **It opens the thing it is about**, on the website and in the iPhone app.
- **It goes quiet at night**, and the daily reminder pauses itself when a
  player has stopped answering it, with one plain last line.
- **The player chooses.** Topics can be switched off one by one in Account.

What the leaders do for each number, and what we took from them, is in
docs/growth/leaders-2026-11-24.md.

## The loop to protect

Open, train, see what you did, see that you are improving, feel capable,
want the next session. Anything that adds steps to that loop, hides the
evidence, or adds guilt does not ship.
