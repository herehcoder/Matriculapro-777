/**
 * Arquivo de definição do schema do banco de dados
 * 
 * Este arquivo contém as definições das tabelas do banco de dados, schemas Zod
 * para validação e tipos TypeScript correspondentes.
 */
import { pgTable, serial, text, boolean, timestamp, integer, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Re-export das entidades de configurações de usuário
export * from './schema.user-settings';

// Tabela de notificações
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type', { 
    enum: ['message', 'enrollment', 'lead', 'system', 'payment'] 
  }).notNull(),
  userId: integer('user_id').notNull(),
  schoolId: integer('school_id'),
  read: boolean('read').default(false),
  data: jsonb('data'),
  relatedId: integer('related_id'),
  relatedType: text('related_type'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Schema Zod para notificações
export const notificationSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Título é obrigatório'),
  message: z.string().min(1, 'Mensagem é obrigatória'),
  type: z.enum(['message', 'enrollment', 'lead', 'system', 'payment']),
  userId: z.number(),
  schoolId: z.number().optional(),
  read: z.boolean().optional(),
  data: z.any().optional(),
  relatedId: z.number().optional(),
  relatedType: z.string().optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

// Tipos TypeScript para notificações
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof notificationSchema>;

// Tabela de mensagens
export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  content: text('content').notNull(),
  senderId: integer('sender_id').notNull(),
  receiverId: integer('receiver_id').notNull(),
  status: text('status', { 
    enum: ['sent', 'delivered', 'read'] 
  }).default('sent'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Schema Zod para mensagens
export const messageSchema = createInsertSchema(messages, {
  content: z.string().min(1, 'Conteúdo é obrigatório'),
  senderId: z.number(),
  receiverId: z.number(),
  status: z.enum(['sent', 'delivered', 'read']).optional(),
  metadata: z.any().optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

// Tipos TypeScript para mensagens
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof messageSchema>;

// Tabela de usuários
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  fullName: text('full_name').notNull(),
  role: text('role', { enum: ['admin', 'school', 'attendant', 'student'] }).notNull(),
  phone: text('phone'),
  schoolId: integer('school_id'),
  profileImage: text('profile_image'),
  supabaseId: text('supabase_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Schema Zod para usuários
export const userSchema = createInsertSchema(users, {
  username: z.string().min(3, 'Nome de usuário deve ter pelo menos 3 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  fullName: z.string().min(3, 'Nome completo deve ter pelo menos 3 caracteres'),
  role: z.enum(['admin', 'school', 'attendant', 'student']),
  phone: z.string().optional().nullable(),
  schoolId: z.number().optional().nullable(),
  profileImage: z.string().optional().nullable(),
  supabaseId: z.string().optional().nullable(),
}).omit({ id: true, createdAt: true, updatedAt: true });

// Tipos TypeScript
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof userSchema>;

// Tabela de escolas
export const schools = pgTable('schools', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  logoUrl: text('logo_url'),
  address: text('address'),
  city: text('city'),
  state: text('state'),
  zipCode: text('zip_code'),
  phone: text('phone'),
  email: text('email'),
  website: text('website'),
  active: boolean('active').default(true),
  settings: jsonb('settings'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Schema Zod para escolas
export const schoolSchema = createInsertSchema(schools, {
  name: z.string().min(3, 'Nome da escola deve ter pelo menos 3 caracteres'),
  logoUrl: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional(),
  website: z.string().optional(),
  active: z.boolean().optional(),
  settings: z.any().optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

// Tipos TypeScript
export type School = typeof schools.$inferSelect;
export type InsertSchool = z.infer<typeof schoolSchema>;

// Tabela de matrículas
export const enrollments = pgTable('enrollments', {
  id: serial('id').primaryKey(),
  studentId: integer('student_id').notNull(),
  schoolId: integer('school_id').notNull(),
  courseId: integer('course_id').notNull(),
  status: text('status', { 
    enum: ['pending', 'approved', 'rejected', 'canceled', 'completed'] 
  }).default('pending'),
  semester: text('semester'),
  year: text('year'),
  paymentStatus: text('payment_status', {
    enum: ['pending', 'paid', 'partial', 'overdue', 'canceled', 'refunded']
  }).default('pending'),
  documents: jsonb('documents'),
  metadata: jsonb('metadata'),
  createdById: integer('created_by_id'),
  updatedById: integer('updated_by_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Schema Zod para matrículas
export const enrollmentSchema = createInsertSchema(enrollments, {
  studentId: z.number(),
  schoolId: z.number(),
  courseId: z.number(),
  status: z.enum(['pending', 'approved', 'rejected', 'canceled', 'completed']).optional(),
  semester: z.string().optional(),
  year: z.string().optional(),
  paymentStatus: z.enum(['pending', 'paid', 'partial', 'overdue', 'canceled', 'refunded']).optional(),
  documents: z.array(z.any()).optional(),
  metadata: z.any().optional(),
  createdById: z.number().optional(),
  updatedById: z.number().optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

// Tipos TypeScript
export type Enrollment = typeof enrollments.$inferSelect;
export type InsertEnrollment = z.infer<typeof enrollmentSchema>;

// Tabela de documentos
export const documents = pgTable('documents', {
  id: serial('id').primaryKey(),
  enrollmentId: integer('enrollment_id'),
  studentId: integer('student_id').notNull(),
  type: text('type', {
    enum: ['id', 'address', 'diploma', 'transcripts', 'photo', 'other']
  }).notNull(),
  title: text('title').notNull(),
  description: text('description'),
  fileUrl: text('file_url').notNull(),
  mimeType: text('mime_type'),
  fileSize: integer('file_size'),
  status: text('status', {
    enum: ['pending', 'verified', 'rejected', 'expired']
  }).default('pending'),
  verifiedById: integer('verified_by_id'),
  verifiedAt: timestamp('verified_at'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Schema Zod para documentos
export const documentSchema = createInsertSchema(documents, {
  enrollmentId: z.number().optional(),
  studentId: z.number(),
  type: z.enum(['id', 'address', 'diploma', 'transcripts', 'photo', 'other']),
  title: z.string(),
  description: z.string().optional(),
  fileUrl: z.string(),
  mimeType: z.string().optional(),
  fileSize: z.number().optional(),
  status: z.enum(['pending', 'verified', 'rejected', 'expired']).optional(),
  verifiedById: z.number().optional(),
  verifiedAt: z.date().optional(),
  metadata: z.any().optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

// Tipos TypeScript
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof documentSchema>;