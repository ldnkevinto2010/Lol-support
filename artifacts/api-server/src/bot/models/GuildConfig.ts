import mongoose, { Schema, Document } from "mongoose";

export interface IGameCategory {
  game: string;
  categoryId: string;
}

export interface IGameRole {
  game: string;
  roleId: string;
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
});

export const GuildConfig = mongoose.model<IGuildConfig>("GuildConfig", GuildConfigSchema);
