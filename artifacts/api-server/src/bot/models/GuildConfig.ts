import mongoose, { Schema, Document } from "mongoose";

export interface IGameCategory {
  game: string;
  categoryId: string;
}

export interface IGameRole {
  game: string;
  roleId: string;
}

export interface IApplicationRole {
  game: string;
  gameRoleId: string;
  baseRoleId: string;
  notifyRoleId?: string;
  cooldownMs?: number;
}

export interface IGuildConfig extends Document {
  guildId: string;
  ticketCategoryId: string | null;
  ticketLogChannelId: string | null;
  vouchChannelId: string | null;
  minMessagesRequired: number;
  supportRoleId: string | null;
  ticketCounter: number;
  supportedGames: string[];
  panelImageUrl: string | null;
  gameCategories: IGameCategory[];
  gameRoles: IGameRole[];
  bypassRoles: string[];
  staffRoles: string[];
  helperRoles: string[];
  applicationChannelId: string | null;
  applicationImageGuideText: string | null;
  dailyMessageGate: boolean;
  applicationPanelImageUrl: string | null;
  applicationRoles: IApplicationRole[];
  applicationGames: string[];
}

const GuildConfigSchema = new Schema<IGuildConfig>({
  guildId: { type: String, required: true, unique: true },
  ticketCategoryId: { type: String, default: null },
  ticketLogChannelId: { type: String, default: null },
  vouchChannelId: { type: String, default: null },
  minMessagesRequired: { type: Number, default: 0 },
  supportRoleId: { type: String, default: null },
  ticketCounter: { type: Number, default: 0 },
  supportedGames: { type: [String], default: [] },
  panelImageUrl: { type: String, default: null },
  gameCategories: { type: [{ game: String, categoryId: String }], default: [] },
  gameRoles: { type: [{ game: String, roleId: String }], default: [] },
  bypassRoles: { type: [String], default: [] },
  staffRoles: { type: [String], default: [] },
  helperRoles: { type: [String], default: [] },
  dailyMessageGate: { type: Boolean, default: false },
  applicationChannelId: { type: String, default: null },
  applicationPanelImageUrl: { type: String, default: null },
  applicationImageGuideText: { type: String, default: null },
  applicationRoles: {
    type: [{ game: String, gameRoleId: String, baseRoleId: String, notifyRoleId: String, cooldownMs: Number }],
    default: [],
  },
  applicationGames: { type: [String], default: [] },
});

export const GuildConfig = mongoose.model<IGuildConfig>("GuildConfig", GuildConfigSchema);
