import mongoose, { Schema, Document } from "mongoose";

export interface IApplication extends Document {
  guildId: string;
  userId: string;
  username: string;
  game: string;
  answers: string[];
  status: "pending" | "accepted" | "rejected";
  reviewedBy?: string;
  reviewChannelId?: string;
  reviewMessageId?: string;
  submittedAt: Date;
  reviewedAt?: Date;
}

const ApplicationSchema = new Schema<IApplication>({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  username: { type: String, required: true },
  game: { type: String, required: true },
  answers: { type: [String], required: true },
  status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" },
  reviewedBy: { type: String },
  reviewChannelId: { type: String },
  reviewMessageId: { type: String },
  submittedAt: { type: Date, default: Date.now },
  reviewedAt: { type: Date },
});

export const Application = mongoose.model<IApplication>("Application", ApplicationSchema);
