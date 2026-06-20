import mongoose, { Schema, Document } from "mongoose";

export type TicketStatus = "open" | "closed" | "claimed";

export interface ITicket extends Document {
  guildId: string;
  channelId: string;
  ticketNumber: number;
  userId: string;
  claimedBy: string | null;
  status: TicketStatus;
  topic: string;
  createdAt: Date;
  closedAt: Date | null;
}

const TicketSchema = new Schema<ITicket>({
  guildId: { type: String, required: true },
  channelId: { type: String, required: true, unique: true },
  ticketNumber: { type: Number, required: true },
  userId: { type: String, required: true },
  claimedBy: { type: String, default: null },
  status: { type: String, enum: ["open", "closed", "claimed"], default: "open" },
  topic: { type: String, default: "No topic provided" },
  createdAt: { type: Date, default: Date.now },
  closedAt: { type: Date, default: null },
});

export const Ticket = mongoose.model<ITicket>("Ticket", TicketSchema);
