/**
 * Schema para as configurações do WhatsApp Evolution API
 */
import { pgTable, serial, text, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

/**
 * Tabela de configurações da API do WhatsApp
 */
export const whatsappApiConfigs = pgTable('whatsapp_api_configs', {
  id: serial('id').primaryKey(),
  apiBaseUrl: text('api_base_url').notNull(),
  apiKey: text('api_key').notNull(),
  webhookUrl: text('webhook_url'),
  webhookSecret: text('webhook_secret'),
  active: boolean('active').default(true),
  settings: jsonb('settings'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Schema Zod para validação e inserção
export const whatsappApiConfigSchema = createInsertSchema(whatsappApiConfigs, {
  apiBaseUrl: z.string().url('URL base inválida'),
  apiKey: z.string().min(1, 'Chave de API é obrigatória'),
  webhookUrl: z.string().url('URL de webhook inválida').optional(),
  webhookSecret: z.string().optional(),
  active: z.boolean().optional(),
  settings: z.any().optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

// Tipos TypeScript para as entidades
export type WhatsappApiConfig = typeof whatsappApiConfigs.$inferSelect;
export type InsertWhatsappApiConfig = z.infer<typeof whatsappApiConfigSchema>;