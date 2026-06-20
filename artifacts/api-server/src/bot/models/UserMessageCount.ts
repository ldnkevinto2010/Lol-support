import mongoose, { Schema, Document } from "mongoose";

export interface IUserMessageCount extends Document {
  guildId: string;
  userId: string;
  count: number;
}

const UserMessageCountSchema = new Schema<IUserMessageCount>({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  count: { type: Number, default: 0 },
});

UserMessageCountSchema.index({ guildId: 1, userId: 1 }, { unique: true });

export const UserMessageCount = mongoose.model<IUserMessageCount>(
  "UserMessageCount",
  UserMessageCountSchema
);
