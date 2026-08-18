import mongoose, { Schema, Document } from "mongoose";

export interface IUserMessageCount extends Document {
  guildId: string;
  userId: string;
  count: number;
  lastGatePassed: Date | null;
  dailyCount: number;
  dailyCountDate: string | null; // ISO date string "YYYY-MM-DD" in UTC
}

const UserMessageCountSchema = new Schema<IUserMessageCount>({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  count: { type: Number, default: 0 },
  lastGatePassed: { type: Date, default: null },
  dailyCount: { type: Number, default: 0 },
  dailyCountDate: { type: String, default: null },
});

UserMessageCountSchema.index({ guildId: 1, userId: 1 }, { unique: true });

export const UserMessageCount = mongoose.model<IUserMessageCount>(
  "UserMessageCount",
  UserMessageCountSchema
);
