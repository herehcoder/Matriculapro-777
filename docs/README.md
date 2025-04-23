# Documentação Matricula

![Logo Matricula](https://example.com/matricula-logo.png)

Bem-vindo à documentação oficial do **Matricula** - sistema avançado de automação de matrículas escolares com inteligência artificial.

## Sobre o Matricula

O Matricula é uma plataforma SaaS completa projetada para revolucionar o processo de matrículas em instituições de ensino. Utilizando tecnologias modernas como OCR avançado com IA, integração com WhatsApp e processamento automatizado de documentos, o Matricula elimina processos manuais e reduz significativamente o tempo gasto em procedimentos administrativos.

## Documentação Disponível

### Documentação para Usuários

* [Manual do Usuário](https://docs.matricula.pro/manual) - Guia completo para uso da plataforma
* [Perguntas Frequentes](https://docs.matricula.pro/faq) - Dúvidas comuns sobre uso da plataforma
* [Guia Rápido](https://docs.matricula.pro/quickstart) - Primeiros passos com o Matricula

### Documentação Técnica

* [Documentação Técnica Geral](./documentacao-tecnica.md) - Visão geral técnica do sistema
* [Guia de Instalação e Configuração](./guia-instalacao.md) - Como instalar e configurar o sistema
* [Integração com WhatsApp](./integracao-whatsapp.md) - Detalhes sobre a integração com Evolution API e WhatsApp
* [Serviço de OCR Avançado](./servico-ocr-avancado.md) - Funcionalidades de processamento e validação de documentos

### Documentação para Desenvolvedores

* [API Reference](https://api.matricula.pro/docs) - Documentação da API REST
* [Contribuição](https://github.com/matricula/docs/contributing.md) - Como contribuir com o desenvolvimento
* [Histórico de Versões](https://github.com/matricula/docs/changelog.md) - Histórico de alterações por versão

## Arquitetura Geral do Sistema

```
+-------------+     +----------------+     +----------------+
|             |     |                |     |                |
|  Frontend   +---->+    Backend    +---->+   Database     |
|  (React)    |     |   (Express)   |     |  (PostgreSQL)  |
|             |     |                |     |                |
+------+------+     +--------+-------+     +----------------+
       ^                     |
       |                     v
       |            +--------+-------+
       |            |                |
       |            |   Integrações  |
       +------------+    Externas    |
                    |                |
                    +----------------+
                          |  |  |
                          v  v  v
              +-----------+  |  +-----------+
              |              |              |
              v              v              v
      +-------+-----+ +------+------+ +-----+-------+
      |             | |             | |             |
      |   Stripe    | |  Evolution  | |   Pusher    |
      | (Payments)  | |     API     | | (Realtime)  |
      |             | | (WhatsApp)  | |             |
      +-------------+ +-------------+ +-------------+
```

## Principais Funcionalidades

- **Validação Inteligente de Documentos**: OCR avançado com IA para validação automática
- **Integração com WhatsApp**: Comunicação direta com alunos via WhatsApp
- **Formulários Dinâmicos**: Formulários personalizáveis para cada instituição
- **Gestão de Pagamentos**: Integração completa com processadores de pagamento
- **Analytics em Tempo Real**: Métricas detalhadas sobre o processo de matrícula
- **Multi-tenancy**: Suporte para múltiplas escolas na mesma plataforma
- **Conformidade LGPD**: Proteção de dados de acordo com a legislação

## Requisitos de Sistema

- **Frontend**: Navegador moderno (Chrome, Firefox, Safari, Edge)
- **Backend**: Node.js 16+, PostgreSQL 12+
- **Mobile**: Android 7+ ou iOS 12+ para acesso via WhatsApp

## Suporte e Contato

Para suporte técnico ou dúvidas sobre a documentação:

- **Email**: support@matricula.pro
- **Chat**: [Suporte ao Vivo](https://matricula.pro/suporte)
- **Telefone**: +55 (11) 9999-9999

## Licenciamento

O Matricula é uma plataforma proprietária licenciada por assinatura. Consulte os [Termos de Serviço](https://matricula.pro/terms) e a [Política de Privacidade](https://matricula.pro/privacy) para mais detalhes.

---

© 2025 Matricula. Todos os direitos reservados.