# Documentação Técnica - Sistema Matricula

## Visão Geral

O Matricula é uma plataforma SaaS desenvolvida para automatizar o processo de matrículas escolares, utilizando tecnologias modernas como inteligência artificial para validação de documentos, integração com WhatsApp, e um sistema completo de gestão de matrículas.

## Arquitetura do Sistema

O sistema utiliza uma arquitetura de aplicação web completa com:

- **Frontend**: React.js com TypeScript, utilizando frameworks modernos de UI como Tailwind CSS e Shadcn UI
- **Backend**: Node.js com Express, fornecendo uma API RESTful
- **Banco de Dados**: PostgreSQL com Drizzle ORM para mapeamento objeto-relacional
- **Autenticação**: Sistema próprio com JWT e Passport.js
- **Integrações**: Stripe (pagamentos), Evolution API (WhatsApp), Pusher (notificações em tempo real)
- **Processamento de Documentos**: Tesseract.js e TensorFlow.js para OCR avançado e validação de documentos

O sistema segue um padrão de arquitetura de camadas:

1. **Camada de Apresentação**: Componentes React no frontend
2. **Camada de API**: Endpoints Express no backend
3. **Camada de Serviços**: Lógica de negócios
4. **Camada de Persistência**: Acesso ao banco de dados via Drizzle ORM

## Estrutura do Projeto

```
/
├── apps/ - Estrutura monorepo para deployment na Vercel
│   ├── api/ - Código backend para Vercel
│   └── web/ - Código frontend para Vercel
├── client/ - Código frontend
│   ├── src/
│   │   ├── components/ - Componentes React reutilizáveis
│   │   ├── hooks/ - Hooks personalizados
│   │   ├── lib/ - Bibliotecas e utilitários
│   │   ├── pages/ - Páginas da aplicação
│   │   └── styles/ - Estilos CSS
├── docs/ - Documentação do projeto
├── server/ - Código backend
│   ├── routes/ - Definições de rotas da API
│   ├── services/ - Serviços e lógica de negócios
│   └── utils/ - Utilitários para o servidor
├── shared/ - Código compartilhado entre frontend e backend
│   └── schema.ts - Esquema de banco de dados com Drizzle
└── uploads/ - Arquivos enviados pelos usuários
```

## Modelos de Dados

O sistema utiliza o Drizzle ORM para definir e gerenciar esquemas de banco de dados. Os principais modelos incluem:

### Usuários
Representam escolas, atendentes, administradores ou alunos no sistema.

```typescript
// Exemplo simplificado do modelo de usuário
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  email: text("email").notNull(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role", { enum: ["admin", "school", "attendant", "student"] }).notNull(),
  phone: text("phone"),
  schoolId: integer("school_id").references(() => schools.id),
  profileImage: text("profile_image"),
  supabaseId: text("supabase_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
```

### Escolas
Entidades que representam as instituições de ensino.

### Matrículas
Processos de matrícula gerenciados pelo sistema.

### Documentos
Documentos enviados pelos alunos para validação.

### Mensagens
Comunicações dentro do sistema ou via WhatsApp.

### Pagamentos
Registros de pagamentos de matrículas.

## Serviços Principais

### 1. Serviço de Autenticação

- Gerencia login, registro e autorização de usuários
- Implementa controle de acesso baseado em função (RBAC)
- Utiliza tokens JWT para autenticação stateless

### 2. Serviço de OCR Avançado

- Realiza reconhecimento ótico de caracteres em documentos
- Valida automaticamente documentos como RG, CPF, comprovante de residência
- Possui sistemas de fallback para garantir funcionamento mesmo em ambiente limitado

```typescript
// Exemplo de uso do serviço OCR
const documentData = await ocrService.analyzeDocument(documentPath, documentType);
```

### 3. Serviço de Integração WhatsApp (Evolution API)

- Gerencia conexões com instâncias do WhatsApp
- Envia e recebe mensagens através da Evolution API
- Processa webhooks de atualizações de mensagens

```typescript
// Exemplo de envio de mensagem via WhatsApp
await evolutionApiService.sendMessage(instanceId, phoneNumber, "Confirmação de matrícula realizada com sucesso!");
```

### 4. Serviço de Pagamentos

- Integra com múltiplos processadores de pagamento (Stripe, Asaas, Gerencianet)
- Gerencia assinaturas e pagamentos únicos
- Implementa estratégia de fallback entre processadores

```typescript
// Exemplo de criação de sessão de pagamento
const checkoutSession = await paymentService.createCheckoutSession({
  amount: 100,
  currency: "BRL",
  customerId: user.id,
  description: "Pagamento de matrícula"
});
```

