import {
  users, schools, attendants, students, leads, courses, questions, answers,
  chatHistory, enrollments, metrics, notifications, messages, passwordResetTokens, userSettings,
  type User, type InsertUser, type School, type InsertSchool,
  type Attendant, type Student, type InsertStudent, type Lead, type InsertLead,
  type Course, type InsertCourse, type Question, type InsertQuestion,
  type Answer, type InsertAnswer, type ChatMessage, type InsertChatMessage,
  type Enrollment, type InsertEnrollment, type Metric, type InsertMetric, 
  type Notification, type InsertNotification, type Message, type InsertMessage, 
  type PasswordResetToken, type InsertPasswordResetToken, type UserSettings, type InsertUserSettings
} from "@shared/schema";

// Importando os novos schemas do WhatsApp
import {
  whatsappInstances, whatsappContacts, whatsappMessages,
  type WhatsappInstance, type InsertWhatsappInstance,
  type WhatsappContact, type InsertWhatsappContact,
  type WhatsappMessage, type InsertWhatsappMessage
} from "../shared/whatsapp.schema";
import { db } from "./db";
import { eq, and, gte, lte, desc, asc, sql, or, lt } from "drizzle-orm";

// Interface for the storage
export interface IStorage {
  // User management
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<User>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  listUsers(limit?: number, offset?: number): Promise<User[]>;
  getAllUsers(): Promise<User[]>;
  getUsersBySchool(schoolId: number): Promise<User[]>;
  searchUsers(term: string): Promise<User[]>;
  searchUsersBySchool(term: string, schoolId: number): Promise<User[]>;
  countUsers(): Promise<number>;
  countUsersByRole(role: string): Promise<number>;
  
  // School management
  getSchool(id: number): Promise<School | undefined>;
  createSchool(school: InsertSchool): Promise<School>;
  updateSchool(id: number, school: Partial<School>): Promise<School | undefined>;
  deleteSchool(id: number): Promise<boolean>;
  listSchools(limit?: number, offset?: number): Promise<School[]>;
  
  // Notification management
  getNotification(id: number): Promise<Notification | undefined>;
  getNotificationsByUser(userId: number, read?: boolean): Promise<Notification[]>;
  getNotificationsBySchool(schoolId: number): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  updateNotification(id: number, notificationData: Partial<Notification>): Promise<Notification | undefined>;
  markNotificationAsRead(id: number): Promise<Notification | undefined>;
  markAllNotificationsAsRead(userId: number): Promise<boolean>;
  
  // Message management
  getMessage(id: number): Promise<Message | undefined>;
  getMessagesByUser(userId: number, asReceiver?: boolean): Promise<Message[]>;
  getConversation(user1Id: number, user2Id: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  updateMessageStatus(id: number, status: 'sent' | 'delivered' | 'read'): Promise<Message | undefined>;
  
  // Attendant management
  getAttendant(id: number): Promise<Attendant | undefined>;
  getAttendantsBySchool(schoolId: number): Promise<Attendant[]>;
  createAttendant(attendant: any): Promise<Attendant>;
  
  // Student management
  getStudent(id: number): Promise<Student | undefined>;
  getStudentsBySchool(schoolId: number): Promise<Student[]>;
  createStudent(student: InsertStudent): Promise<Student>;
  updateStudent(id: number, student: Partial<Student>): Promise<Student | undefined>;
  
  // Lead management
  getLead(id: number): Promise<Lead | undefined>;
  getLeadsBySchool(schoolId: number): Promise<Lead[]>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: number, lead: Partial<Lead>): Promise<Lead | undefined>;
  
  // Course management
  getCourse(id: number): Promise<Course | undefined>;
  getCoursesBySchool(schoolId: number): Promise<Course[]>;
  createCourse(course: InsertCourse): Promise<Course>;
  updateCourse(id: number, course: Partial<Course>): Promise<Course | undefined>;
  
  // Form questions management
  getQuestion(id: number): Promise<Question | undefined>;
  getQuestionsBySchool(schoolId: number, section?: string): Promise<Question[]>;
  createQuestion(question: InsertQuestion): Promise<Question>;
  updateQuestion(id: number, question: Partial<Question>): Promise<Question | undefined>;
  
  // Form answers management
  getAnswer(id: number): Promise<Answer | undefined>;
  getAnswersByEnrollment(enrollmentId: number): Promise<Answer[]>;
  createAnswer(answer: InsertAnswer): Promise<Answer>;
  updateAnswer(id: number, answer: Partial<Answer>): Promise<Answer | undefined>;
  
  // Chat history management
  getChatMessage(id: number): Promise<ChatMessage | undefined>;
  getChatHistoryBySchool(schoolId: number, userId?: number, leadId?: number): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  
  // Enrollment management
  getEnrollment(id: number): Promise<Enrollment | undefined>;
  getEnrollmentsBySchool(schoolId: number, status?: string): Promise<Enrollment[]>;
  getEnrollmentsByStudent(studentId: number): Promise<Enrollment[]>;
  getEnrollmentsByStudentId(userId: number): Promise<Enrollment[]>;
  createEnrollment(enrollment: InsertEnrollment): Promise<Enrollment>;
  updateEnrollment(id: number, enrollment: Partial<Enrollment>): Promise<Enrollment | undefined>;
  listEnrollments(limit?: number, offset?: number): Promise<Enrollment[]>;
  
  // WhatsApp management - Evolution API
  // Instâncias
  getWhatsappInstance(id: number): Promise<WhatsappInstance | undefined>;
  getWhatsappInstanceBySchool(schoolId: number): Promise<WhatsappInstance | undefined>;
  listWhatsappInstances(activeOnly?: boolean): Promise<WhatsappInstance[]>;
  createWhatsappInstance(data: InsertWhatsappInstance): Promise<WhatsappInstance>;
  updateWhatsappInstance(id: number, data: Partial<InsertWhatsappInstance>): Promise<WhatsappInstance>;
  updateWhatsappInstanceStatus(id: number, status: string, qrcode?: string): Promise<WhatsappInstance>;
  deleteWhatsappInstance(id: number): Promise<boolean>;
  
  // Contatos
  getWhatsappContact(id: number): Promise<WhatsappContact | undefined>;
  getWhatsappContactByPhone(instanceId: number, phone: string): Promise<WhatsappContact | undefined>;
  listWhatsappContacts(instanceId: number): Promise<WhatsappContact[]>;
  createWhatsappContact(data: InsertWhatsappContact): Promise<WhatsappContact>;
  updateWhatsappContact(id: number, data: Partial<InsertWhatsappContact>): Promise<WhatsappContact>;
  upsertWhatsappContact(instanceId: number, phone: string, data: Partial<InsertWhatsappContact>): Promise<WhatsappContact>;
  
  // Mensagens
  getWhatsappMessage(id: number): Promise<WhatsappMessage | undefined>;
  getWhatsappMessageByExternalId(externalId: string): Promise<WhatsappMessage | undefined>;
  listWhatsappMessagesByContact(contactId: number, limit?: number, offset?: number): Promise<WhatsappMessage[]>;
  createWhatsappMessage(data: InsertWhatsappMessage): Promise<WhatsappMessage>;
  updateWhatsappMessageStatus(id: number, status: string, statusTimestamp?: Date): Promise<WhatsappMessage>;
  updateWhatsappMessageStatusByExternalId(externalId: string, status: string, statusTimestamp?: Date): Promise<WhatsappMessage | null>;
  getWhatsappRecentConversations(instanceId: number, limit?: number): Promise<any[]>;
  
