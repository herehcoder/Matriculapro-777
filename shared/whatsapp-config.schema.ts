import { relations } from "drizzle-orm";
import { boolean, pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { schools, users } from "./schema";

// Tabela para configuração geral da API WhatsApp pelo administrador
export const whatsappApiConfigs = pgTable("whatsapp_api_configs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  apiBaseUrl: text("api_base_url").notNull(),
  apiKey: text("api_key").notNull(),
  webhookUrl: text("webhook_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdById: integer("created_by_id").references(() => users.id),
});

// Tabela para instâncias de WhatsApp por escola
export const whatsappInstances = pgTable("whatsapp_instances", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  instanceId: text("instance_id").notNull().unique(),
  instanceToken: text("instance_token").notNull(),
  status: text("status").notNull().default("disconnected"),
  qrCode: text("qr_code"),
  phoneNumber: text("phone_number"),
  schoolId: integer("school_id").references(() => schools.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastConnection: timestamp("last_connection"),
});

// Relações para instâncias de WhatsApp
export const whatsappInstancesRelations = relations(whatsappInstances, ({ one }) => ({
  school: one(schools, {
    fields: [whatsappInstances.schoolId],
    references: [schools.id],
  }),
}));

// Schemas Zod para validação
export const insertWhatsappApiConfigSchema = createInsertSchema(whatsappApiConfigs);
export const selectWhatsappApiConfigSchema = createSelectSchema(whatsappApiConfigs);

export const insertWhatsappInstanceSchema = createInsertSchema(whatsappInstances);
export const selectWhatsappInstanceSchema = createSelectSchema(whatsappInstances);

// Tipos das tabelas
export type WhatsappApiConfig = typeof whatsappApiConfigs.$inferSelect;
export type InsertWhatsappApiConfig = typeof whatsappApiConfigs.$inferInsert;

export type WhatsappInstance = typeof whatsappInstances.$inferSelect;
export type InsertWhatsappInstance = typeof whatsappInstances.$inferInsert;

// Schemas para API
export const whatsappApiConfigSchema = z.object({
  apiBaseUrl: z.string().url("A URL base da API precisa ser uma URL válida"),
  apiKey: z.string().min(1, "A chave da API é obrigatória"),
  webhookUrl: z.string().url("A URL do webhook precisa ser uma URL válida").optional(),
});

export const whatsappInstanceSchema = z.object({
  instanceId: z.string().min(1, "O ID da instância é obrigatório"),
  instanceToken: z.string().min(1, "O token da instância é obrigatório"),
  schoolId: z.number().int().positive("O ID da escola é obrigatório"),
});