import { pgTable, serial, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * Tabela de configurações globais do WhatsApp (Evolution API)
 */
export const whatsappApiConfigs = pgTable('whatsapp_api_configs', {
  id: serial('id').primaryKey(),
  apiKey: text('api_key').notNull(),
  apiBaseUrl: text('api_base_url').notNull(),
  webhookUrl: text('webhook_url'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  createdById: integer('created_by_id')
});

/**
 * Tabela de instâncias do WhatsApp (uma por escola)
 */
export const whatsappInstances = pgTable('whatsapp_instances', {
  id: serial('id').primaryKey(),
  instanceId: text('instance_id').notNull().unique(),
  instanceToken: text('instance_token').notNull(),
  schoolId: integer('school_id').notNull(),
  status: text('status').default('disconnected').notNull(),
  qrCode: text('qr_code'),
  phoneNumber: text('phone_number'),
  lastConnection: timestamp('last_connection'),
  webhookUrl: text('webhook_url'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

/**
 * Mensagens enviadas e recebidas via WhatsApp
 */
export const whatsappMessages = pgTable('whatsapp_messages', {
  id: serial('id').primaryKey(),
  instanceId: integer('instance_id').notNull(),
  contactId: integer('contact_id').notNull(),
  direction: text('direction').notNull(), // 'incoming' | 'outgoing'
  status: text('status').notNull(), // 'pending', 'sent', 'delivered', 'read', 'failed'
  content: text('content'),
  metadata: text('metadata', { mode: 'json' }),
  externalId: text('external_id'), // ID da mensagem na Evolution API
  type: text('type').default('text'), // 'text', 'image', 'file', 'audio', etc.
  timestamp: timestamp('timestamp').defaultNow(),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Schemas Zod para inserção de dados
export const insertWhatsAppApiConfigSchema = createInsertSchema(whatsappApiConfigs, {
  apiKey: z.string().min(1, 'A chave da API é obrigatória'),
  apiBaseUrl: z.string().url('URL da API inválida'),
  webhookUrl: z.string().url('URL de webhook inválida').optional(),
});

export const insertWhatsAppInstanceSchema = createInsertSchema(whatsappInstances, {
  instanceId: z.string().min(3, 'ID da instância deve ter no mínimo 3 caracteres'),
  instanceToken: z.string().min(3, 'Token da instância é obrigatório'),
  schoolId: z.number().int().positive('ID da escola é obrigatório'),
  webhookUrl: z.string().url('URL inválida').optional(),
});

export const insertWhatsAppMessageSchema = createInsertSchema(whatsappMessages, {
  instanceId: z.number().int().positive('ID da instância é obrigatório'),
  contactId: z.number().int().positive('ID do contato é obrigatório'),
  direction: z.enum(['incoming', 'outgoing']),
  status: z.enum(['pending', 'sent', 'delivered', 'read', 'failed']),
  content: z.string().optional(),
});

// Tipos para inserção e seleção
export type WhatsAppApiConfig = typeof whatsappApiConfigs.$inferSelect;
export type InsertWhatsAppApiConfig = typeof whatsappApiConfigs.$inferInsert;

export type WhatsAppInstance = typeof whatsappInstances.$inferSelect;
export type InsertWhatsAppInstance = typeof whatsappInstances.$inferInsert;

export type WhatsAppMessage = typeof whatsappMessages.$inferSelect;
export type InsertWhatsAppMessage = typeof whatsappMessages.$inferInsert;