  // Metrics management
  getMetric(id: number): Promise<Metric | undefined>;
  getMetricsBySchool(schoolId: number, metricType?: string): Promise<Metric[]>;
  createMetric(metric: InsertMetric): Promise<Metric>;
  getMetricSummary(schoolId: number, metricType: string): Promise<{count: number, change: number}>;
  getDashboardMetrics(schoolId?: number): Promise<any>;
  
  // Notification management
  getNotification(id: number): Promise<Notification | undefined>;
  getNotificationsByUser(userId: number, read?: boolean): Promise<Notification[]>;
  getNotificationsBySchool(schoolId: number): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  updateNotification(id: number, notification: Partial<Notification>): Promise<Notification | undefined>;
  markNotificationAsRead(id: number): Promise<Notification | undefined>;
  markAllNotificationsAsRead(userId: number): Promise<boolean>;
  
  // Message management
  getMessage(id: number): Promise<Message | undefined>;
  getMessagesByUser(userId: number, asReceiver?: boolean): Promise<Message[]>;
  getConversation(user1Id: number, user2Id: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  updateMessageStatus(id: number, status: 'sent' | 'delivered' | 'read'): Promise<Message | undefined>;
  
  // Password reset token management
  createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetTokenByToken(token: string): Promise<PasswordResetToken | undefined>;
  getPasswordResetTokensByUser(userId: number): Promise<PasswordResetToken[]>;
  markPasswordResetTokenAsUsed(token: string): Promise<PasswordResetToken | undefined>;
  deleteExpiredPasswordResetTokens(): Promise<void>;
  
  // User settings management
  getUserSettings(userId: number): Promise<UserSettings | undefined>;
  createUserSettings(settings: InsertUserSettings): Promise<UserSettings>;
  updateUserSettings(userId: number, settings: Partial<UserSettings>): Promise<UserSettings | undefined>;
}

// In-memory storage implementation
export class MemStorage implements IStorage {
  private usersMap: Map<number, User>;
  private schoolsMap: Map<number, School>;
  private attendantsMap: Map<number, Attendant>;
  private studentsMap: Map<number, Student>;
  private leadsMap: Map<number, Lead>;
  private coursesMap: Map<number, Course>;
  private questionsMap: Map<number, Question>;
  private answersMap: Map<number, Answer>;
  private chatHistoryMap: Map<number, ChatMessage>;
  private enrollmentsMap: Map<number, Enrollment>;
  private whatsappMessagesMap: Map<number, WhatsappMessage>;
  private metricsMap: Map<number, Metric>;
  private notificationsMap: Map<number, Notification>;
  private messagesMap: Map<number, Message>;
  private userSettingsMap: Map<number, UserSettings>;
  
  private userIdCounter: number;
  private schoolIdCounter: number;
  private attendantIdCounter: number;
  private studentIdCounter: number;
  private leadIdCounter: number;
  private courseIdCounter: number;
  private questionIdCounter: number;
  private answerIdCounter: number;
  private chatMessageIdCounter: number;
  private enrollmentIdCounter: number;
  private whatsappMessageIdCounter: number;
  private metricIdCounter: number;
  private notificationIdCounter: number;
  private messageIdCounter: number;
  private userSettingsIdCounter: number;
  
  // Notification and message methods will be added dynamically

  constructor() {
    this.usersMap = new Map();
    this.schoolsMap = new Map();
    this.attendantsMap = new Map();
    this.studentsMap = new Map();
    this.leadsMap = new Map();
    this.coursesMap = new Map();
    this.questionsMap = new Map();
    this.answersMap = new Map();
    this.chatHistoryMap = new Map();
    this.enrollmentsMap = new Map();
    this.whatsappMessagesMap = new Map();
    this.metricsMap = new Map();
    this.notificationsMap = new Map();
    this.messagesMap = new Map();
    this.userSettingsMap = new Map();
    
    this.userIdCounter = 1;
    this.schoolIdCounter = 1;
    this.attendantIdCounter = 1;
    this.studentIdCounter = 1;
    this.leadIdCounter = 1;
    this.courseIdCounter = 1;
    this.questionIdCounter = 1;
    this.answerIdCounter = 1;
    this.chatMessageIdCounter = 1;
    this.enrollmentIdCounter = 1;
    this.whatsappMessageIdCounter = 1;
    this.metricIdCounter = 1;
    this.notificationIdCounter = 1;
    this.messageIdCounter = 1;
    this.userSettingsIdCounter = 1;
    
    // Initialize with some test data
    this.initializeTestData();
  }

