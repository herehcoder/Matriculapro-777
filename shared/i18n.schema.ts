import { pgTable, text, serial, integer, boolean, timestamp, json, varchar, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enum para o status de tradução
export const translationStatusEnum = pgEnum('translation_status', [
  'pending',     // Tradução pendente
  'translated',  // Traduzido mas não revisado
  'reviewed',    // Traduzido e revisado
  'approved',    // Aprovado para uso em produção
  'rejected'     // Rejeitado, precisa de nova tradução
]);

// Enum para fonte de tradução
export const translationSourceEnum = pgEnum('translation_source', [
  'manual',      // Tradução feita manualmente
  'automatic',   // Tradução automática (via API)
  'imported'     // Importado de arquivo de tradução
]);

// Tabela de idiomas suportados
export const languages = pgTable('languages', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(), // Código do idioma (ISO 639-1)
  name: text('name').notNull(),
  nativeName: text('native_name').notNull(),
  countryCode: text('country_code'), // Código do país (ISO 3166-1)
  direction: text('direction').notNull().default('ltr'), // 'ltr' ou 'rtl'
  isDefault: boolean('is_default').default(false),
  isActive: boolean('is_active').default(true),
  fallbackLanguageCode: text('fallback_language_code'), // Idioma fallback se tradução não existir
  dateFormat: text('date_format'),
  timeFormat: text('time_format'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Tabela de configurações de idioma por escola
export const schoolLanguages = pgTable('school_languages', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id').notNull().references(() => import('./schema').schools.id),
  languageId: integer('language_id').notNull().references(() => languages.id),
  isDefault: boolean('is_default').default(false),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Tabela de chaves de tradução (identificadores)
export const translationKeys = pgTable('translation_keys', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  defaultText: text('default_text').notNull(),
  description: text('description'),
  tags: text('tags').array(),
  context: text('context'),
  isSystem: boolean('is_system').default(false), // Se é uma chave do sistema ou personalizada
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Tabela de traduções
export const translations = pgTable('translations', {
  id: serial('id').primaryKey(),
  keyId: integer('key_id').notNull().references(() => translationKeys.id),
  languageId: integer('language_id').notNull().references(() => languages.id),
  schoolId: integer('school_id').references(() => import('./schema').schools.id), // Null para traduções globais
  text: text('text').notNull(),
  status: translationStatusEnum('status').default('translated'),
  source: translationSourceEnum('source').default('manual'),
  lastReviewedAt: timestamp('last_reviewed_at'),
  reviewerId: integer('reviewer_id').references(() => import('./schema').users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Tabela para preferências de idioma do usuário
export const userLanguagePreferences = pgTable('user_language_preferences', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => import('./schema').users.id),
  languageId: integer('language_id').notNull().references(() => languages.id),
  dateFormat: text('date_format'),
  timeFormat: text('time_format'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Tabela para acompanhar a atividade de tradução
export const translationActivity = pgTable('translation_activity', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => import('./schema').users.id),
  translationId: integer('translation_id').notNull().references(() => translations.id),
  action: text('action').notNull(), // 'create', 'update', 'review', 'approve', 'reject'
  oldText: text('old_text'),
  newText: text('new_text'),
  oldStatus: translationStatusEnum('old_status'),
  newStatus: translationStatusEnum('new_status'),
  comments: text('comments'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Tabela para armazenar traduções automáticas em lote
export const translationJobs = pgTable('translation_jobs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => import('./schema').users.id),
  sourceLanguageId: integer('source_language_id').notNull().references(() => languages.id),
  targetLanguageId: integer('target_language_id').notNull().references(() => languages.id),
  status: text('status').notNull().default('pending'), // 'pending', 'in_progress', 'completed', 'failed'
  totalKeys: integer('total_keys').default(0),
  processedKeys: integer('processed_keys').default(0),
  successKeys: integer('success_keys').default(0),
  failedKeys: integer('failed_keys').default(0),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Schemas para inserção de dados usando Zod
export const insertLanguageSchema = createInsertSchema(languages).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertSchoolLanguageSchema = createInsertSchema(schoolLanguages).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertTranslationKeySchema = createInsertSchema(translationKeys).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertTranslationSchema = createInsertSchema(translations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastReviewedAt: true
});

export const insertUserLanguagePreferenceSchema = createInsertSchema(userLanguagePreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertTranslationActivitySchema = createInsertSchema(translationActivity).omit({
  id: true,
  createdAt: true
});

export const insertTranslationJobSchema = createInsertSchema(translationJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  startedAt: true,
  completedAt: true
});

// Tipos para uso no código
export type Language = typeof languages.$inferSelect;
export type InsertLanguage = z.infer<typeof insertLanguageSchema>;

export type SchoolLanguage = typeof schoolLanguages.$inferSelect;
export type InsertSchoolLanguage = z.infer<typeof insertSchoolLanguageSchema>;

export type TranslationKey = typeof translationKeys.$inferSelect;
export type InsertTranslationKey = z.infer<typeof insertTranslationKeySchema>;

export type Translation = typeof translations.$inferSelect;
export type InsertTranslation = z.infer<typeof insertTranslationSchema>;

export type UserLanguagePreference = typeof userLanguagePreferences.$inferSelect;
export type InsertUserLanguagePreference = z.infer<typeof insertUserLanguagePreferenceSchema>;

export type TranslationActivity = typeof translationActivity.$inferSelect;
export type InsertTranslationActivity = z.infer<typeof insertTranslationActivitySchema>;

export type TranslationJob = typeof translationJobs.$inferSelect;
export type InsertTranslationJob = z.infer<typeof insertTranslationJobSchema>;