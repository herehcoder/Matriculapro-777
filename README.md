# EduMatrik AI

<p align="center">
  <img src="generated-icon.png" alt="EduMatrik AI Logo" width="180"/>
</p>

<p align="center">
  <strong>Plataforma inteligente para gestão completa do processo de matrícula escolar</strong>
</p>

<p align="center">
  <a href="#visão-geral">Visão Geral</a> •
  <a href="#funcionalidades">Funcionalidades</a> •
  <a href="#tecnologias">Tecnologias</a> •
  <a href="#arquitetura">Arquitetura</a> •
  <a href="#instalação">Instalação</a> •
  <a href="#configuração">Configuração</a> •
  <a href="#uso">Uso</a> •
  <a href="#api">API</a> •
  <a href="#status">Status</a> •
  <a href="#licença">Licença</a>
</p>

---

## Visão Geral

EduMatrik AI é uma plataforma SaaS (Software as a Service) desenvolvida para automatizar e otimizar o processo completo de matrícula escolar. Desde a captação inicial do candidato até a efetivação da matrícula, o sistema integra processamento inteligente de documentos, pagamentos online e comunicação automatizada via WhatsApp.

### Objetivos do Projeto

- ⏱️ **Redução no tempo de processamento** das matrículas
- 🛡️ **Eliminação de erros manuais** na transcrição e validação de dados
- 🌟 **Melhoria na experiência do candidato** durante todo o processo
- 💬 **Comunicação automatizada** via WhatsApp para notificações e suporte
- 📊 **Insights baseados em dados** para tomada de decisão estratégica

## Funcionalidades

### Sistema Multiusuário
- **Administrador**: Gestão completa do sistema e configurações
- **Gestores Escolares**: Gerenciamento de matrículas e alunos
- **Atendentes**: Suporte e acompanhamento de processos
- **Estudantes**: Autoatendimento e acompanhamento da matrícula

### Processo de Matrícula
- Formulário multi-etapas com validações em tempo real
- Upload e validação automática de documentos
- Pagamento online integrado
- Acompanhamento do status em tempo real

### Inteligência Artificial
- OCR avançado para extração automática de dados de documentos
- Validação cruzada entre diferentes documentos
- Detecção de inconsistências e alertas
- Sistema de fallback para garantir resiliência

### Integrações
- **WhatsApp**: Notificações, lembretes e atendimento via chatbot
- **Pagamento**: Integração completa com gateway Stripe
- **Notificações**: Sistema em tempo real via Pusher

### Segurança e Conformidade
- Autenticação segura e controle de acesso baseado em funções
- Logging completo de ações para auditoria
- Criptografia de dados sensíveis
- Conformidade com LGPD (Lei Geral de Proteção de Dados)

### Análise e Relatórios
- Dashboard interativo com métricas principais
- Relatórios personalizáveis de matrículas e conversões
- Análise de gargalos no processo
- Exportação de dados em formatos padrão

## Tecnologias

### Backend
- **Node.js** e **Express**: Framework para API RESTful
- **TypeScript**: Tipagem estática para maior segurança
- **PostgreSQL**: Banco de dados relacional robusto
- **Drizzle ORM**: Mapeamento objeto-relacional tipado

### Frontend
- **React**: Biblioteca para interfaces de usuário
- **TypeScript**: Desenvolvimento frontend tipado
- **TailwindCSS**: Framework CSS utilitário
- **ShadCN UI**: Componentes acessíveis e reutilizáveis

### Serviços Integrados
- **Tesseract.js**: OCR (Reconhecimento Óptico de Caracteres)
- **Stripe**: Gateway de pagamento seguro
- **Evolution API**: Integração oficial com WhatsApp
- **Pusher**: Sistema de notificações em tempo real

### DevOps e Infraestrutura
- **Replit**: Ambiente de desenvolvimento e hospedagem
- **REST API**: Comunicação padronizada entre serviços
- **WebSockets**: Comunicação em tempo real

## Arquitetura

O sistema é baseado em uma arquitetura modular com os seguintes componentes principais:

- **API RESTful**: Backend Express com endpoints para todas as operações
- **Banco de Dados Relacional**: PostgreSQL com esquema otimizado
- **Serviços Modulares**: 
  - Serviço OCR (Processamento de Documentos)
  - Serviço WhatsApp (Comunicação)
  - Serviço de Pagamento (Transações financeiras)
  - Serviço de Autenticação e Autorização
- **Interface SPA**: Single Page Application em React

## Instalação

### Pré-requisitos
- Node.js 18.x ou superior
- PostgreSQL 14.x ou superior
- Conta Stripe para pagamentos (opcional)
- Instância da Evolution API para WhatsApp (opcional)

### Passos para Instalação

1. Clone o repositório:
```bash
git clone https://github.com/seu-usuario/edumatrik-ai.git
cd edumatrik-ai
```

2. Instale as dependências:
```bash
npm install
```

3. Configure o banco de dados:
```bash
# Crie o banco de dados PostgreSQL
createdb edumatrik

# Configure as tabelas
npm run db:push
```

## Configuração

### Variáveis de Ambiente
Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```
# Banco de Dados
DATABASE_URL=postgresql://usuario:senha@localhost:5432/edumatrik

# Stripe (Pagamentos)
VITE_STRIPE_PUBLIC_KEY=pk_test_sua_chave_publica
STRIPE_SECRET_KEY=sk_test_sua_chave_secreta

# Pusher (Notificações em tempo real)
PUSHER_APP_ID=seu_app_id
PUSHER_APP_KEY=sua_app_key
PUSHER_APP_SECRET=seu_app_secret
PUSHER_APP_CLUSTER=sua_regiao

# Evolution API (WhatsApp)
EVOLUTION_API_URL=https://sua-instancia-evolution.api
EVOLUTION_API_KEY=sua_api_key

# Email (opcional)
RESEND_API_KEY=sua_resend_api_key
```

## Uso

### Iniciando o Servidor de Desenvolvimento

```bash
npm run dev
```

Acesse a aplicação em `http://localhost:5000`

### Compilando para Produção

```bash
npm run build
npm start
```

### Gerando Migrations do Banco de Dados

```bash
npm run db:generate
npm run db:push
```

## API

### Principais Endpoints

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/auth/login` | POST | Autenticação de usuários |
| `/api/auth/register` | POST | Registro de novos usuários |
| `/api/enrollment` | POST | Criação de nova matrícula |
| `/api/enrollment/:id` | GET | Obtenção de matrícula específica |
| `/api/ocr/process` | POST | Processamento de documento via OCR |
| `/api/payment/create-intent` | POST | Criação de intenção de pagamento |
| `/api/whatsapp/send` | POST | Envio de mensagem via WhatsApp |

Para documentação completa da API, consulte o [Guia da API](./docs/api.md).

## Status

O projeto está em **Desenvolvimento Ativo**.

### Pendências e Desenvolvimento Futuro

- Implementação de análise preditiva para conversão de leads
- Expansão da integração com sistemas escolares legados
- Implementação de módulo para reconhecimento de digitalizações de baixa qualidade

## Licença

Copyright © 2024 EduMatrik AI

Todos os direitos reservados. Este software é propriedade da EduMatrik AI e não pode ser redistribuído sem autorização expressa.

---

<p align="center">
  Desenvolvido com ❤️ pela equipe EduMatrik AI
</p>