  // Initialize test data
  private initializeTestData() {
    // Create admin user
    const adminUser: InsertUser = {
      username: 'admin',
      email: 'admin@edumatrik.ai',
      password: 'admin123',
      fullName: 'Admin User',
      role: 'admin',
      phone: '+5511999999999',
    };
    this.createUser(adminUser);
    
    // Create test schools
    const school1: InsertSchool = {
      name: 'Colégio Vencer',
      email: 'contato@colegiovencer.com.br',
      phone: '+5511999999998',
      city: 'São Paulo',
      state: 'SP',
      mainCourse: 'Ensino Médio',
      description: 'Escola de ensino médio com foco em tecnologia',
    };
    const school2: InsertSchool = {
      name: 'Instituto Futuro',
      email: 'contato@institutofuturo.com.br',
      phone: '+5511999999997',
      city: 'Rio de Janeiro',
      state: 'RJ',
      mainCourse: 'Ensino Fundamental e Médio',
      description: 'Instituto de educação completa',
    };
    const createdSchool1 = this.createSchool(school1);
    const createdSchool2 = this.createSchool(school2);
    
    // Create test school users
    const schoolUser1: InsertUser = {
      username: 'escola1',
      email: 'escola@colegiovencer.com.br',
      password: 'escola123',
      fullName: 'Diretor Colégio Vencer',
      role: 'school',
      schoolId: createdSchool1.id,
      phone: '+5511999999996',
    };
    const schoolUser2: InsertUser = {
      username: 'escola2',
      email: 'escola@institutofuturo.com.br',
      password: 'escola123',
      fullName: 'Diretor Instituto Futuro',
      role: 'school',
      schoolId: createdSchool2.id,
      phone: '+5511999999995',
    };
    this.createUser(schoolUser1);
    this.createUser(schoolUser2);
    
    // Create test attendants and students
    this.createAttendant({
      userId: this.createUser({
        username: 'atendente1',
        email: 'atendente@colegiovencer.com.br',
        password: 'atendente123',
        fullName: 'Atendente Colégio Vencer',
        role: 'attendant',
        schoolId: createdSchool1.id,
        phone: '+5511999999994',
      }).id,
      schoolId: createdSchool1.id,
      department: 'Secretaria',
    });
    
    this.createStudent({
      userId: this.createUser({
        username: 'aluno1',
        email: 'aluno@email.com',
        password: 'aluno123',
        fullName: 'João Silva',
        role: 'student',
        schoolId: createdSchool1.id,
        phone: '+5511999999993',
      }).id,
      schoolId: createdSchool1.id,
      cpf: '123.456.789-00',
      city: 'São Paulo',
      state: 'SP',
    });
    
    // Create test courses
    this.createCourse({
      name: 'Ensino Médio - Ênfase em Tecnologia',
      description: 'Curso de ensino médio com foco em tecnologia e programação',
      schoolId: createdSchool1.id,
      price: 125000, // R$ 1.250,00
      duration: '3 anos',
    });
    
    this.createCourse({
      name: 'Ensino Médio - Ênfase em Ciências',
      description: 'Curso de ensino médio com foco em ciências da natureza',
      schoolId: createdSchool1.id,
      price: 125000, // R$ 1.250,00
      duration: '3 anos',
    });
    
    // Create test leads
    this.createLead({
      fullName: 'Maria Oliveira',
      email: 'maria@email.com',
      phone: '+5511988888888',
      schoolId: createdSchool1.id,
      source: 'whatsapp',
      status: 'new',
    });
    
    this.createLead({
      fullName: 'Carlos Santos',
      email: 'carlos@email.com',
      phone: '+5511977777777',
      schoolId: createdSchool1.id,
      source: 'website',
      status: 'contacted',
    });
    
    // Create test questions
    this.createQuestion({
      schoolId: createdSchool1.id,
      question: 'Nome completo do aluno',
      questionType: 'text',
      required: true,
      order: 1,
      formSection: 'personal_info',
    });
    
    this.createQuestion({
      schoolId: createdSchool1.id,
      question: 'CPF do aluno',
      questionType: 'text',
      required: true,
      order: 2,
      formSection: 'personal_info',
    });
    
    this.createQuestion({
      schoolId: createdSchool1.id,
      question: 'Curso desejado',
      questionType: 'select',
      options: ['Ensino Médio - Ênfase em Tecnologia', 'Ensino Médio - Ênfase em Ciências'],
      required: true,
      order: 1,
      formSection: 'course_info',
    });
    
    // Create test enrollments
    this.createEnrollment({
      schoolId: createdSchool1.id,
      studentId: 1,
      courseId: 1,
      status: 'personal_info',
      personalInfoCompleted: true,
    });
    
    // Create test metrics
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    
    // Visits metrics
    this.createMetric({
      schoolId: createdSchool1.id,
      metricType: 'visits',
      metricValue: 5240,
      date: now,
    });
    
    this.createMetric({
      schoolId: createdSchool1.id,
      metricType: 'visits',
      metricValue: 4850,
      date: lastMonth,
    });
    
    // Leads metrics
    this.createMetric({
      schoolId: createdSchool1.id,
      metricType: 'leads',
      metricValue: 2156,
      date: now,
    });
    
    this.createMetric({
      schoolId: createdSchool1.id,
      metricType: 'leads',
      metricValue: 2050,
      date: lastMonth,
    });
    
    // Enrollments metrics for funnel stages
    this.createMetric({
      schoolId: createdSchool1.id,
      metricType: 'form_started',
      metricValue: 2156,
      date: now,
    });
    
    this.createMetric({
      schoolId: createdSchool1.id,
      metricType: 'course_info',
      metricValue: 1568,
      date: now,
    });
    
    this.createMetric({
      schoolId: createdSchool1.id,
      metricType: 'enrollments',
      metricValue: 873,
      date: now,
    });
    
    this.createMetric({
      schoolId: createdSchool1.id,
      metricType: 'enrollments',
      metricValue: 780,
      date: lastMonth,
    });
    
    // Leads by source metrics
    this.createMetric({
      schoolId: createdSchool1.id,
      metricType: 'leads_source',
      metricValue: 755, // 35% of 2156
      source: 'whatsapp',
      date: now,
    });
    
    this.createMetric({
      schoolId: createdSchool1.id,
      metricType: 'leads_source',
      metricValue: 539, // 25% of 2156
      source: 'website',
      date: now,
    });
    
    this.createMetric({
      schoolId: createdSchool1.id,
      metricType: 'leads_source',
      metricValue: 431, // 20% of 2156
      source: 'social_media',
      date: now,
    });
    
    this.createMetric({
      schoolId: createdSchool1.id,
      metricType: 'leads_source',
      metricValue: 431, // 20% of 2156
      source: 'referral',
      date: now,
    });
    
    // Create chat history
    this.createChatMessage({
      schoolId: createdSchool1.id,
      leadId: 1,
      message: 'Olá! Sou o assistente do Colégio Vencer. Como posso ajudar você hoje?',
      sentByUser: false,
      status: 'active',
    });
    
    this.createChatMessage({
      schoolId: createdSchool1.id,
      leadId: 1,
      message: 'Olá! Gostaria de informações sobre matrículas para o ensino médio.',
      sentByUser: true,
      status: 'active',
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.usersMap.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.usersMap.values()).find(user => user.username === username);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.usersMap.values()).find(user => user.email === email);
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const now = new Date();
    const newUser: User = {
      ...user,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.usersMap.set(id, newUser);
    return newUser;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const user = this.usersMap.get(id);
    if (!user) return undefined;
    
    const updatedUser = {
      ...user,
      ...userData,
      updatedAt: new Date(),
    };
    this.usersMap.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: number): Promise<boolean> {
    return this.usersMap.delete(id);
  }

  async listUsers(limit = 100, offset = 0): Promise<User[]> {
    return Array.from(this.usersMap.values())
      .sort((a, b) => a.id - b.id)
      .slice(offset, offset + limit);
  }

  // School methods
  async getSchool(id: number): Promise<School | undefined> {
    return this.schoolsMap.get(id);
  }

  async createSchool(school: InsertSchool): Promise<School> {
    const id = this.schoolIdCounter++;
    const now = new Date();
    const newSchool: School = {
      ...school,
      id,
      logo: school.logo || null,
      address: school.address || null,
      zipCode: school.zipCode || null,
      mainCourse: school.mainCourse || null,
      description: school.description || null,
      whatsappNumber: school.whatsappNumber || null,
      whatsappEnabled: school.whatsappEnabled || false,
      apiKey: school.apiKey || null,
      webhookUrl: school.webhookUrl || null,
      active: school.active !== undefined ? school.active : true,
      createdAt: now,
      updatedAt: now,
    };
    this.schoolsMap.set(id, newSchool);
    return newSchool;
  }

  async updateSchool(id: number, schoolData: Partial<School>): Promise<School | undefined> {
    const school = this.schoolsMap.get(id);
    if (!school) return undefined;
    
    const updatedSchool = {
      ...school,
      ...schoolData,
      updatedAt: new Date(),
    };
    this.schoolsMap.set(id, updatedSchool);
    return updatedSchool;
  }

  async deleteSchool(id: number): Promise<boolean> {
    return this.schoolsMap.delete(id);
  }

  async listSchools(limit = 100, offset = 0): Promise<School[]> {
    return Array.from(this.schoolsMap.values())
      .sort((a, b) => a.id - b.id)
      .slice(offset, offset + limit);
  }

  // Attendant methods
  async getAttendant(id: number): Promise<Attendant | undefined> {
    return this.attendantsMap.get(id);
  }

  async getAttendantsBySchool(schoolId: number): Promise<Attendant[]> {
    return Array.from(this.attendantsMap.values())
      .filter(attendant => attendant.schoolId === schoolId);
  }

  async createAttendant(attendant: any): Promise<Attendant> {
    const id = this.attendantIdCounter++;
    const now = new Date();
    const newAttendant: Attendant = {
      id,
      userId: attendant.userId,
      schoolId: attendant.schoolId,
      department: attendant.department || null,
      active: attendant.active !== undefined ? attendant.active : true,
      createdAt: now,
      updatedAt: now,
    };
    this.attendantsMap.set(id, newAttendant);
    return newAttendant;
  }

  // Student methods
  async getStudent(id: number): Promise<Student | undefined> {
    return this.studentsMap.get(id);
  }

  async getStudentsBySchool(schoolId: number): Promise<Student[]> {
    return Array.from(this.studentsMap.values())
      .filter(student => student.schoolId === schoolId);
  }

  async createStudent(student: InsertStudent): Promise<Student> {
    const id = this.studentIdCounter++;
    const now = new Date();
    const newStudent: Student = {
      ...student,
      id,
      cpf: student.cpf || null,
      birthdate: student.birthdate || null,
      gender: student.gender || null,
      address: student.address || null,
      city: student.city || null,
      state: student.state || null,
      zipCode: student.zipCode || null,
      parentName: student.parentName || null,
      parentRelationship: student.parentRelationship || null,
      parentEmail: student.parentEmail || null,
      parentPhone: student.parentPhone || null,
      active: student.active !== undefined ? student.active : true,
      createdAt: now,
      updatedAt: now,
    };
    this.studentsMap.set(id, newStudent);
    return newStudent;
  }

  async updateStudent(id: number, studentData: Partial<Student>): Promise<Student | undefined> {
    const student = this.studentsMap.get(id);
    if (!student) return undefined;
    
    const updatedStudent = {
      ...student,
      ...studentData,
      updatedAt: new Date(),
    };
    this.studentsMap.set(id, updatedStudent);
    return updatedStudent;
  }

  // Lead methods
  async getLead(id: number): Promise<Lead | undefined> {
    return this.leadsMap.get(id);
  }

  async getLeadsBySchool(schoolId: number): Promise<Lead[]> {
    return Array.from(this.leadsMap.values())
      .filter(lead => lead.schoolId === schoolId);
  }

  async createLead(lead: InsertLead): Promise<Lead> {
    const id = this.leadIdCounter++;
    const now = new Date();
    const newLead: Lead = {
      ...lead,
      id,
      source: lead.source || 'website',
      status: lead.status || 'new',
      notes: lead.notes || null,
      utmSource: lead.utmSource || null,
      utmMedium: lead.utmMedium || null,
      utmCampaign: lead.utmCampaign || null,
      createdAt: now,
      updatedAt: now,
    };
    this.leadsMap.set(id, newLead);
    return newLead;
  }

  async updateLead(id: number, leadData: Partial<Lead>): Promise<Lead | undefined> {
    const lead = this.leadsMap.get(id);
    if (!lead) return undefined;
    
    const updatedLead = {
      ...lead,
      ...leadData,
      updatedAt: new Date(),
    };
    this.leadsMap.set(id, updatedLead);
    return updatedLead;
  }

  // Course methods
  async getCourse(id: number): Promise<Course | undefined> {
    return this.coursesMap.get(id);
  }

  async getCoursesBySchool(schoolId: number): Promise<Course[]> {
    return Array.from(this.coursesMap.values())
      .filter(course => course.schoolId === schoolId);
  }

  async createCourse(course: InsertCourse): Promise<Course> {
    const id = this.courseIdCounter++;
    const now = new Date();
    const newCourse: Course = {
      ...course,
      id,
      description: course.description || null,
      price: course.price || null,
      duration: course.duration || null,
      active: course.active !== undefined ? course.active : true,
      createdAt: now,
      updatedAt: now,
    };
    this.coursesMap.set(id, newCourse);
    return newCourse;
  }

  async updateCourse(id: number, courseData: Partial<Course>): Promise<Course | undefined> {
    const course = this.coursesMap.get(id);
    if (!course) return undefined;
    
    const updatedCourse = {
      ...course,
      ...courseData,
      updatedAt: new Date(),
    };
    this.coursesMap.set(id, updatedCourse);
    return updatedCourse;
  }

  // Question methods
  async getQuestion(id: number): Promise<Question | undefined> {
    return this.questionsMap.get(id);
  }

  async getQuestionsBySchool(schoolId: number, section?: string): Promise<Question[]> {
    return Array.from(this.questionsMap.values())
      .filter(question => 
        question.schoolId === schoolId && 
        (section ? question.formSection === section : true)
      )
      .sort((a, b) => a.order - b.order);
  }

  async createQuestion(question: InsertQuestion): Promise<Question> {
    const id = this.questionIdCounter++;
    const now = new Date();
    const newQuestion: Question = {
      ...question,
      id,
      options: question.options || null,
      required: question.required !== undefined ? question.required : false,
      active: question.active !== undefined ? question.active : true,
      createdAt: now,
      updatedAt: now,
    };
    this.questionsMap.set(id, newQuestion);
    return newQuestion;
  }

  async updateQuestion(id: number, questionData: Partial<Question>): Promise<Question | undefined> {
    const question = this.questionsMap.get(id);
    if (!question) return undefined;
    
    const updatedQuestion = {
      ...question,
      ...questionData,
      updatedAt: new Date(),
    };
    this.questionsMap.set(id, updatedQuestion);
    return updatedQuestion;
  }

  // Answer methods
  async getAnswer(id: number): Promise<Answer | undefined> {
    return this.answersMap.get(id);
  }

  async getAnswersByEnrollment(enrollmentId: number): Promise<Answer[]> {
    return Array.from(this.answersMap.values())
      .filter(answer => answer.enrollmentId === enrollmentId);
  }

  async createAnswer(answer: InsertAnswer): Promise<Answer> {
    const id = this.answerIdCounter++;
    const now = new Date();
    const newAnswer: Answer = {
      ...answer,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.answersMap.set(id, newAnswer);
    return newAnswer;
  }

  async updateAnswer(id: number, answerData: Partial<Answer>): Promise<Answer | undefined> {
    const answer = this.answersMap.get(id);
    if (!answer) return undefined;
    
    const updatedAnswer = {
      ...answer,
      ...answerData,
      updatedAt: new Date(),
    };
    this.answersMap.set(id, updatedAnswer);
    return updatedAnswer;
  }

  // Chat message methods
  async getChatMessage(id: number): Promise<ChatMessage | undefined> {
    return this.chatHistoryMap.get(id);
  }

  async getChatHistoryBySchool(schoolId: number, userId?: number, leadId?: number): Promise<ChatMessage[]> {
    return Array.from(this.chatHistoryMap.values())
      .filter(message => 
        message.schoolId === schoolId && 
        (userId ? message.userId === userId : true) &&
        (leadId ? message.leadId === leadId : true)
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const id = this.chatMessageIdCounter++;
    const now = new Date();
    const newMessage: ChatMessage = {
      ...message,
      id,
      userId: message.userId || null,
      leadId: message.leadId || null,
      status: message.status || 'active',
      createdAt: now,
    };
    this.chatHistoryMap.set(id, newMessage);
    return newMessage;
  }

  // Enrollment methods
  async getEnrollment(id: number): Promise<Enrollment | undefined> {
    return this.enrollmentsMap.get(id);
  }

  async getEnrollmentsBySchool(schoolId: number, status?: string): Promise<Enrollment[]> {
    return Array.from(this.enrollmentsMap.values())
      .filter(enrollment => 
        enrollment.schoolId === schoolId && 
        (status ? enrollment.status === status : true)
      );
  }

  async getEnrollmentsByStudent(studentId: number): Promise<Enrollment[]> {
    return Array.from(this.enrollmentsMap.values())
      .filter(enrollment => enrollment.studentId === studentId);
  }
  
  async getEnrollmentsByStudentId(userId: number): Promise<Enrollment[]> {
    // First, find the student with this userId
    const student = Array.from(this.studentsMap.values()).find(
      student => student.userId === userId
    );
    
    if (!student) {
      return [];
    }
    
    // Then get enrollments for this student
    return this.getEnrollmentsByStudent(student.id);
  }

  async createEnrollment(enrollment: InsertEnrollment): Promise<Enrollment> {
    const id = this.enrollmentIdCounter++;
    const now = new Date();
    const newEnrollment: Enrollment = {
      ...enrollment,
      id,
      studentId: enrollment.studentId || null,
      leadId: enrollment.leadId || null,
      courseId: enrollment.courseId || null,
      status: enrollment.status || 'started',
      personalInfoCompleted: enrollment.personalInfoCompleted || false,
      courseInfoCompleted: enrollment.courseInfoCompleted || false,
      paymentCompleted: enrollment.paymentCompleted || false,
      paymentAmount: enrollment.paymentAmount || null,
      paymentMethod: enrollment.paymentMethod || null,
      paymentReference: enrollment.paymentReference || null,
      createdAt: now,
      updatedAt: now,
    };
    this.enrollmentsMap.set(id, newEnrollment);
    return newEnrollment;
  }

  async updateEnrollment(id: number, enrollmentData: Partial<Enrollment>): Promise<Enrollment | undefined> {
    const enrollment = this.enrollmentsMap.get(id);
    if (!enrollment) return undefined;
    
    const updatedEnrollment = {
      ...enrollment,
      ...enrollmentData,
      updatedAt: new Date(),
    };
    
    // Update status based on completed steps
    if (enrollmentData.personalInfoCompleted && !enrollment.personalInfoCompleted) {
      updatedEnrollment.status = 'personal_info';
    }
    if (enrollmentData.courseInfoCompleted && !enrollment.courseInfoCompleted) {
      updatedEnrollment.status = 'course_info';
    }
    if (enrollmentData.paymentCompleted && !enrollment.paymentCompleted) {
      updatedEnrollment.status = 'payment';
    }
    if (updatedEnrollment.personalInfoCompleted && updatedEnrollment.courseInfoCompleted && updatedEnrollment.paymentCompleted) {
      updatedEnrollment.status = 'completed';
    }
    
    this.enrollmentsMap.set(id, updatedEnrollment);
    return updatedEnrollment;
  }
  
  async listEnrollments(limit = 100, offset = 0): Promise<Enrollment[]> {
    return Array.from(this.enrollmentsMap.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(offset, offset + limit);
  }

  // WhatsApp message methods
  async getWhatsappMessage(id: number): Promise<WhatsappMessage | undefined> {
    return this.whatsappMessagesMap.get(id);
  }

  async getWhatsappMessagesBySchool(schoolId: number): Promise<WhatsappMessage[]> {
    return Array.from(this.whatsappMessagesMap.values())
      .filter(message => message.schoolId === schoolId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async createWhatsappMessage(message: InsertWhatsappMessage): Promise<WhatsappMessage> {
    const id = this.whatsappMessageIdCounter++;
    const now = new Date();
    const newMessage: WhatsappMessage = {
      ...message,
      id,
      leadId: message.leadId || null,
      studentId: message.studentId || null,
      createdAt: now,
    };
    this.whatsappMessagesMap.set(id, newMessage);
    return newMessage;
  }

  // Metric methods
  async getMetric(id: number): Promise<Metric | undefined> {
    return this.metricsMap.get(id);
  }

  async getMetricsBySchool(schoolId: number, metricType?: string): Promise<Metric[]> {
    return Array.from(this.metricsMap.values())
      .filter(metric => 
        metric.schoolId === schoolId && 
        (metricType ? metric.metricType === metricType : true)
      );
  }

  async createMetric(metric: InsertMetric): Promise<Metric> {
    const id = this.metricIdCounter++;
    const now = new Date();
    const newMetric: Metric = {
      ...metric,
      id,
      source: metric.source || null,
      createdAt: now,
    };
    this.metricsMap.set(id, newMetric);
    return newMetric;
  }

  // Get metric with change percentage compared to previous period
  async getMetricSummary(schoolId: number, metricType: string): Promise<{count: number, change: number}> {
    const currentMetrics = await this.getMetricsBySchool(schoolId, metricType);
    if (currentMetrics.length === 0) {
      return { count: 0, change: 0 };
    }
    
    // Get current month metric
    const currentDate = new Date();
    const currentMonthMetrics = currentMetrics.filter(metric => {
      const metricDate = new Date(metric.date);
      return metricDate.getMonth() === currentDate.getMonth() && 
             metricDate.getFullYear() === currentDate.getFullYear();
    });
    
    // Get previous month metric
    const previousMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    const previousMonthMetrics = currentMetrics.filter(metric => {
      const metricDate = new Date(metric.date);
      return metricDate.getMonth() === previousMonthDate.getMonth() && 
             metricDate.getFullYear() === previousMonthDate.getFullYear();
    });
    
    const currentValue = currentMonthMetrics.reduce((sum, metric) => sum + metric.metricValue, 0);
    const previousValue = previousMonthMetrics.reduce((sum, metric) => sum + metric.metricValue, 0);
    
    const change = previousValue === 0 ? 0 : ((currentValue - previousValue) / previousValue) * 100;
    
    return {
      count: currentValue,
      change,
    };
  }

  // Get dashboard metrics
  async getDashboardMetrics(schoolId?: number): Promise<any> {
    const metrics: any = {};
    const schools = schoolId ? [schoolId] : Array.from(this.schoolsMap.keys());
    
    // Count active schools (for admin dashboard)
    metrics.activeSchools = Array.from(this.schoolsMap.values())
      .filter(school => school.active).length;
    
    // Get enrollments count and change
    metrics.enrollments = await this.getMetricSummary(schoolId || 1, 'enrollments');
    
    // Get leads count and change
    metrics.leads = await this.getMetricSummary(schoolId || 1, 'leads');
    
    // Get conversion rate
    if (metrics.leads.count > 0) {
      metrics.conversionRate = {
        count: Math.round((metrics.enrollments.count / metrics.leads.count) * 100 * 10) / 10, // to 1 decimal place
        change: 0, // This would need more complex calculation in real app
      };
    } else {
      metrics.conversionRate = { count: 0, change: 0 };
    }
    
    // Get funnel stages data
    metrics.funnel = {
      visits: await this.getMetricSummary(schoolId || 1, 'visits'),
      formStarted: await this.getMetricSummary(schoolId || 1, 'form_started'),
      courseInfo: await this.getMetricSummary(schoolId || 1, 'course_info'),
      payment: metrics.enrollments,
    };
    
    // Get leads by source
    const leadsBySource = await this.getMetricsBySchool(schoolId || 1, 'leads_source');
    metrics.leadsBySource = {
      whatsapp: leadsBySource.find(m => m.source === 'whatsapp')?.metricValue || 0,
      website: leadsBySource.find(m => m.source === 'website')?.metricValue || 0,
      socialMedia: leadsBySource.find(m => m.source === 'social_media')?.metricValue || 0,
      referral: leadsBySource.find(m => m.source === 'referral')?.metricValue || 0,
    };
    
    // For school dashboard
    if (schoolId) {
      metrics.revenue = {
        count: await this.calculateEstimatedRevenue(schoolId),
        change: 15.2, // Mocked value for demo
      };
    }
    
    return metrics;
  }

  // Helper method to calculate estimated revenue
  private async calculateEstimatedRevenue(schoolId: number): Promise<number> {
    const enrollments = await this.getEnrollmentsBySchool(schoolId, 'completed');
    let totalRevenue = 0;
    
    for (const enrollment of enrollments) {
      if (enrollment.courseId) {
        const course = await this.getCourse(enrollment.courseId);
        if (course && course.price) {
          totalRevenue += course.price;
        }
      }
    }
    
    // Convert from cents to whole units (e.g., 4532000 -> 45320)
    return Math.round(totalRevenue / 100);
  }
  
  // User Settings Management
  getUserSettings(userId: number): Promise<UserSettings | undefined> {
    const userSettings = Array.from(this.userSettingsMap.values()).find(
      (settings) => settings.userId === userId
    );
    return Promise.resolve(userSettings);
  }

  createUserSettings(settings: InsertUserSettings): Promise<UserSettings> {
    const id = this.userSettingsIdCounter++;
    const newSettings: UserSettings = {
      id,
      userId: settings.userId,
      notifications: settings.notifications || {
        email: true,
        push: false,
        sms: true,
        whatsapp: true
      },
      appearance: settings.appearance || {
        darkMode: false,
        compactMode: false
      },
      security: settings.security || {
        twoFactorEnabled: false
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.userSettingsMap.set(id, newSettings);
    return Promise.resolve(newSettings);
  }

  updateUserSettings(userId: number, settings: Partial<UserSettings>): Promise<UserSettings | undefined> {
    let found = false;
    let updatedSettings: UserSettings | undefined;
    
    for (const [id, existingSettings] of this.userSettingsMap.entries()) {
      if (existingSettings.userId === userId) {
        found = true;
        
        const updated: UserSettings = {
          ...existingSettings,
          ...settings,
          updatedAt: new Date()
        };
        
        this.userSettingsMap.set(id, updated);
        updatedSettings = updated;
        break;
      }
    }
    
    return Promise.resolve(found ? updatedSettings : undefined);
  }
}

// Create a DatabaseStorage implementation
export class DatabaseStorage implements IStorage {
  // User management
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return true;
  }

  async listUsers(limit = 100, offset = 0): Promise<User[]> {
    return db.select().from(users).limit(limit).offset(offset);
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.fullName);
  }
  
  async getUsersBySchool(schoolId: number): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(eq(users.schoolId, schoolId))
      .orderBy(users.fullName);
  }
  
  async searchUsers(term: string): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(
        or(
          sql`${users.fullName} ILIKE ${term}`,
          sql`${users.email} ILIKE ${term}`,
          sql`${users.username} ILIKE ${term}`
        )
      )
      .orderBy(users.fullName);
  }
  
  async searchUsersBySchool(term: string, schoolId: number): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.schoolId, schoolId),
          or(
            sql`${users.fullName} ILIKE ${term}`,
            sql`${users.email} ILIKE ${term}`,
            sql`${users.username} ILIKE ${term}`
          )
        )
      )
      .orderBy(users.fullName);
  }
  