### 5. Serviço de Notificações

- Utiliza Pusher para entregar notificações em tempo real
- Gerencia canais de comunicação privados entre usuários
- Envia notificações por WhatsApp, e-mail e dentro do sistema

### 6. Serviço de Analytics

- Coleta métricas do processo de matrícula
- Gera relatórios de desempenho
- Oferece insights para otimização do processo

## Fluxos Principais

### 1. Processo de Matrícula

1. Aluno submete formulário de matrícula
2. Sistema gera lista de documentos necessários
3. Aluno envia documentos (via web ou WhatsApp)
4. Documentos são validados automaticamente via OCR
5. Atendentes revisam documentos que precisam de validação manual
6. Aluno recebe confirmação e link para pagamento
7. Após pagamento, matrícula é finalizada

### 2. Validação de Documentos

1. Documento é recebido (upload web ou via WhatsApp)
2. OCR extrai dados do documento
3. Sistema valida dados extraídos contra informações fornecidas
4. Em caso de divergência ou incerteza, documento é marcado para revisão manual
5. Atendente revisa e aprova ou rejeita o documento
6. Resultado é comunicado ao aluno

## Segurança

O sistema implementa várias camadas de segurança:

- **Autenticação**: Sistema baseado em JWT com tokens de acesso e refresh
- **Autorização**: Controle de acesso baseado em funções (RBAC)
- **Proteção de Dados**: Criptografia de dados sensíveis em repouso
- **Segurança do Usuário**: Proteção contra ataques comuns (XSS, CSRF, injeção SQL)
- **Conformidade LGPD**: Práticas de acordo com a Lei Geral de Proteção de Dados

## Integrações Externas

### 1. Stripe
Para processamento de pagamentos via cartão.

### 2. Evolution API
Para integração com WhatsApp, permitindo envio e recebimento de mensagens.

### 3. Pusher
Para notificações em tempo real e chat interno.

### 4. Provedores de Email
Para envio de notificações por email.

## Implantação

O sistema pode ser implantado em:

1. **Replit**: Para desenvolvimento e testes
2. **Vercel**: Para produção, utilizando a estrutura monorepo em `/apps`

### Variáveis de Ambiente Necessárias

```
# Banco de Dados
DATABASE_URL=postgresql://user:password@host:port/database

# Segurança
JWT_SECRET=your_jwt_secret
ENCRYPTION_KEY=your_encryption_key

# Stripe
STRIPE_SECRET_KEY=sk_...
VITE_STRIPE_PUBLIC_KEY=pk_...

# Pusher
PUSHER_APP_ID=...
PUSHER_APP_KEY=...
PUSHER_APP_SECRET=...
PUSHER_APP_CLUSTER=...

# Evolution API (WhatsApp)
EVOLUTION_API_URL=...
EVOLUTION_API_KEY=...

# Email
RESEND_API_KEY=...
```

## Cenários de Fallback

O sistema possui mecanismos de fallback para garantir operação contínua mesmo em cenários adversos:

1. **Fallback de Processadores de Pagamento**: Se o Stripe estiver indisponível, o sistema tenta Asaas, Gerencianet e por fim o processamento manual.

2. **Fallback de OCR**: Se o OCR falhar, o sistema marca o documento para revisão manual.

3. **Fallback de WhatsApp**: Se a Evolution API estiver indisponível, o sistema utiliza notificações internas e email.

## Testes

O sistema suporta diferentes níveis de testes:

- **Testes Unitários**: Para funções e serviços individuais
- **Testes de API**: Para endpoints da API REST
- **Testes End-to-End**: Para fluxos completos de usuário

## Manutenção e Monitoramento

O sistema inclui ferramentas para manutenção e monitoramento:

- **Logs**: Sistema de logs detalhados para diagnóstico de problemas
- **Métricas**: Coleta de métricas de desempenho
- **Alertas**: Configuração de alertas para situações críticas

## Roadmap Técnico

Próximos passos de desenvolvimento técnico:

1. Implementação completa da integração Evolution API
2. Melhorias no OCR para suportar mais tipos de documentos
3. Expansão das funcionalidades de relatórios e analytics
4. Otimização de performance para escala maior
5. Implementação de microsserviços para maior escalabilidade

## Contatos para Suporte Técnico

- **Suporte de Desenvolvimento**: dev@matricula.pro
- **Suporte de Infraestrutura**: infra@matricula.pro
- **Reportar Bugs**: bugs@matricula.pro

---

Documentação gerada em: Abril de 2025
Versão do Sistema: 1.0.0