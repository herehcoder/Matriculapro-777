import { DrizzleClient } from 'drizzle-orm/pg-core';
import * as schema from './shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

export class Storage {
  private db: DrizzleClient;

  constructor(db: DrizzleClient) {
    this.db = db;
  }

  // Métodos para usuários
  async getUser(id: number) {
    const [user] = await this.db.select().from(schema.users).where(eq(schema.users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string) {
    const [user] = await this.db.select().from(schema.users).where(eq(schema.users.username, username));
    return user || undefined;
  }

  async createUser(data: any) {
    const [user] = await this.db.insert(schema.users).values(data).returning();
    return user;
  }

  // Métodos para escolas
  async getSchool(id: number) {
    const [school] = await this.db.select().from(schema.schools).where(eq(schema.schools.id, id));
    return school || undefined;
  }

  async listSchools() {
    return await this.db.select().from(schema.schools);
  }

  // Métodos para cursos
  async getCourse(id: number) {
    const [course] = await this.db.select().from(schema.courses).where(eq(schema.courses.id, id));
    return course || undefined;
  }

  async listCourses(schoolId?: number) {
    if (schoolId) {
      return await this.db.select().from(schema.courses).where(eq(schema.courses.schoolId, schoolId));
    }
    return await this.db.select().from(schema.courses);
  }

  // Métodos para matrículas
  async getEnrollment(id: number) {
    const [enrollment] = await this.db.select().from(schema.enrollments).where(eq(schema.enrollments.id, id));
    return enrollment || undefined;
  }

  async listEnrollments(filters: any = {}) {
    const { schoolId, status, courseId, studentId } = filters;
    
    let query = this.db.select().from(schema.enrollments);
    
    if (schoolId) {
      query = query.where(eq(schema.enrollments.schoolId, schoolId));
    }
    
    if (status) {
      query = query.where(eq(schema.enrollments.status, status));
    }
    
    if (courseId) {
      query = query.where(eq(schema.enrollments.courseId, courseId));
    }
    
    if (studentId) {
      query = query.where(eq(schema.enrollments.studentId, studentId));
    }
    
    return await query.orderBy(desc(schema.enrollments.createdAt));
  }

  async createEnrollment(data: any) {
    const [enrollment] = await this.db.insert(schema.enrollments).values(data).returning();
    return enrollment;
  }

  async updateEnrollment(id: number, data: any) {
    const [updated] = await this.db
      .update(schema.enrollments)
      .set(data)
      .where(eq(schema.enrollments.id, id))
      .returning();
    return updated;
  }

  // Adicione outros métodos conforme necessário para sua aplicação
}