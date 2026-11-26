import { APP_API, type AppEmailAnswer } from "@shared/app-contract";
import { api } from "./api/client";

// Email confirmation (093): the server decides every answer
// (lib/elite/email-confirm-server.ts); the phone sends what was typed and
// shows the line that comes back.
export const sendEmailCode = () => api<AppEmailAnswer>(APP_API.emailSend, { method: "POST", body: {} });
export const confirmEmailCode = (code: string) => api<AppEmailAnswer>(APP_API.emailConfirm, { method: "POST", body: { code } });
export const changeEmailAddress = (email: string) => api<AppEmailAnswer>(APP_API.emailChange, { method: "POST", body: { email } });
