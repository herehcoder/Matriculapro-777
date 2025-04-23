import { pgTable, serial, varchar, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * Tabela de configurações da API do WhatsApp
 */
export const whatsappApiConfigs = pgTable('whatsapp_api_configs', {
  id: serial('id').primaryKey(),
  baseUrl: varchar('base_url', { length: 255 }).notNull(),
  apiKey: varchar('api_key', { length: 255 }).notNull(),
  active: boolean('active').default(true),
  settings: json('settings'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Criar Zod schema para validação
export const insertWhatsappApiConfigSchema = createInsertSchema(whatsappApiConfigs, {
  baseUrl: z.string().url('A URL base deve ser uma URL válida'),
  apiKey: z.string().min(10, 'A chave da API deve ter pelo menos 10 caracteres')
}).omit({ id: true, createdAt: true, updatedAt: true });

// Tipos TypeScript
export type WhatsappApiConfig = typeof whatsappApiConfigs.$inferSelect;
export type InsertWhatsappApiConfig = z.infer<typeof insertWhatsappApiConfigSchema>;