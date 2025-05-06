import { pgTable, serial, integer, varchar, text, timestamp, boolean, json } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * Tabela de instâncias do WhatsApp
 */
export const whatsappInstances = pgTable('whatsapp_instances', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id').notNull().references(() => 'schools.id'),
  instanceName: text('instance_name').notNull(),
  status: text('status').default('disconnected'),
  qrCode: text('qr_code'),
  webhookUrl: text('webhook_url'),
  webhookSecret: text('webhook_secret'),
  lastConnected: timestamp('last_connected'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

/**
 * Tabela de contatos do WhatsApp
 */
export const whatsappContacts = pgTable('whatsapp_contacts', {
  id: serial('id').primaryKey(),
  instanceId: integer('instance_id').notNull().references(() => whatsappInstances.id),
  phone: varchar('phone', { length: 50 }).notNull(),
  name: varchar('name', { length: 255 }),
  studentId: integer('student_id').references(() => 'users.id'),
  leadId: integer('lead_id').references(() => 'leads.id'),
  metadata: json('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

/**
 * Tabela de mensagens do WhatsApp
 */
export const whatsappMessages = pgTable('whatsapp_messages', {
  id: serial('id').primaryKey(),
  instanceId: integer('instance_id').notNull().references(() => whatsappInstances.id),
  contactId: integer('contact_id').notNull().references(() => whatsappContacts.id),
  content: text('content'),
  direction: varchar('direction', { length: 20 }).notNull().default('outbound'),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  externalId: varchar('external_id', { length: 255 }),
  metadata: json('metadata'),
  sentAt: timestamp('sent_at'),
  deliveredAt: timestamp('delivered_at'),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

/**
 * Tabela de configurações da API do WhatsApp
 */
export const whatsappApiConfigs = pgTable('whatsapp_api_configs', {
  id: serial('id').primaryKey(),
  baseUrl: varchar('base_url', { length: 255 }).notNull(),
  apiKey: varchar('api_key', { length: 255 }).notNull(),
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

/**
 * Tabela de mensagens automáticas do WhatsApp
 */
export const whatsappTemplates = pgTable('whatsapp_templates', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id').references(() => 'schools.id'),
  name: varchar('name', { length: 255 }).notNull(),
  content: text('content').notNull(),
  variables: json('variables'),
  category: varchar('category', { length: 50 }),
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Criar Zod schemas para validação
export const insertWhatsappInstanceSchema = createInsertSchema(whatsappInstances, {
  instanceName: z.string().min(3, 'O nome da instância deve ter pelo menos 3 caracteres'),
  schoolId: z.number().int().positive('ID da escola deve ser um número positivo')
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertWhatsappContactSchema = createInsertSchema(whatsappContacts, {
  phone: z.string().min(8, 'Telefone inválido').max(20, 'Telefone inválido'),
  instanceId: z.number().int().positive('ID da instância deve ser um número positivo')
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertWhatsappMessageSchema = createInsertSchema(whatsappMessages, {
  instanceId: z.number().int().positive('ID da instância deve ser um número positivo'),
  contactId: z.number().int().positive('ID do contato deve ser um número positivo'),
  content: z.string().min(1, 'A mensagem não pode estar vazia')
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertWhatsappApiConfigSchema = createInsertSchema(whatsappApiConfigs, {
  baseUrl: z.string().url('URL da API inválida'),
  apiKey: z.string().min(5, 'API Key inválida')
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertWhatsappTemplateSchema = createInsertSchema(whatsappTemplates, {
  name: z.string().min(3, 'O nome deve ter pelo menos 3 caracteres'),
  content: z.string().min(5, 'O conteúdo deve ter pelo menos 5 caracteres'),
  schoolId: z.number().int().positive('ID da escola deve ser um número positivo').optional()
}).omit({ id: true, createdAt: true, updatedAt: true });

// Tipos TypeScript
export type WhatsappInstance = typeof whatsappInstances.$inferSelect;
export type InsertWhatsappInstance = z.infer<typeof insertWhatsappInstanceSchema>;

export type WhatsappContact = typeof whatsappContacts.$inferSelect;
export type InsertWhatsappContact = z.infer<typeof insertWhatsappContactSchema>;

export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
export type InsertWhatsappMessage = z.infer<typeof insertWhatsappMessageSchema>;

export type WhatsappApiConfig = typeof whatsappApiConfigs.$inferSelect;
export type InsertWhatsappApiConfig = z.infer<typeof insertWhatsappApiConfigSchema>;

export type WhatsappTemplate = typeof whatsappTemplates.$inferSelect;
export type InsertWhatsappTemplate = z.infer<typeof insertWhatsappTemplateSchema>;