  async countUsers(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(users);
    return result[0]?.count || 0;
  }
  
  async countUsersByRole(role: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.role, role as any)); // 'as any' porque role é uma string, mas users.role é um enum
    return result[0]?.count || 0;
  }

  // School management
  async getSchool(id: number): Promise<School | undefined> {
    const [school] = await db.select().from(schools).where(eq(schools.id, id));
    return school || undefined;
  }

  async createSchool(school: InsertSchool): Promise<School> {
    const [newSchool] = await db.insert(schools).values(school).returning();
    return newSchool;
  }

  async updateSchool(id: number, schoolData: Partial<School>): Promise<School | undefined> {
    const [updatedSchool] = await db
      .update(schools)
      .set(schoolData)
      .where(eq(schools.id, id))
      .returning();
    return updatedSchool;
  }

  async deleteSchool(id: number): Promise<boolean> {
    await db.delete(schools).where(eq(schools.id, id));
    return true;
  }

  async listSchools(limit = 100, offset = 0): Promise<School[]> {
    return db.select().from(schools).limit(limit).offset(offset);
  }

  // Attendant management
  async getAttendant(id: number): Promise<Attendant | undefined> {
    const [attendant] = await db.select().from(attendants).where(eq(attendants.id, id));
    return attendant || undefined;
  }

  async getAttendantsBySchool(schoolId: number): Promise<Attendant[]> {
    return db.select().from(attendants).where(eq(attendants.schoolId, schoolId));
  }

  async createAttendant(attendant: any): Promise<Attendant> {
    const [newAttendant] = await db.insert(attendants).values(attendant).returning();
    return newAttendant;
  }

  // Student management
  async getStudent(id: number): Promise<Student | undefined> {
    const [student] = await db.select().from(students).where(eq(students.id, id));
    return student || undefined;
  }

  async getStudentByUserId(userId: number): Promise<Student | undefined> {
    const [student] = await db.select().from(students).where(eq(students.userId, userId));
    return student || undefined;
  }

  async getStudentsBySchool(schoolId: number): Promise<Student[]> {
    return db.select().from(students).where(eq(students.schoolId, schoolId));
  }

  async createStudent(student: InsertStudent): Promise<Student> {
    const [newStudent] = await db.insert(students).values(student).returning();
    return newStudent;
  }

  async updateStudent(id: number, studentData: Partial<Student>): Promise<Student | undefined> {
    const [updatedStudent] = await db
      .update(students)
      .set(studentData)
      .where(eq(students.id, id))
      .returning();
    return updatedStudent;
  }

  // Lead management
  async getLead(id: number): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    return lead || undefined;
  }

  async getLeadsBySchool(schoolId: number): Promise<Lead[]> {
    return db.select().from(leads).where(eq(leads.schoolId, schoolId));
  }

  async createLead(lead: InsertLead): Promise<Lead> {
    const [newLead] = await db.insert(leads).values(lead).returning();
    return newLead;
  }

  async updateLead(id: number, leadData: Partial<Lead>): Promise<Lead | undefined> {
    const [updatedLead] = await db
      .update(leads)
      .set(leadData)
      .where(eq(leads.id, id))
      .returning();
    return updatedLead;
  }

  // Course management
  async getCourse(id: number): Promise<Course | undefined> {
    const [course] = await db.select().from(courses).where(eq(courses.id, id));
    return course || undefined;
  }

  async getCoursesBySchool(schoolId: number): Promise<Course[]> {
    return db.select().from(courses).where(eq(courses.schoolId, schoolId));
  }

  async createCourse(course: InsertCourse): Promise<Course> {
    const [newCourse] = await db.insert(courses).values(course).returning();
    return newCourse;
  }

  async updateCourse(id: number, courseData: Partial<Course>): Promise<Course | undefined> {
    const [updatedCourse] = await db
      .update(courses)
      .set(courseData)
      .where(eq(courses.id, id))
      .returning();
    return updatedCourse;
  }

  // Form questions management
  async getQuestion(id: number): Promise<Question | undefined> {
    const [question] = await db.select().from(questions).where(eq(questions.id, id));
    return question || undefined;
  }

  async getQuestionsBySchool(schoolId: number, section?: string): Promise<Question[]> {
    let query = db.select().from(questions).where(eq(questions.schoolId, schoolId));
    
    if (section) {
      query = query.where(eq(questions.section, section));
    }
    
    return await query;
  }

  async createQuestion(question: InsertQuestion): Promise<Question> {
    const [newQuestion] = await db.insert(questions).values(question).returning();
    return newQuestion;
  }

  async updateQuestion(id: number, questionData: Partial<Question>): Promise<Question | undefined> {
    const [updatedQuestion] = await db
      .update(questions)
      .set(questionData)
      .where(eq(questions.id, id))
      .returning();
    return updatedQuestion;
  }

  // Form answers management
  async getAnswer(id: number): Promise<Answer | undefined> {
    const [answer] = await db.select().from(answers).where(eq(answers.id, id));
    return answer || undefined;
  }

  async getAnswersByEnrollment(enrollmentId: number): Promise<Answer[]> {
    return await db.select().from(answers).where(eq(answers.enrollmentId, enrollmentId));
  }

  async createAnswer(answer: InsertAnswer): Promise<Answer> {
    const [newAnswer] = await db.insert(answers).values(answer).returning();
    return newAnswer;
  }

  async updateAnswer(id: number, answerData: Partial<Answer>): Promise<Answer | undefined> {
    const [updatedAnswer] = await db
      .update(answers)
      .set(answerData)
      .where(eq(answers.id, id))
      .returning();
    return updatedAnswer;
  }

  // Chat history management
  async getChatMessage(id: number): Promise<ChatMessage | undefined> {
    const [message] = await db.select().from(chatHistory).where(eq(chatHistory.id, id));
    return message || undefined;
  }

  async getChatHistoryBySchool(schoolId: number, userId?: number, leadId?: number): Promise<ChatMessage[]> {
    let query = db.select().from(chatHistory).where(eq(chatHistory.schoolId, schoolId));
    
    if (userId) {
      query = query.where(eq(chatHistory.userId, userId));
    }
    
    if (leadId) {
      query = query.where(eq(chatHistory.leadId, leadId));
    }
    
    return await query.orderBy(asc(chatHistory.createdAt));
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const [newMessage] = await db.insert(chatHistory).values(message).returning();
    return newMessage;
  }

  // Enrollment management
  async getEnrollment(id: number): Promise<Enrollment | undefined> {
    const [enrollment] = await db.select().from(enrollments).where(eq(enrollments.id, id));
    return enrollment || undefined;
  }

  async getEnrollmentsBySchool(schoolId: number, status?: string): Promise<Enrollment[]> {
    let query = db.select().from(enrollments).where(eq(enrollments.schoolId, schoolId));
    
    if (status) {
      query = query.where(eq(enrollments.status, status as any));
    }
    
    return await query;
  }

  async getEnrollmentsByStudent(studentId: number): Promise<Enrollment[]> {
    return await db.select().from(enrollments).where(eq(enrollments.studentId, studentId));
  }
  
  async getEnrollmentsByStudentId(userId: number): Promise<Enrollment[]> {
    // First, find the student with this userId
    const [student] = await db
      .select()
      .from(students)
      .where(eq(students.userId, userId));
    
    if (!student) {
      return [];
    }
    
    // Then get enrollments for this student
    return this.getEnrollmentsByStudent(student.id);
  }

  async createEnrollment(enrollment: InsertEnrollment): Promise<Enrollment> {
    const [newEnrollment] = await db.insert(enrollments).values(enrollment).returning();
    return newEnrollment;
  }

  async updateEnrollment(id: number, enrollmentData: Partial<Enrollment>): Promise<Enrollment | undefined> {
    const [updatedEnrollment] = await db
      .update(enrollments)
      .set(enrollmentData)
      .where(eq(enrollments.id, id))
      .returning();
    return updatedEnrollment;
  }
  
  async listEnrollments(limit = 100, offset = 0): Promise<Enrollment[]> {
    return await db.select()
      .from(enrollments)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(enrollments.createdAt));
  }

  // WhatsApp messages management
  async getWhatsappMessage(id: number): Promise<WhatsappMessage | undefined> {
    const [message] = await db.select().from(whatsappMessages).where(eq(whatsappMessages.id, id));
    return message || undefined;
  }

  async getWhatsappMessagesBySchool(schoolId: number): Promise<WhatsappMessage[]> {
    return await db.select().from(whatsappMessages).where(eq(whatsappMessages.schoolId, schoolId));
  }

  async createWhatsappMessage(message: InsertWhatsappMessage): Promise<WhatsappMessage> {
    const [newMessage] = await db.insert(whatsappMessages).values(message).returning();
    return newMessage;
  }

  // Metrics management
  async getMetric(id: number): Promise<Metric | undefined> {
    const [metric] = await db.select().from(metrics).where(eq(metrics.id, id));
    return metric || undefined;
  }

  async getMetricsBySchool(schoolId: number, metricType?: string): Promise<Metric[]> {
    let query = db.select().from(metrics).where(eq(metrics.schoolId, schoolId));
    
    if (metricType) {
      query = query.where(eq(metrics.metricType, metricType));
    }
    
    return await query.orderBy(desc(metrics.date));
  }

  async createMetric(metric: InsertMetric): Promise<Metric> {
    const [newMetric] = await db.insert(metrics).values(metric).returning();
    return newMetric;
  }

  async getMetricSummary(schoolId: number, metricType: string): Promise<{count: number, change: number}> {
    // Calculate total for the current month
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    const metricsThisMonth = await db
      .select({ sum: sql<number>`sum(${metrics.metricValue})` })
      .from(metrics)
      .where(
        and(
          eq(metrics.schoolId, schoolId),
          eq(metrics.metricType, metricType),
          gte(metrics.date, firstDayOfMonth),
          lte(metrics.date, lastDayOfMonth)
        )
      );
    
    // Calculate total for previous month
    const firstDayOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    
    const metricsPrevMonth = await db
      .select({ sum: sql<number>`sum(${metrics.metricValue})` })
      .from(metrics)
      .where(
        and(
          eq(metrics.schoolId, schoolId),
          eq(metrics.metricType, metricType),
          gte(metrics.date, firstDayOfPrevMonth),
          lte(metrics.date, lastDayOfPrevMonth)
        )
      );
    
    const currentCount = metricsThisMonth[0]?.sum || 0;
    const prevCount = metricsPrevMonth[0]?.sum || 0;
    
    // Calculate percentage change
    let change = 0;
    if (prevCount > 0) {
      change = ((currentCount - prevCount) / prevCount) * 100;
    } else if (currentCount > 0) {
      change = 100; // If previous was 0 and current is not, that's a 100% increase
    }
    
    return {
      count: currentCount,
      change
    };
  }

  async getDashboardMetrics(schoolId?: number): Promise<any> {
    if (!schoolId) {
      const schoolsCount = await db.select({ count: sql<number>`count(*)` }).from(schools);
      const usersCount = await db.select({ count: sql<number>`count(*)` }).from(users);
      const enrollmentsCount = await db.select({ count: sql<number>`count(*)` }).from(enrollments);
      
      // Get completed enrollments
      const completedEnrollments = await db
        .select({ count: sql<number>`count(*)` })
        .from(enrollments)
        .where(eq(enrollments.status, 'completed'));
      
      return {
        schools: schoolsCount[0]?.count || 0,
        users: usersCount[0]?.count || 0,
        enrollments: enrollmentsCount[0]?.count || 0,
        completedEnrollments: completedEnrollments[0]?.count || 0,
      };
    } else {
      // For a specific school
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      // Current month leads and enrollments
      const leads = await this.getMetricSummary(schoolId, 'leads');
      const enrollments = await this.getMetricSummary(schoolId, 'form_started');
      const completedEnrollments = await this.getMetricSummary(schoolId, 'enrollment_completed');
      
      // Get conversion rate
      const conversionRate = enrollments.count > 0
        ? (completedEnrollments.count / enrollments.count) * 100
        : 0;
      
      // Estimate revenue based on completed enrollments and courses
      const estimatedRevenue = await this.calculateEstimatedRevenue(schoolId);
      
      return {
        leads,
        enrollments,
        completedEnrollments,
        conversionRate,
        estimatedRevenue
      };
    }
  }

  private async calculateEstimatedRevenue(schoolId: number): Promise<number> {
    // Get all completed enrollments for the school
    const completedEnrollments = await db
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.schoolId, schoolId),
          eq(enrollments.status, 'completed')
        )
      );
    
    // Get all courses for the school
    const schoolCourses = await db
      .select()
      .from(courses)
      .where(eq(courses.schoolId, schoolId));
    
    // Calculate revenue based on course prices
    let totalRevenue = 0;
    
    for (const enrollment of completedEnrollments) {
      if (enrollment.courseId) {
        const course = schoolCourses.find(c => c.id === enrollment.courseId);
        if (course && course.price) {
          totalRevenue += course.price;
        }
      }
    }
    
    return totalRevenue;
  }
}

