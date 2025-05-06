import { pgTable, text, serial, integer, boolean, timestamp, json, varchar, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enum para tipos de sistemas legados
export const legacySystemTypeEnum = pgEnum('legacy_system_type', [
  'educational_erp', 
  'crm', 
  'accounting', 
  'academic_management', 
  'other'
]);

// Enum para status dos endpoints de integração
export const legacyEndpointStatusEnum = pgEnum('legacy_endpoint_status', [
  'active', 
  'inactive', 
  'error', 
  'maintenance'
]);

// Enum para direção da sincronização
export const syncDirectionEnum = pgEnum('sync_direction', [
  'import',  // Do sistema legado para o EduMatrik
  'export',  // Do EduMatrik para o sistema legado
  'bidirectional' // Em ambas direções
]);

// Enum para estratégia de mapeamento
export const mappingStrategyEnum = pgEnum('mapping_strategy', [
  'direct',      // Mapeamento direto campo-a-campo
  'transform',   // Transformação dos dados durante a sincronização
  'composite'    // Combinação de múltiplos campos
]);

// Tabela de sistemas legados integrados
export const legacySystems = pgTable('legacy_systems', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id').notNull().references(() => import('./schema').schools.id),
  name: text('name').notNull(),
  systemType: legacySystemTypeEnum('system_type').notNull(),
  description: text('description'),
  baseUrl: text('base_url'),
  username: text('username'),
  password: text('password'),
  apiKey: text('api_key'),
  apiSecret: text('api_secret'),
  authType: text('auth_type').notNull().default('apikey'), // apikey, oauth, basic, custom
  connectionSettings: json('connection_settings'),
  active: boolean('active').default(true),
  lastSyncAt: timestamp('last_sync_at'),
  syncStatus: text('sync_status').default('pending'),
  errorCount: integer('error_count').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Tabela de endpoints por sistema legado
export const legacyEndpoints = pgTable('legacy_endpoints', {
  id: serial('id').primaryKey(),
  legacySystemId: integer('legacy_system_id').notNull().references(() => legacySystems.id),
  name: text('name').notNull(),
  endpoint: text('endpoint').notNull(),
  method: text('method').notNull().default('GET'),
  description: text('description'),
  requestTemplate: json('request_template'), // Template para construir requisições
  responseTemplate: json('response_template'), // Template para interpretar respostas
  headers: json('headers'),
  requiresAuth: boolean('requires_auth').default(true),
  rateLimitPerMinute: integer('rate_limit_per_minute'),
  status: legacyEndpointStatusEnum('status').default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Tabela para mapeamento de dados entre sistemas
export const legacyDataMappings = pgTable('legacy_data_mappings', {
  id: serial('id').primaryKey(),
  legacySystemId: integer('legacy_system_id').notNull().references(() => legacySystems.id),
  edumatrikEntity: text('edumatrik_entity').notNull(), // 'student', 'course', 'enrollment', etc.
  legacyEntity: text('legacy_entity').notNull(), // Nome da entidade no sistema legado
  mappingDirection: syncDirectionEnum('mapping_direction').notNull(),
  mappings: json('mappings').notNull(), // Mapeamento de campos entre os sistemas
  transformationRules: json('transformation_rules'), // Regras de transformação
  primaryKeyMapping: json('primary_key_mapping').notNull(), // Como identificar registros correspondentes
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Tabela para histórico de sincronização
export const legacySyncHistory = pgTable('legacy_sync_history', {
  id: serial('id').primaryKey(),
  legacySystemId: integer('legacy_system_id').notNull().references(() => legacySystems.id),
  entityType: text('entity_type').notNull(), // Tipo de entidade sincronizada
  direction: syncDirectionEnum('direction').notNull(),
  startedAt: timestamp('started_at').notNull(),
  completedAt: timestamp('completed_at'),
  status: text('status').notNull().default('in_progress'), // 'in_progress', 'completed', 'failed'
  recordsProcessed: integer('records_processed').default(0),
  recordsSucceeded: integer('records_succeeded').default(0),
  recordsFailed: integer('records_failed').default(0),
  errorDetails: json('error_details'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Tabela para armazenamento de IDs mapeados entre sistemas
export const legacyIdMappings = pgTable('legacy_id_mappings', {
  id: serial('id').primaryKey(),
  legacySystemId: integer('legacy_system_id').notNull().references(() => legacySystems.id),
  edumatrikEntity: text('edumatrik_entity').notNull(), // 'student', 'course', etc.
  edumatrikId: text('edumatrik_id').notNull(), // ID no sistema EduMatrik
  legacyEntity: text('legacy_entity').notNull(), // Nome da entidade no sistema legado
  legacyId: text('legacy_id').notNull(), // ID no sistema legado
  lastSyncAt: timestamp('last_sync_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Schemas para inserção de dados usando Zod
export const insertLegacySystemSchema = createInsertSchema(legacySystems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastSyncAt: true
});

export const insertLegacyEndpointSchema = createInsertSchema(legacyEndpoints).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertLegacyDataMappingSchema = createInsertSchema(legacyDataMappings).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertLegacySyncHistorySchema = createInsertSchema(legacySyncHistory).omit({
  id: true,
  createdAt: true,
  completedAt: true
});

export const insertLegacyIdMappingSchema = createInsertSchema(legacyIdMappings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastSyncAt: true
});

// Tipos para uso no código
export type LegacySystem = typeof legacySystems.$inferSelect;
export type InsertLegacySystem = z.infer<typeof insertLegacySystemSchema>;

export type LegacyEndpoint = typeof legacyEndpoints.$inferSelect;
export type InsertLegacyEndpoint = z.infer<typeof insertLegacyEndpointSchema>;

export type LegacyDataMapping = typeof legacyDataMappings.$inferSelect;
export type InsertLegacyDataMapping = z.infer<typeof insertLegacyDataMappingSchema>;

export type LegacySyncHistory = typeof legacySyncHistory.$inferSelect;
export type InsertLegacySyncHistory = z.infer<typeof insertLegacySyncHistorySchema>;

export type LegacyIdMapping = typeof legacyIdMappings.$inferSelect;
export type InsertLegacyIdMapping = z.infer<typeof insertLegacyIdMappingSchema>;