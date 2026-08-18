import mongoose, { Schema, Document } from "mongoose";

export interface IUserMessageCount extends Document {
  guildId: string;
  userId: string;
  count: number;
  lastGatePassed: Date | null;
  dailyCount: number;
  dailyCountDate: string | null;   // "YYYY-MM-DD" UTC
  weeklyCount: number;
  weeklyCountDate: string | null;  // "YYYY-WW" UTC ISO week
  monthlyCount: number;
  monthlyCountDate: string | null; // "YYYY-MM" UTC
}

const UserMessageCountSchema = new Schema<IUserMessageCount>({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  count: { type: Number, default: 0 },
  lastGatePassed: { type: Date, default: null },
  dailyCount: { type: Number, default: 0 },
  dailyCountDate: { type: String, default: null },
  weeklyCount: { type: Number, default: 0 },
  weeklyCountDate: { type: String, default: null },
  monthlyCount: { type: Number, default: 0 },
  monthlyCountDate: { type: String, default: null },
});

UserMessageCountSchema.index({ guildId: 1, userId: 1 }, { unique: true });

export const UserMessageCount = mongoose.model<IUserMessageCount>(
  "UserMessageCount",
  UserMessageCountSchema
);

/** Returns "YYYY-WW" for the ISO week of a given date in UTC. */
export function getUTCWeekKey(date: Date = new Date()): string {
  // ISO week: week containing Thursday, week 1 = week with Jan 4
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7; // 1=Mon … 7=Sun
  d.setUTCDate(d.getUTCDate() + 4 - day); // Thursday of current week
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-${String(week).padStart(2, "0")}`;
}
