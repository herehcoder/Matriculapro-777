import { pgTable, text, serial, integer, boolean, timestamp, json, varchar, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enum para tipos de sistemas escolares integrados
export const schoolSystemTypeEnum = pgEnum('school_system_type', [
  'academic_management',  // Sistemas de gestão acadêmica
  'financial',            // Sistemas financeiros
  'library',              // Sistemas de biblioteca
  'attendance',           // Sistemas de presença
  'grading',              // Sistemas de notas
  'lms',                  // Learning Management Systems (Ex: Moodle, Canvas)
  'erp',                  // Enterprise Resource Planning
  'communication',        // Sistemas de comunicação
  'other'                 // Outros sistemas
]);

// Enum para status da integração
export const integrationStatusEnum = pgEnum('integration_status', [
  'active',
  'paused',
  'error',
  'configuring',
  'inactive'
]);

// Enum para tipo de sincronização
export const syncTypeEnum = pgEnum('sync_type', [
  'realtime',    // Sincronização em tempo real via webhooks
  'scheduled',   // Sincronização agendada
  'manual'       // Sincronização manual
]);

// Tabela de sistemas escolares integrados
export const schoolSystems = pgTable('school_systems', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id').notNull().references(() => import('./schema').schools.id),
  name: text('name').notNull(),
  systemType: schoolSystemTypeEnum('system_type').notNull(),
  description: text('description'),
  vendor: text('vendor'),
  version: text('version'),
  apiEndpoint: text('api_endpoint'),
  apiKey: text('api_key'),
  apiSecret: text('api_secret'),
  authToken: text('auth_token'),
  refreshToken: text('refresh_token'),
  tokenExpiresAt: timestamp('token_expires_at'),
  webhookEndpoint: text('webhook_endpoint'),
  webhookSecret: text('webhook_secret'),
  connectionSettings: json('connection_settings'),
  status: integrationStatusEnum('status').default('configuring'),
  lastSyncAt: timestamp('last_sync_at'),
  errorCount: integer('error_count').default(0),
  lastError: text('last_error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Tabela para os módulos integrados em cada sistema
export const schoolSystemModules = pgTable('school_system_modules', {
  id: serial('id').primaryKey(),
  schoolSystemId: integer('school_system_id').notNull().references(() => schoolSystems.id),
  moduleName: text('module_name').notNull(),
  moduleKey: text('module_key').notNull(),
  description: text('description'),
  active: boolean('active').default(true),
  permissions: json('permissions'), // Permissões de acesso
  settings: json('settings'),
  syncType: syncTypeEnum('sync_type').default('scheduled'),
  syncSchedule: text('sync_schedule'), // Expressão cron para agendamento
  lastSyncAt: timestamp('last_sync_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Tabela para mapear campos entre sistemas
export const schoolSystemFieldMappings = pgTable('school_system_field_mappings', {
  id: serial('id').primaryKey(),
  schoolSystemId: integer('school_system_id').notNull().references(() => schoolSystems.id),
  moduleKey: text('module_key').notNull(),
  edumatrikField: text('edumatrik_field').notNull(),
  externalField: text('external_field').notNull(),
  transformationFunction: text('transformation_function'),
  isRequired: boolean('is_required').default(false),
  isPrimaryKey: boolean('is_primary_key').default(false),
  validationRules: json('validation_rules'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Tabela para logs de sincronização
export const schoolSystemSyncLogs = pgTable('school_system_sync_logs', {
  id: serial('id').primaryKey(),
  schoolSystemId: integer('school_system_id').notNull().references(() => schoolSystems.id),
  moduleKey: text('module_key').notNull(),
  operation: text('operation').notNull(), // 'import', 'export', 'update', 'delete'
  startedAt: timestamp('started_at').notNull(),
  completedAt: timestamp('completed_at'),
  status: text('status').notNull(), // 'success', 'partial', 'failed'
  recordsProcessed: integer('records_processed').default(0),
  recordsSucceeded: integer('records_succeeded').default(0),
  recordsFailed: integer('records_failed').default(0),
  errorDetails: json('error_details'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Tabela para webhooks recebidos
export const schoolSystemWebhooks = pgTable('school_system_webhooks', {
  id: serial('id').primaryKey(),
  schoolSystemId: integer('school_system_id').notNull().references(() => schoolSystems.id),
  event: text('event').notNull(),
  payload: json('payload').notNull(),
  status: text('status').notNull().default('received'), // 'received', 'processed', 'failed'
  processedAt: timestamp('processed_at'),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Tabela para armazenar tarefas de sincronização pendentes
export const schoolSystemSyncTasks = pgTable('school_system_sync_tasks', {
  id: serial('id').primaryKey(),
  schoolSystemId: integer('school_system_id').notNull().references(() => schoolSystems.id),
  moduleKey: text('module_key').notNull(),
  operation: text('operation').notNull(), // 'import', 'export', 'update', 'delete'
  priority: integer('priority').default(5), // 1-10, maior número = maior prioridade
  status: text('status').notNull().default('pending'), // 'pending', 'in_progress', 'completed', 'failed'
  dataId: text('data_id'), // ID do registro a sincronizar, se aplicável
  dataPayload: json('data_payload'), // Dados a sincronizar
  scheduledFor: timestamp('scheduled_for'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  attempts: integer('attempts').default(0),
  maxAttempts: integer('max_attempts').default(3),
  lastError: text('last_error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Schemas para inserção de dados usando Zod
export const insertSchoolSystemSchema = createInsertSchema(schoolSystems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastSyncAt: true,
  tokenExpiresAt: true
});

export const insertSchoolSystemModuleSchema = createInsertSchema(schoolSystemModules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastSyncAt: true
});

export const insertSchoolSystemFieldMappingSchema = createInsertSchema(schoolSystemFieldMappings).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertSchoolSystemSyncLogSchema = createInsertSchema(schoolSystemSyncLogs).omit({
  id: true,
  createdAt: true,
  completedAt: true
});

export const insertSchoolSystemWebhookSchema = createInsertSchema(schoolSystemWebhooks).omit({
  id: true,
  createdAt: true,
  processedAt: true
});

export const insertSchoolSystemSyncTaskSchema = createInsertSchema(schoolSystemSyncTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  startedAt: true,
  completedAt: true
});

// Tipos para uso no código
export type SchoolSystem = typeof schoolSystems.$inferSelect;
export type InsertSchoolSystem = z.infer<typeof insertSchoolSystemSchema>;

export type SchoolSystemModule = typeof schoolSystemModules.$inferSelect;
export type InsertSchoolSystemModule = z.infer<typeof insertSchoolSystemModuleSchema>;

export type SchoolSystemFieldMapping = typeof schoolSystemFieldMappings.$inferSelect;
export type InsertSchoolSystemFieldMapping = z.infer<typeof insertSchoolSystemFieldMappingSchema>;

export type SchoolSystemSyncLog = typeof schoolSystemSyncLogs.$inferSelect;
export type InsertSchoolSystemSyncLog = z.infer<typeof insertSchoolSystemSyncLogSchema>;

export type SchoolSystemWebhook = typeof schoolSystemWebhooks.$inferSelect;
export type InsertSchoolSystemWebhook = z.infer<typeof insertSchoolSystemWebhookSchema>;

export type SchoolSystemSyncTask = typeof schoolSystemSyncTasks.$inferSelect;
export type InsertSchoolSystemSyncTask = z.infer<typeof insertSchoolSystemSyncTaskSchema>;