import { addNotificationMethodsToDatabaseStorage } from './storage.notification';

// Storage instance
// Implementação dos métodos de gerenciamento de tokens de redefinição de senha
DatabaseStorage.prototype.createPasswordResetToken = async function(token: InsertPasswordResetToken): Promise<PasswordResetToken> {
  const [newToken] = await db.insert(passwordResetTokens).values(token).returning();
  return newToken;
};

DatabaseStorage.prototype.getPasswordResetTokenByToken = async function(token: string): Promise<PasswordResetToken | undefined> {
  const [resetToken] = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.token, token));
  return resetToken || undefined;
};

DatabaseStorage.prototype.getPasswordResetTokensByUser = async function(userId: number): Promise<PasswordResetToken[]> {
  return await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.userId, userId))
    .orderBy(desc(passwordResetTokens.createdAt));
};

DatabaseStorage.prototype.markPasswordResetTokenAsUsed = async function(token: string): Promise<PasswordResetToken | undefined> {
  const [updatedToken] = await db
    .update(passwordResetTokens)
    .set({ used: true })
    .where(eq(passwordResetTokens.token, token))
    .returning();
  return updatedToken || undefined;
};

DatabaseStorage.prototype.deleteExpiredPasswordResetTokens = async function(): Promise<void> {
  await db
    .delete(passwordResetTokens)
    .where(
      or(
        lt(passwordResetTokens.expiresAt, new Date()),
        eq(passwordResetTokens.used, true)
      )
    );
};

