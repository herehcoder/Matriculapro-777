/**
 * Schema para as entidades relacionadas ao WhatsApp
 */
import { pgTable, serial, text, integer, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

/**
 * Tabela de instâncias do WhatsApp
 */
export const whatsappInstances = pgTable('whatsapp_instances', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  phone: text('phone'),
  schoolId: integer('school_id'),
  status: text('status').default('pending'),
  qrCode: text('qr_code'),
  qrCodeTimestamp: timestamp('qr_code_timestamp'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

/**
 * Tabela de contatos do WhatsApp
 */
export const whatsappContacts = pgTable('whatsapp_contacts', {
  id: serial('id').primaryKey(),
  instanceId: integer('instance_id').notNull(),
  waId: text('wa_id').notNull(),
  name: text('name'),
  phone: text('phone'),
  profileImage: text('profile_image'),
  isGroup: boolean('is_group').default(false),
  isBlocked: boolean('is_blocked').default(false),
  assignedUserId: integer('assigned_user_id'),
  studentId: integer('student_id'),
  leadId: integer('lead_id'),
  metadata: jsonb('metadata'),
  lastActivity: timestamp('last_activity'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

/**
 * Tabela de mensagens do WhatsApp
 */
export const whatsappMessages = pgTable('whatsapp_messages', {
  id: serial('id').primaryKey(),
  instanceId: integer('instance_id').notNull(),
  contactId: integer('contact_id').notNull(),
  content: text('content'),
  mediaType: text('media_type'),
  mediaUrl: text('media_url'),
  mediaMimeType: text('media_mime_type'),
  direction: text('direction').notNull().default('received'),
  status: text('status').notNull().default('pending'),
  externalId: text('external_id'),
  metadata: jsonb('metadata'),
  receivedAt: timestamp('received_at'),
  sentAt: timestamp('sent_at'),
  deliveredAt: timestamp('delivered_at'),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

/**
 * Tabela de templates de mensagens do WhatsApp
 */
export const whatsappTemplates = pgTable('whatsapp_templates', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id'),
  name: text('name').notNull(),
  type: text('type').notNull().default('text'),
  content: text('content').notNull(),
  variables: jsonb('variables'),
  isActive: boolean('is_active').default(true),
  createdBy: integer('created_by'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Schemas Zod para validação e inserção

export const insertWhatsappInstanceSchema = createInsertSchema(whatsappInstances, {
  key: z.string().min(1, 'Chave da instância é obrigatória'),
  name: z.string().min(1, 'Nome da instância é obrigatório'),
  phone: z.string().optional(),
  schoolId: z.number().optional(),
  status: z.string().optional(),
  qrCode: z.string().optional(),
  qrCodeTimestamp: z.date().optional(),
  metadata: z.any().optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertWhatsappContactSchema = createInsertSchema(whatsappContacts, {
  instanceId: z.number().min(1, 'ID da instância é obrigatório'),
  waId: z.string().min(1, 'ID do WhatsApp é obrigatório'),
  name: z.string().optional(),
  phone: z.string().optional(),
  profileImage: z.string().optional(),
  isGroup: z.boolean().optional(),
  isBlocked: z.boolean().optional(),
  assignedUserId: z.number().optional(),
  studentId: z.number().optional(),
  leadId: z.number().optional(),
  metadata: z.any().optional(),
  lastActivity: z.date().optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertWhatsappMessageSchema = createInsertSchema(whatsappMessages, {
  instanceId: z.number().min(1, 'ID da instância é obrigatório'),
  contactId: z.number().min(1, 'ID do contato é obrigatório'),
  content: z.string().optional(),
  mediaType: z.string().optional(),
  mediaUrl: z.string().optional(),
  mediaMimeType: z.string().optional(),
  direction: z.string().optional(),
  status: z.string().optional(),
  externalId: z.string().optional(),
  metadata: z.any().optional(),
  receivedAt: z.date().optional(),
  sentAt: z.date().optional(),
  deliveredAt: z.date().optional(),
  readAt: z.date().optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertWhatsappTemplateSchema = createInsertSchema(whatsappTemplates, {
  schoolId: z.number().optional(),
  name: z.string().min(1, 'Nome do template é obrigatório'),
  type: z.string().optional(),
  content: z.string().min(1, 'Conteúdo do template é obrigatório'),
  variables: z.any().optional(),
  isActive: z.boolean().optional(),
  createdBy: z.number().optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

// Tipos TypeScript para as entidades

export type WhatsappInstance = typeof whatsappInstances.$inferSelect;
export type InsertWhatsappInstance = z.infer<typeof insertWhatsappInstanceSchema>;

export type WhatsappContact = typeof whatsappContacts.$inferSelect;
export type InsertWhatsappContact = z.infer<typeof insertWhatsappContactSchema>;

export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
export type InsertWhatsappMessage = z.infer<typeof insertWhatsappMessageSchema>;

export type WhatsappTemplate = typeof whatsappTemplates.$inferSelect;
export type InsertWhatsappTemplate = z.infer<typeof insertWhatsappTemplateSchema>;