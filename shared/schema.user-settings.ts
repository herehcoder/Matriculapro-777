import { pgTable, serial, integer, jsonb, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

/**
 * Tabela de configurações de usuário
 * Armazena todas as configurações pessoais, preferências e configurações de segurança dos usuários
 */
export const userSettings = pgTable('user_settings', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().unique(),
  
  // Preferências de notificações
  notifications: jsonb('notifications').$type<{
    email: boolean;
    push: boolean;
    sms: boolean;
    whatsapp: boolean;
  }>(),
  
  // Preferências de aparência
  appearance: jsonb('appearance').$type<{
    theme: 'light' | 'dark' | 'system';
    fontSize: number;
    compactMode: boolean;
  }>(),
  
  // Configurações de segurança
  security: jsonb('security').$type<{
    loginNotifications: boolean;
    sessionTimeout: number;
  }>(),
  
  // Configurações de autenticação em dois fatores
  twoFactorEnabled: boolean('two_factor_enabled').default(false),
  twoFactorSecret: text('two_factor_secret'),
  backupCodes: jsonb('backup_codes').$type<string[]>(),
  
  // Metadados
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Schema Zod para validação
export const userSettingsSchema = createInsertSchema(userSettings, {
  notifications: z.object({
    email: z.boolean().optional(),
    push: z.boolean().optional(),
    sms: z.boolean().optional(),
    whatsapp: z.boolean().optional(),
  }).optional(),
  
  appearance: z.object({
    theme: z.enum(['light', 'dark', 'system']).optional(),
    fontSize: z.number().min(8).max(24).optional(),
    compactMode: z.boolean().optional(),
  }).optional(),
  
  security: z.object({
    loginNotifications: z.boolean().optional(),
    sessionTimeout: z.number().min(5).max(1440).optional(),
  }).optional(),
  
  twoFactorEnabled: z.boolean().optional(),
  twoFactorSecret: z.string().optional(),
  backupCodes: z.array(z.string()).optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

// Tipos TypeScript
export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = z.infer<typeof userSettingsSchema>;