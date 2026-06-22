import mongoose, { Schema, Document } from "mongoose";

export interface IVouch extends Document {
  guildId: string;
  fromUserId: string;
  toUserId: string;
  reason: string;
  ticketId: string | null;
  createdAt: Date;
}

const VouchSchema = new Schema<IVouch>({
  guildId: { type: String, required: true },
  fromUserId: { type: String, required: true },
  toUserId: { type: String, required: true },
  reason: { type: String, default: "" },
  ticketId: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});

export const Vouch = mongoose.model<IVouch>("Vouch", VouchSchema);