// Add user settings methods to MemStorage
MemStorage.prototype.getUserSettings = async function(userId: number): Promise<UserSettings | undefined> {
  return Array.from(this.userSettingsMap.values()).find(setting => setting.userId === userId);
};

MemStorage.prototype.createUserSettings = async function(settings: InsertUserSettings): Promise<UserSettings> {
  const id = this.userSettingsIdCounter++;
  const now = new Date();
  const newSettings: UserSettings = {
    ...settings,
    id,
    createdAt: now,
    updatedAt: now,
  };
  this.userSettingsMap.set(id, newSettings);
  return newSettings;
};

MemStorage.prototype.updateUserSettings = async function(userId: number, settings: Partial<UserSettings>): Promise<UserSettings | undefined> {
  const userSettings = Array.from(this.userSettingsMap.values()).find(setting => setting.userId === userId);
  if (!userSettings) return undefined;
  
  const updatedSettings = {
    ...userSettings,
    ...settings,
    updatedAt: new Date(),
  };
  this.userSettingsMap.set(userSettings.id, updatedSettings);
  return updatedSettings;
};

// Add user settings methods to DatabaseStorage
DatabaseStorage.prototype.getUserSettings = async function(userId: number): Promise<UserSettings | undefined> {
  const [settings] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId));
  return settings || undefined;
};

