/**
 * Schema para as entidades do WhatsApp
 */
import { pgTable, serial, text, boolean, timestamp, integer, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Definição da tabela de templates
export const whatsappTemplates = pgTable('whatsapp_templates', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  schoolId: integer('school_id'),
  description: text('description'),
  content: text('content').notNull(),
  language: text('language').default('pt_BR'),
  category: text('category'),
  status: text('status', {
    enum: ['pending', 'approved', 'rejected']
  }).default('pending'),
  variables: jsonb('variables'),
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Schema Zod para validação e inserção de templates
export const whatsappTemplateSchema = createInsertSchema(whatsappTemplates, {
  name: z.string().min(1, 'Nome do template é obrigatório'),
  schoolId: z.number().optional(),
  description: z.string().optional(),
  content: z.string().min(1, 'Conteúdo do template é obrigatório'),
  language: z.string().optional(),
  category: z.string().optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  variables: z.any().optional(),
  active: z.boolean().optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

// Tipos TypeScript para os templates
export type WhatsappTemplate = typeof whatsappTemplates.$inferSelect;
export type InsertWhatsappTemplate = z.infer<typeof whatsappTemplateSchema>;

// Alias para manter compatibilidade com o código existente
export const insertWhatsappTemplateSchema = whatsappTemplateSchema;

// Tabela de instâncias do WhatsApp
export const whatsappInstances = pgTable('whatsapp_instances', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  instanceKey: text('instance_key').notNull().unique(),
  schoolId: integer('school_id'),
  phoneNumber: text('phone_number').notNull(),
  description: text('description'),
  status: text('status', {
    enum: ['connecting', 'connected', 'disconnected', 'qrcode', 'error']
  }).default('disconnected'),
  qrCode: text('qr_code'),
  active: boolean('active').default(true),
  settings: jsonb('settings'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Schema Zod para validação e inserção de instâncias
export const whatsappInstanceSchema = createInsertSchema(whatsappInstances, {
  name: z.string().min(1, 'Nome da instância é obrigatório'),
  instanceKey: z.string().min(1, 'Chave da instância é obrigatória'),
  schoolId: z.number().optional(),
  phoneNumber: z.string().min(1, 'Número de telefone é obrigatório'),
  description: z.string().optional(),
  status: z.enum(['connecting', 'connected', 'disconnected', 'qrcode', 'error']).optional(),
  qrCode: z.string().optional(),
  active: z.boolean().optional(),
  settings: z.any().optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

// Tipos TypeScript para as instâncias
export type WhatsappInstance = typeof whatsappInstances.$inferSelect;
export type InsertWhatsappInstance = z.infer<typeof whatsappInstanceSchema>;

// Tabela de contatos do WhatsApp
export const whatsappContacts = pgTable('whatsapp_contacts', {
  id: serial('id').primaryKey(),
  phoneNumber: text('phone_number').notNull(),
  name: text('name'),
  profileImage: text('profile_image'),
  isGroup: boolean('is_group').default(false),
  studentId: integer('student_id'),
  leadId: integer('lead_id'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Schema Zod para validação e inserção de contatos
export const whatsappContactSchema = createInsertSchema(whatsappContacts, {
  phoneNumber: z.string().min(1, 'Número de telefone é obrigatório'),
  name: z.string().optional(),
  profileImage: z.string().optional(),
  isGroup: z.boolean().optional(),
  studentId: z.number().optional(),
  leadId: z.number().optional(),
  metadata: z.any().optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

// Tipos TypeScript para os contatos
export type WhatsappContact = typeof whatsappContacts.$inferSelect;
export type InsertWhatsappContact = z.infer<typeof whatsappContactSchema>;

// Tabela de mensagens do WhatsApp
export const whatsappMessages = pgTable('whatsapp_messages', {
  id: serial('id').primaryKey(),
  instanceId: integer('instance_id').notNull(),
  contactId: integer('contact_id').notNull(),
  messageId: text('message_id'),
  status: text('status', { 
    enum: ['pending', 'sent', 'delivered', 'read', 'failed'] 
  }).default('pending'),
  direction: text('direction', { 
    enum: ['incoming', 'outgoing'] 
  }).notNull(),
  content: text('content'),
  metadata: jsonb('metadata'),
  mediaType: text('media_type'),
  mediaUrl: text('media_url'),
  mediaMimeType: text('media_mime_type'),
  mediaFilename: text('media_filename'),
  mediaCaption: text('media_caption'),
  forwardedFrom: text('forwarded_from'),
  replyTo: integer('reply_to'),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Schema Zod para validação e inserção de mensagens
export const whatsappMessageSchema = createInsertSchema(whatsappMessages, {
  instanceId: z.number(),
  contactId: z.number(),
  messageId: z.string().optional(),
  status: z.enum(['pending', 'sent', 'delivered', 'read', 'failed']).optional(),
  direction: z.enum(['incoming', 'outgoing']),
  content: z.string().optional(),
  metadata: z.any().optional(),
  mediaType: z.string().optional(),
  mediaUrl: z.string().optional(),
  mediaMimeType: z.string().optional(),
  mediaFilename: z.string().optional(),
  mediaCaption: z.string().optional(),
  forwardedFrom: z.string().optional(),
  replyTo: z.number().optional(),
  readAt: z.date().optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

// Tipos TypeScript para as mensagens
export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
export type InsertWhatsappMessage = z.infer<typeof whatsappMessageSchema>;