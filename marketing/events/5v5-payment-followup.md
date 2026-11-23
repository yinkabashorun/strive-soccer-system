# Strive Elite 5v5: SMS payment follow-up (GHL)

Built for Coach Yinka, Nov 19 2026. Built by hand in GHL > Automation >
Workflows. This repo cannot reach GHL, so nothing here is live until it is
built there.

Payment link (Stripe): https://buy.stripe.com/5kQ9AS8jY2Woalg8z54Rq0c
CHECK: which price this link charges ($450 early bird or $550). The Stripe
page loads by script, so the amount could not be read from here.

## Set up once

1. **Custom value** `5v5_payment_link` (Settings > Custom Values), set to the
   link above. Every text below uses `{{custom_values.5v5_payment_link}}`.
   On **Wed Dec 2**, change this value to the $550 link. Every text picks up
   the new link at once, including texts already scheduled.
2. **Tags:** `5v5-registered` and `5v5-paid`.
3. **Marking a team paid:** a Stripe Payment Link does not tell GHL when it
   is paid. When Stripe emails you that a payment came in, open that contact
   and add the tag `5v5-paid`. That tag stops the reminders and sends the
   confirmation. (To make this automatic later: Zapier, "Stripe: new
   checkout session completed" > "GHL: add tag", matched on phone.)

## Workflow 1: "5v5 registration > payment"

**Trigger:** Form Submitted, form = the 5v5 registration form
(lHiFBnSdihwHaGDbeOBO).

**Goal event (workflow settings):** Contact tag added `5v5-paid`. A paid
contact leaves the workflow at that point, so no reminder ever reaches a
paid team.

**Steps:**

1. Add tag `5v5-registered`.
2. **SMS 1, sent immediately:**
   > Hey {{contact.first_name}}, {{TEAM NAME FIELD}} is registered for the Strive Elite 5v5, Mon, Dec 21 at SoFive Columbia. Lock your spot with the entry fee here: {{custom_values.5v5_payment_link}} Your spot is held once it is paid.
3. Wait 1 day.
4. **SMS 2:**
   > {{contact.first_name}}, your team's spot in the 5v5 is not locked yet. 32 teams get in, and a spot is held only once the entry fee is paid: {{custom_values.5v5_payment_link}}
5. Wait 2 days.
6. **SMS 3:**
   > Quick one {{contact.first_name}}, still want {{TEAM NAME FIELD}} in the 5v5? If anything is holding you up, just reply here. Payment link: {{custom_values.5v5_payment_link}}
7. Wait until **Tue Dec 1, 10:00 AM ET**. If the contact registers after
   this time, the step is skipped.
8. **SMS 4, early bird last day:**
   > Early bird for the Strive Elite 5v5 ends tonight at midnight. $450 per team today, $550 from tomorrow: {{custom_values.5v5_payment_link}}
9. Wait until **Fri Dec 4, 10:00 AM ET**.
10. **SMS 5, last call:**
    > Registration for the Strive Elite 5v5 closes tomorrow, Sat, Dec 5. Pay here to lock your spot: {{custom_values.5v5_payment_link}}

In GHL, set "Wait until a specific date" to skip the step if that date has
passed. Otherwise a team that registers on Dec 3 would get the early bird
text.

## Workflow 2: "5v5 paid > confirmation"

**Trigger:** Contact tag added `5v5-paid`.

1. **SMS, sent immediately:**
   > {{contact.first_name}}, payment received. {{TEAM NAME FIELD}} is in the Strive Elite 5v5, Mon, Dec 21 at SoFive Columbia. The schedule and the social media rollout drop on Instagram a week before the event, so make sure your whole team follows @strivesoccerfc.

## Notes

- `{{TEAM NAME FIELD}}`: insert the team name field from your form with
  GHL's field picker. Its key is set in GHL, not here.
- Texts follow the page: 32 teams, $450 through Dec 1, $550 from Dec 2,
  closes Dec 5, and a spot is held only once paid. No emojis, no em dashes,
  no price beyond those two.
- Replies land in GHL Conversations. Answer them there.
- Same-day refund policy stands if a team asks.