DatabaseStorage.prototype.createUserSettings = async function(settings: InsertUserSettings): Promise<UserSettings> {
  const [newSettings] = await db
    .insert(userSettings)
    .values(settings)
    .returning();
  return newSettings;
};

DatabaseStorage.prototype.updateUserSettings = async function(userId: number, settings: Partial<UserSettings>): Promise<UserSettings | undefined> {
  const [updatedSettings] = await db
    .update(userSettings)
    .set({
      ...settings,
      updatedAt: new Date(),
    })
    .where(eq(userSettings.userId, userId))
    .returning();
  return updatedSettings || undefined;
};

// Methods for dashboard metrics
DatabaseStorage.prototype.countSchools = async function(): Promise<number> {
  const result = await db.select({ count: sql`count(*)` }).from(schools);
  return Number(result[0].count);
};

DatabaseStorage.prototype.countStudents = async function(): Promise<number> {
  const result = await db.select({ count: sql`count(*)` }).from(students);
  return Number(result[0].count);
};

DatabaseStorage.prototype.countLeads = async function(): Promise<number> {
  const result = await db.select({ count: sql`count(*)` }).from(leads);
  return Number(result[0].count);
};

DatabaseStorage.prototype.countUsersByRole = async function(): Promise<Record<string, number>> {
  const result = await db
    .select({
      role: users.role,
      count: sql`count(*)`,
    })
    .from(users)
    .groupBy(users.role);
  
  const roleCount: Record<string, number> = {};
  for (const row of result) {
    roleCount[row.role] = Number(row.count);
  }
  return roleCount;
};

export const storage = new DatabaseStorage();

// Add notification methods
addNotificationMethodsToDatabaseStorage(storage);

// Importar métodos de WhatsApp
import { addWhatsappMethodsToStorage } from './storage.whatsapp';
addWhatsappMethodsToStorage(storage);
