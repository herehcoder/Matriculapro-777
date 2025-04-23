import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "./db";
import {
  whatsappInstances,
  whatsappContacts,
  whatsappMessages,
  WhatsappInstance,
  InsertWhatsappInstance,
  WhatsappContact,
  InsertWhatsappContact,
  WhatsappMessage,
  InsertWhatsappMessage
} from "../shared/whatsapp.schema";

/**
 * Adiciona métodos de WhatsApp ao DatabaseStorage
 * @param dbStorage Instância de DatabaseStorage
 */
export function addWhatsappMethodsToStorage(dbStorage: any) {
  /**
   * Busca uma instância de WhatsApp pelo ID
   * @param id ID da instância
   * @returns Instância ou undefined se não encontrada
   */
  dbStorage.getWhatsappInstance = async function(id: number): Promise<WhatsappInstance | undefined> {
    const [instance] = await db.select().from(whatsappInstances).where(eq(whatsappInstances.id, id));
    return instance;
  };

  /**
   * Busca uma instância de WhatsApp pelo ID da escola
   * @param schoolId ID da escola
   * @returns Instância ou undefined se não encontrada
   */
  dbStorage.getWhatsappInstanceBySchool = async function(schoolId: number): Promise<WhatsappInstance | undefined> {
    const [instance] = await db.select().from(whatsappInstances)
      .where(eq(whatsappInstances.schoolId, schoolId))
      .orderBy(desc(whatsappInstances.createdAt))
      .limit(1);
    return instance;
  };

  /**
   * Lista todas as instâncias de WhatsApp
   * @param activeOnly Filtra apenas por instâncias ativas
   * @returns Lista de instâncias
   */
  dbStorage.listWhatsappInstances = async function(activeOnly: boolean = false): Promise<WhatsappInstance[]> {
    let query = db.select().from(whatsappInstances);
    
    if (activeOnly) {
      query = query.where(eq(whatsappInstances.active, true));
    }
    
    return await query.orderBy(desc(whatsappInstances.updatedAt));
  };

  /**
   * Cria uma nova instância de WhatsApp
   * @param data Dados da instância
   * @returns Instância criada
   */
  dbStorage.createWhatsappInstance = async function(data: InsertWhatsappInstance): Promise<WhatsappInstance> {
    const [instance] = await db.insert(whatsappInstances).values(data).returning();
    return instance;
  };

  /**
   * Atualiza uma instância de WhatsApp
   * @param id ID da instância
   * @param data Dados para atualização
   * @returns Instância atualizada
   */
  dbStorage.updateWhatsappInstance = async function(id: number, data: Partial<InsertWhatsappInstance>): Promise<WhatsappInstance> {
    const [instance] = await db.update(whatsappInstances)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(whatsappInstances.id, id))
      .returning();
    return instance;
  };

  /**
   * Atualiza o status de uma instância de WhatsApp
   * @param id ID da instância
   * @param status Novo status
   * @param qrcode QR Code (opcional)
   * @returns Instância atualizada
   */
  dbStorage.updateWhatsappInstanceStatus = async function(
    id: number, 
    status: string, 
    qrcode?: string
  ): Promise<WhatsappInstance> {
    const data: any = { 
      status, 
      updatedAt: new Date() 
    };
    
    if (qrcode !== undefined) {
      data.qrcode = qrcode;
    }
    
    const [instance] = await db.update(whatsappInstances)
      .set(data)
      .where(eq(whatsappInstances.id, id))
      .returning();
      
    return instance;
  };

  /**
   * Exclui uma instância de WhatsApp
   * @param id ID da instância
   * @returns true se excluído com sucesso
   */
  dbStorage.deleteWhatsappInstance = async function(id: number): Promise<boolean> {
    const result = await db.delete(whatsappInstances)
      .where(eq(whatsappInstances.id, id));
    return !!result;
  };

  // Métodos para Contatos
  /**
   * Busca um contato pelo ID
   * @param id ID do contato
   * @returns Contato ou undefined se não encontrado
   */
  dbStorage.getWhatsappContact = async function(id: number): Promise<WhatsappContact | undefined> {
    const [contact] = await db.select().from(whatsappContacts).where(eq(whatsappContacts.id, id));
    return contact;
  };

  /**
   * Busca um contato pelo número e instância
   * @param instanceId ID da instância
   * @param phone Número de telefone
   * @returns Contato ou undefined se não encontrado
   */
  dbStorage.getWhatsappContactByPhone = async function(
    instanceId: number, 
    phone: string
  ): Promise<WhatsappContact | undefined> {
    const [contact] = await db.select().from(whatsappContacts)
      .where(
        and(
          eq(whatsappContacts.instanceId, instanceId),
          eq(whatsappContacts.phone, phone)
        )
      );
    return contact;
  };

  /**
   * Lista contatos de uma instância
   * @param instanceId ID da instância
   * @returns Lista de contatos
   */
  dbStorage.listWhatsappContacts = async function(instanceId: number): Promise<WhatsappContact[]> {
    return await db.select().from(whatsappContacts)
      .where(eq(whatsappContacts.instanceId, instanceId))
      .orderBy(desc(whatsappContacts.lastMessageAt));
  };

  /**
   * Cria um novo contato
   * @param data Dados do contato
   * @returns Contato criado
   */
  dbStorage.createWhatsappContact = async function(data: InsertWhatsappContact): Promise<WhatsappContact> {
    const [contact] = await db.insert(whatsappContacts).values(data).returning();
    return contact;
  };

  /**
   * Atualiza um contato
   * @param id ID do contato
   * @param data Dados para atualização
   * @returns Contato atualizado
   */
  dbStorage.updateWhatsappContact = async function(id: number, data: Partial<InsertWhatsappContact>): Promise<WhatsappContact> {
    const [contact] = await db.update(whatsappContacts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(whatsappContacts.id, id))
      .returning();
    return contact;
  };

  /**
   * Atualiza ou cria um contato pelo número e instância
   * @param instanceId ID da instância
   * @param phone Número do telefone
   * @param data Dados do contato
   * @returns Contato atualizado ou criado
   */
  dbStorage.upsertWhatsappContact = async function(
    instanceId: number, 
    phone: string, 
    data: Partial<InsertWhatsappContact>
  ): Promise<WhatsappContact> {
    const existingContact = await this.getWhatsappContactByPhone(instanceId, phone);
    
    if (existingContact) {
      return await this.updateWhatsappContact(existingContact.id, data);
    } else {
      return await this.createWhatsappContact({
        instanceId,
        phone,
        ...data
      } as InsertWhatsappContact);
    }
  };

  // Métodos para Mensagens
  /**
   * Busca uma mensagem pelo ID
   * @param id ID da mensagem
   * @returns Mensagem ou undefined se não encontrada
   */
  dbStorage.getWhatsappMessage = async function(id: number): Promise<WhatsappMessage | undefined> {
    const [message] = await db.select().from(whatsappMessages).where(eq(whatsappMessages.id, id));
    return message;
  };

  /**
   * Busca uma mensagem pelo ID externo
   * @param externalId ID externo da mensagem
   * @returns Mensagem ou undefined se não encontrada
   */
  dbStorage.getWhatsappMessageByExternalId = async function(externalId: string): Promise<WhatsappMessage | undefined> {
    const [message] = await db.select().from(whatsappMessages).where(eq(whatsappMessages.externalId, externalId));
    return message;
  };

  /**
   * Lista mensagens de um contato
   * @param contactId ID do contato
   * @param limit Limite de mensagens
   * @param offset Offset para paginação
   * @returns Lista de mensagens
   */
  dbStorage.listWhatsappMessagesByContact = async function(
    contactId: number, 
    limit: number = 50, 
    offset: number = 0
  ): Promise<WhatsappMessage[]> {
    return await db.select().from(whatsappMessages)
      .where(eq(whatsappMessages.contactId, contactId))
      .orderBy(desc(whatsappMessages.createdAt))
      .limit(limit)
      .offset(offset);
  };

  /**
   * Cria uma nova mensagem
   * @param data Dados da mensagem
   * @returns Mensagem criada
   */
  dbStorage.createWhatsappMessage = async function(data: InsertWhatsappMessage): Promise<WhatsappMessage> {
    // Atualiza lastMessageAt do contato
    await db.update(whatsappContacts)
      .set({ 
        lastMessageAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(whatsappContacts.id, data.contactId));
      
    const [message] = await db.insert(whatsappMessages).values(data).returning();
    return message;
  };

  /**
   * Atualiza o status de uma mensagem
   * @param id ID da mensagem
   * @param status Novo status
   * @param statusTimestamp Timestamp do status (opcional)
   * @returns Mensagem atualizada
   */
  dbStorage.updateWhatsappMessageStatus = async function(
    id: number, 
    status: string,
    statusTimestamp?: Date
  ): Promise<WhatsappMessage> {
    const data: any = { 
      status, 
      updatedAt: new Date() 
    };
    
    // Atualiza timestamp específico baseado no status
    if (statusTimestamp) {
      if (status === 'sent') data.sentAt = statusTimestamp;
      if (status === 'delivered') data.deliveredAt = statusTimestamp;
      if (status === 'read') data.readAt = statusTimestamp;
    }
    
    const [message] = await db.update(whatsappMessages)
      .set(data)
      .where(eq(whatsappMessages.id, id))
      .returning();
      
    return message;
  };

  /**
   * Atualiza o status de uma mensagem pelo ID externo
   * @param externalId ID externo da mensagem
   * @param status Novo status
   * @param statusTimestamp Timestamp do status (opcional)
   * @returns Mensagem atualizada ou null se não encontrada
   */
  dbStorage.updateWhatsappMessageStatusByExternalId = async function(
    externalId: string, 
    status: string,
    statusTimestamp?: Date
  ): Promise<WhatsappMessage | null> {
    const message = await this.getWhatsappMessageByExternalId(externalId);
    if (!message) return null;
    
    return await this.updateWhatsappMessageStatus(message.id, status, statusTimestamp);
  };

  /**
   * Busca as conversas recentes de uma instância
   * @param instanceId ID da instância
   * @param limit Limite de conversas
   * @returns Lista de contatos com a última mensagem
   */
  dbStorage.getWhatsappRecentConversations = async function(
    instanceId: number,
    limit: number = 20
  ): Promise<any[]> {
    // Usamos uma subconsulta para otimizar a busca das últimas mensagens
    const subquery = db
      .select({
        contactId: whatsappMessages.contactId,
        maxCreatedAt: sql<Date>`MAX(${whatsappMessages.createdAt})`.as('max_created_at')
      })
      .from(whatsappMessages)
      .where(eq(whatsappMessages.instanceId, instanceId))
      .groupBy(whatsappMessages.contactId)
      .as('latest_msgs');

    // Inner join para trazer as mensagens mais recentes
    const conversations = await db
      .select({
        contact: whatsappContacts,
        lastMessage: whatsappMessages
      })
      .from(whatsappContacts)
      .innerJoin(
        subquery,
        eq(whatsappContacts.id, subquery.contactId)
      )
      .innerJoin(
        whatsappMessages,
        and(
          eq(whatsappMessages.contactId, subquery.contactId),
          eq(whatsappMessages.createdAt, subquery.maxCreatedAt)
        )
      )
      .where(eq(whatsappContacts.instanceId, instanceId))
      .orderBy(desc(subquery.maxCreatedAt))
      .limit(limit);

    return conversations;
  };
}