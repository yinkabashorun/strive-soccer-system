"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Mail, Phone, User } from "lucide-react";
import { updatePlayerContact } from "@/lib/elite/coach-actions";

// Coach-editable parent email/phone plus the player's own optional phone.
// Saves each field independently on blur. The only way to fix a wrong or
// missing number for a player who signed up before phone capture existed
// - players can't edit this themselves, contact info is coach-managed.
export function ContactInfoEditor({
  playerId,
  initialEmail,
  initialPhone,
  initialPlayerPhone,
}: {
  playerId: string;
  initialEmail: string;
  initialPhone: string;
  initialPlayerPhone: string;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);
  const [playerPhone, setPlayerPhone] = useState(initialPlayerPhone);
  const [savedField, setSavedField] = useState<
    "email" | "phone" | "playerPhone" | null
  >(null);
  const [pending, start] = useTransition();

  function saveEmail() {
    if (email === initialEmail) return;
    setSavedField(null);
    start(async () => {
      await updatePlayerContact(playerId, { parent_email: email });
      setSavedField("email");
    });
  }

  function savePhone() {
    if (phone === initialPhone) return;
    setSavedField(null);
    start(async () => {
      await updatePlayerContact(playerId, { parent_phone: phone });
      setSavedField("phone");
    });
  }

  function savePlayerPhone() {
    if (playerPhone === initialPlayerPhone) return;
    setSavedField(null);
    start(async () => {
      await updatePlayerContact(playerId, { player_phone: playerPhone });
      setSavedField("playerPhone");
    });
  }

  return (
    <div className="mb-3 space-y-2 border-b border-white/6 pb-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
          Parent contact
        </span>
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-white/40" />
        ) : savedField ? (
          <span className="flex items-center gap-1 text-[11px] text-accent">
            <Check className="h-3 w-3" /> Saved
          </span>
        ) : null}
      </div>
      <label className="flex items-center gap-2">
        <Mail className="h-3.5 w-3.5 shrink-0 text-white/30" />
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setSavedField(null);
          }}
          onBlur={saveEmail}
          placeholder="parent@example.com"
          className={inputCls}
        />
      </label>
      <label className="flex items-center gap-2">
        <Phone className="h-3.5 w-3.5 shrink-0 text-white/30" />
        <input
          type="tel"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            setSavedField(null);
          }}
          onBlur={savePhone}
          placeholder="(703) 555-0100"
          className={inputCls}
        />
      </label>

      <div className="pt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
        Player's own phone (optional)
      </div>
      <label className="flex items-center gap-2">
        <User className="h-3.5 w-3.5 shrink-0 text-white/30" />
        <input
          type="tel"
          value={playerPhone}
          onChange={(e) => {
            setPlayerPhone(e.target.value);
            setSavedField(null);
          }}
          onBlur={savePlayerPhone}
          placeholder="(703) 555-0100, if they have one"
          className={inputCls}
        />
      </label>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-bone placeholder:text-white/25 focus:border-accent/40 focus:outline-none";
