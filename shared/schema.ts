import { pgTable, text, serial, integer, boolean, timestamp, varchar, primaryKey, json, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum('user_role', ['admin', 'school', 'attendant', 'student']);
export const enrollmentStatusEnum = pgEnum('enrollment_status', ['started', 'personal_info', 'course_info', 'payment', 'completed', 'abandoned']);
export const leadSourceEnum = pgEnum('lead_source', ['whatsapp', 'website', 'social_media', 'referral', 'other']);
export const leadStatusEnum = pgEnum('lead_status', ['new', 'contacted', 'interested', 'converted', 'lost']);
export const chatStatusEnum = pgEnum('chat_status', ['active', 'closed']);
export const notificationTypeEnum = pgEnum('notification_type', ['message', 'enrollment', 'lead', 'system', 'payment']);
export const messageStatusEnum = pgEnum('message_status', ['sent', 'delivered', 'read']);

// Users table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  fullName: text('full_name').notNull(),
  role: userRoleEnum('role').notNull(),
  schoolId: integer('school_id').references(() => schools.id),
  phone: text('phone'),
  profileImage: text('profile_image'),
  supabaseId: text('supabase_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Schools table
export const schools = pgTable('schools', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  logo: text('logo'),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  address: text('address'),
  city: text('city').notNull(),
  state: text('state').notNull(),
  zipCode: text('zip_code'),
  mainCourse: text('main_course'),
  description: text('description'),
  whatsappNumber: text('whatsapp_number'),
  whatsappEnabled: boolean('whatsapp_enabled').default(false),
  apiKey: text('api_key'),
  webhookUrl: text('webhook_url'),
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Attendants table
export const attendants = pgTable('attendants', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  schoolId: integer('school_id').notNull().references(() => schools.id),
  department: text('department'),
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Students table
export const students = pgTable('students', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  schoolId: integer('school_id').notNull().references(() => schools.id),
  cpf: text('cpf'),
  birthdate: timestamp('birthdate'),
  gender: text('gender'),
  address: text('address'),
  city: text('city'),
  state: text('state'),
  zipCode: text('zip_code'),
  parentName: text('parent_name'),
  parentRelationship: text('parent_relationship'),
  parentEmail: text('parent_email'),
  parentPhone: text('parent_phone'),
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Leads table
export const leads = pgTable('leads', {
  id: serial('id').primaryKey(),
  fullName: text('full_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  schoolId: integer('school_id').notNull().references(() => schools.id),
  source: leadSourceEnum('source').default('website'),
  status: leadStatusEnum('status').default('new'),
  notes: text('notes'),
  utmSource: text('utm_source'),
  utmMedium: text('utm_medium'),
  utmCampaign: text('utm_campaign'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Courses table
export const courses = pgTable('courses', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  schoolId: integer('school_id').notNull().references(() => schools.id),
  price: integer('price'), // stored in cents
  duration: text('duration'),
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Questions table for form questions
export const questions = pgTable('questions', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id').notNull().references(() => schools.id),
  question: text('question').notNull(),
  questionType: text('question_type').notNull(), // text, select, radio, etc.
  options: json('options'), // For select, radio, etc
  required: boolean('required').default(false),
  order: integer('order').notNull(),
  formSection: text('form_section').notNull(), // personal_info, course_info, payment
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Answers table for form answers
export const answers = pgTable('answers', {
  id: serial('id').primaryKey(),
  questionId: integer('question_id').notNull().references(() => questions.id),
  enrollmentId: integer('enrollment_id').notNull().references(() => enrollments.id),
  answer: text('answer'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Chat history table
export const chatHistory = pgTable('chat_history', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id').notNull().references(() => schools.id),
  userId: integer('user_id').references(() => users.id),
  leadId: integer('lead_id').references(() => leads.id),
  message: text('message').notNull(),
  sentByUser: boolean('sent_by_user').notNull(),
  status: chatStatusEnum('status').default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Enrollments table (Funnel stages)
export const enrollments = pgTable('enrollments', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id').notNull().references(() => schools.id),
  studentId: integer('student_id').references(() => students.id),
  leadId: integer('lead_id').references(() => leads.id),
  courseId: integer('course_id').references(() => courses.id),
  status: enrollmentStatusEnum('status').default('started'),
  personalInfoCompleted: boolean('personal_info_completed').default(false),
  courseInfoCompleted: boolean('course_info_completed').default(false),
  paymentCompleted: boolean('payment_completed').default(false),
  paymentAmount: integer('payment_amount'), // stored in cents
  paymentMethod: text('payment_method'),
  paymentReference: text('payment_reference'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// WhatsApp messages table
export const whatsappMessages = pgTable('whatsapp_messages', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id').notNull().references(() => schools.id),
  leadId: integer('lead_id').references(() => leads.id),
  studentId: integer('student_id').references(() => students.id),
  message: text('message').notNull(),
  direction: text('direction').notNull(), // inbound or outbound
  status: text('status').notNull(), // sent, delivered, read, failed
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Metrics table for statistics
export const metrics = pgTable('metrics', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id').notNull().references(() => schools.id),
  metricType: text('metric_type').notNull(), // visits, leads, conversions, etc.
  metricValue: integer('metric_value').notNull(),
  source: text('source'),
  date: timestamp('date').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Real-time notifications table
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  schoolId: integer('school_id').references(() => schools.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: notificationTypeEnum('type').notNull(),
  read: boolean('read').default(false),
  data: json('data'), // Additional data related to notification
  relatedId: integer('related_id'), // ID of the related resource (enrollment, lead, etc.)
  relatedType: text('related_type'), // Type of the related resource
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Real-time messages table
export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  senderId: integer('sender_id').notNull().references(() => users.id),
  receiverId: integer('receiver_id').notNull().references(() => users.id),
  schoolId: integer('school_id').references(() => schools.id),
  content: text('content').notNull(),
  status: messageStatusEnum('status').default('sent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Schema for inserting a new user
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

// Schema for inserting a new school
export const insertSchoolSchema = createInsertSchema(schools).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

// Schema for inserting a new student
export const insertStudentSchema = createInsertSchema(students).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

// Schema for inserting a new lead
export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

// Schema for inserting a new enrollment
export const insertEnrollmentSchema = createInsertSchema(enrollments).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

// Schema for inserting a new course
export const insertCourseSchema = createInsertSchema(courses).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

// Schema for inserting a new question
export const insertQuestionSchema = createInsertSchema(questions).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

// Schema for inserting a new answer
export const insertAnswerSchema = createInsertSchema(answers).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

// Schema for inserting a new chat message
export const insertChatHistorySchema = createInsertSchema(chatHistory).omit({
  id: true,
  createdAt: true
});

// Schema for inserting a new WhatsApp message
export const insertWhatsappMessageSchema = createInsertSchema(whatsappMessages).omit({
  id: true,
  createdAt: true
});

// Schema for inserting a new metric
export const insertMetricSchema = createInsertSchema(metrics).omit({
  id: true,
  createdAt: true
});

// Schema for inserting a new notification
export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true
});

// Schema for inserting a new message
export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type School = typeof schools.$inferSelect;
export type InsertSchool = z.infer<typeof insertSchoolSchema>;

export type Attendant = typeof attendants.$inferSelect;
export type Student = typeof students.$inferSelect;
export type InsertStudent = z.infer<typeof insertStudentSchema>;

export type Lead = typeof leads.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;

export type Course = typeof courses.$inferSelect;
export type InsertCourse = z.infer<typeof insertCourseSchema>;

export type Question = typeof questions.$inferSelect;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;

export type Answer = typeof answers.$inferSelect;
export type InsertAnswer = z.infer<typeof insertAnswerSchema>;

export type ChatMessage = typeof chatHistory.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatHistorySchema>;

export type Enrollment = typeof enrollments.$inferSelect;
export type InsertEnrollment = z.infer<typeof insertEnrollmentSchema>;

export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
export type InsertWhatsappMessage = z.infer<typeof insertWhatsappMessageSchema>;

export type Metric = typeof metrics.$inferSelect;
export type InsertMetric = z.infer<typeof insertMetricSchema>;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
