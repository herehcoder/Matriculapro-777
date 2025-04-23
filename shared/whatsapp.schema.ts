import { pgTable, text, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * Modelo para instâncias de WhatsApp (Evolution API)
 */
export const whatsappInstances = pgTable("whatsapp_instances", {
  id: integer("id").primaryKey().notNull(),
  schoolId: integer("school_id").references(() => schools.id).notNull(),
  name: text("name").notNull(),
  qrcode: text("qrcode"),
  status: text("status").notNull().default("disconnected"),
  apiKey: text("api_key").notNull(),
  baseUrl: text("base_url").notNull(),
  webhook: text("webhook"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastSyncAt: timestamp("last_sync_at"),
  settings: jsonb("settings"),
  active: boolean("active").default(true),
});

/**
 * Modelo para contatos do WhatsApp
 */
export const whatsappContacts = pgTable("whatsapp_contacts", {
  id: integer("id").primaryKey().notNull(),
  instanceId: integer("instance_id").references(() => whatsappInstances.id).notNull(),
  phone: text("phone").notNull(),
  name: text("name"),
  profilePic: text("profile_pic"),
  isGroup: boolean("is_group").default(false),
  lastMessageAt: timestamp("last_message_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  metadata: jsonb("metadata"),
});

/**
 * Modelo para mensagens do WhatsApp
 */
export const whatsappMessages = pgTable("whatsapp_messages", {
  id: integer("id").primaryKey().notNull(),
  instanceId: integer("instance_id").references(() => whatsappInstances.id).notNull(),
  contactId: integer("contact_id").references(() => whatsappContacts.id).notNull(),
  externalId: text("external_id"),
  direction: text("direction").notNull(), // inbound, outbound
  content: text("content"),
  mediaUrl: text("media_url"),
  mediaType: text("media_type"),
  metadata: jsonb("metadata"),
  status: text("status").notNull(), // sent, delivered, read, failed
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Importação circular - resolver de outra forma em uma implementação real
import { schools } from "./schema";

// Tipos derivados dos modelos
export type WhatsappInstance = typeof whatsappInstances.$inferSelect;
export type InsertWhatsappInstance = typeof whatsappInstances.$inferInsert;
export type WhatsappContact = typeof whatsappContacts.$inferSelect;
export type InsertWhatsappContact = typeof whatsappContacts.$inferInsert;
export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
export type InsertWhatsappMessage = typeof whatsappMessages.$inferInsert;

// Schemas Zod para validação
export const insertWhatsappInstanceSchema = createInsertSchema(whatsappInstances)
  .omit({ id: true, createdAt: true, updatedAt: true, lastSyncAt: true })
  .extend({
    schoolId: z.number(),
    name: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
    apiKey: z.string().min(8, "API Key deve ter no mínimo 8 caracteres"),
    baseUrl: z.string().url("URL base deve ser uma URL válida"),
    webhook: z.string().url("Webhook deve ser uma URL válida").optional(),
    settings: z.object({
      autoReply: z.boolean().default(false),
      notifyOnMessage: z.boolean().default(true),
      syncContacts: z.boolean().default(true),
    }).optional(),
  });

export const insertWhatsappContactSchema = createInsertSchema(whatsappContacts)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    instanceId: z.number(),
    phone: z.string().regex(/^\d+$/, "Telefone deve conter apenas números"),
    name: z.string().optional(),
  });

export const insertWhatsappMessageSchema = createInsertSchema(whatsappMessages)
  .omit({ id: true, createdAt: true, updatedAt: true, sentAt: true, deliveredAt: true, readAt: true })
  .extend({
    instanceId: z.number(),
    contactId: z.number(),
    direction: z.enum(["inbound", "outbound"]),
    content: z.string().optional(),
    status: z.enum(["pending", "sent", "delivered", "read", "failed"]),
  });

// Tipos derivados dos schemas Zod
export type WhatsappInstanceInput = z.infer<typeof insertWhatsappInstanceSchema>;
export type WhatsappContactInput = z.infer<typeof insertWhatsappContactSchema>;
export type WhatsappMessageInput = z.infer<typeof insertWhatsappMessageSchema>;

// Tipos adicionais para a API da Evolution
export interface EvolutionQRCode {
  base64: string;
  expiresAt: string;
}

export interface EvolutionInstanceStatus {
  status: "connected" | "disconnected" | "connecting" | "qrcode";
  qrcode?: string;
  phone?: string;
  name?: string;
}

export interface EvolutionSendMessageOptions {
  phone: string;
  message: string;
  options?: {
    delay?: number;
    presence?: "composing" | "recording" | "paused";
    quotedMessageId?: string;
  };
}

export interface EvolutionSendMediaOptions {
  phone: string;
  mediaType: "image" | "video" | "audio" | "document";
  media: string; // URL ou base64
  caption?: string;
  fileName?: string;
}

export interface EvolutionMessagePayload {
  id: string;
  from: string;
  to: string;
  content: string;
  type: "text" | "image" | "video" | "audio" | "document" | "location" | "contact";
  timestamp: number;
  isGroup: boolean;
  sender?: {
    id: string;
    name: string;
    pushname: string;
  };
  mediaUrl?: string;
  caption?: string;
  fileName?: string;
}

export interface EvolutionWebhookPayload {
  event: "message" | "status" | "connection" | "qrcode";
  instance: string;
  data: any;
}