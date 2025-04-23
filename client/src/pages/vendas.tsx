import React from 'react';
import { Helmet } from 'react-helmet';
import { CheckCircle, Star, Award, Users, Book, Shield, ArrowRight, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';

// Componentes
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Interfaces para tipagem
interface Testimonial {
  id: number;
  name: string;
  role: string;
  content: string;
  rating: number;
  image: string;
}

interface PricingPlan {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  popular: boolean;
}

interface Faq {
  question: string;
  answer: string;
}

// Dados de demonstração para depoimentos
const testimonials: Testimonial[] = [
  {
    id: 1,
    name: 'Maria Silva',
    role: 'Diretora Escola Novo Futuro',
    content: 'O EduMatrik AI transformou completamente nosso processo de matrícula. Reduzimos o tempo de processamento em 80% e eliminamos praticamente todos os erros de documentação.',
    rating: 5,
    image: 'https://randomuser.me/api/portraits/women/32.jpg'
  },
  {
    id: 2,
    name: 'Carlos Santos',
    role: 'Coordenador Pedagógico',
    content: 'A validação automática de documentos é impressionante. Nossos atendentes agora têm tempo para oferecer um suporte de maior qualidade para os pais e alunos.',
    rating: 5,
    image: 'https://randomuser.me/api/portraits/men/42.jpg'
  },
  {
    id: 3,
    name: 'Fernanda Lima',
    role: 'Secretária Escolar',
    content: 'A integração com WhatsApp facilitou muito a comunicação com os pais. Agora enviamos lembretes automáticos e recebemos documentos diretamente pelo aplicativo.',
    rating: 5,
    image: 'https://randomuser.me/api/portraits/women/56.jpg'
  }
];

// Dados dos planos de preço
const pricingPlans: PricingPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 'R$ 297',
    period: '/mês',
    description: 'Ideal para escolas pequenas com até 200 alunos',
    features: [
      'Matrículas ilimitadas',
      'Validação básica de documentos',
      'Até 2 usuários administrativos',
      'Suporte por email',
      'Até 500 mensagens WhatsApp/mês',
      'Relatórios mensais'
    ],
    cta: 'Começar agora',
    popular: false
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 'R$ 597',
    period: '/mês',
    description: 'Perfeito para instituições em crescimento com até 500 alunos',
    features: [
      'Tudo do plano Starter',
      'Validação avançada com IA',
      'Até 10 usuários administrativos',
      'Suporte prioritário',
      'Até 2.000 mensagens WhatsApp/mês',
      'Painel de análise avançado',
      'Integração com sistemas de pagamento'
    ],
    cta: 'Escolher plano Pro',
    popular: true
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 'R$ 997',
    period: '/mês',
    description: 'Solução completa para grandes instituições educacionais',
    features: [
      'Tudo do plano Pro',
      'Usuários ilimitados',
      'Suporte dedicado 24/7',
      'Mensagens WhatsApp ilimitadas',
      'Reconhecimento avançado de documentos',
      'API completa para integrações personalizadas',
      'Treinamento e implementação inclusos'
    ],
    cta: 'Contatar vendas',
    popular: false
  }
];

// FAQs
const faqs: Faq[] = [
  {
    question: 'Quanto tempo leva para implementar o EduMatrik AI?',
    answer: 'A implementação básica pode ser concluída em apenas 48 horas. Nosso time de onboarding guiará sua equipe durante todo o processo, e você poderá começar a usar as funcionalidades principais de forma imediata, enquanto personalizações adicionais são implementadas nas semanas seguintes.'
  },
  {
    question: 'Minha escola precisa de algum hardware especial?',
    answer: 'Não, o EduMatrik AI é uma solução 100% em nuvem. Você só precisa de computadores ou dispositivos móveis com acesso à internet. Não há necessidade de servidores ou equipamentos adicionais.'
  },
  {
    question: 'Como funciona a validação de documentos por IA?',
    answer: 'Nossa tecnologia utiliza algoritmos avançados de reconhecimento óptico de caracteres e aprendizado de máquina para verificar a autenticidade e completude dos documentos. O sistema identifica automaticamente informações relevantes como nomes, RG, CPF e endereço, compara os dados entre diferentes documentos e alerta sobre possíveis inconsistências.'
  },
  {
    question: 'O sistema pode ser integrado com o software de gestão que já utilizamos?',
    answer: 'Sim, o EduMatrik AI oferece APIs para integração com os principais sistemas de gestão escolar do mercado. Nos planos Pro e Premium, fornecemos suporte técnico para garantir uma integração perfeita com seu software atual.'
  },
  {
    question: 'Qual a garantia oferecida?',
    answer: 'Oferecemos garantia de 30 dias com reembolso total. Se você não estiver completamente satisfeito com o EduMatrik AI, basta solicitar o cancelamento dentro desse período para receber 100% do valor investido de volta, sem questionamentos.'
  },
  {
    question: 'Quais métodos de pagamento são aceitos?',
    answer: 'Aceitamos cartões de crédito, PIX e boleto bancário. Para planos anuais, oferecemos opções de pagamento parcelado sem juros.'
  }
];

// Componentes individuais
const TestimonialCard: React.FC<{ testimonial: Testimonial }> = ({ testimonial }) => (
  <Card className="h-full">
    <CardHeader>
      <div className="flex items-center space-x-4">
        <img 
          src={testimonial.image} 
          alt={testimonial.name}
          className="w-12 h-12 rounded-full object-cover" 
        />
        <div>
          <CardTitle className="text-lg">{testimonial.name}</CardTitle>
          <CardDescription>{testimonial.role}</CardDescription>
        </div>
      </div>
      <div className="flex mt-2">
        {Array(testimonial.rating).fill(0).map((_, i) => (
          <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
        ))}
      </div>
    </CardHeader>
    <CardContent>
      <p className="text-gray-700">"{testimonial.content}"</p>
    </CardContent>
  </Card>
);

const PricingCard: React.FC<{ plan: PricingPlan }> = ({ plan }) => (
  <Card className={`h-full flex flex-col ${plan.popular ? 'border-primary shadow-lg relative' : ''}`}>
    {plan.popular && (
      <div className="absolute -top-4 left-0 right-0 flex justify-center">
        <Badge className="bg-primary text-white px-3 py-1">Mais Popular</Badge>
      </div>
    )}
    <CardHeader className={`${plan.popular ? 'pt-6' : ''}`}>
      <CardTitle className="text-2xl">{plan.name}</CardTitle>
      <div className="mt-2">
        <span className="text-3xl font-bold">{plan.price}</span>
        <span className="text-gray-500 ml-1">{plan.period}</span>
      </div>
      <CardDescription className="mt-2">{plan.description}</CardDescription>
    </CardHeader>
    <CardContent className="flex-grow">
      <ul className="space-y-3">
        {plan.features.map((feature: string, index: number) => (
          <li key={index} className="flex items-center">
            <CheckCircle className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </CardContent>
    <CardFooter>
      <Button 
        className={`w-full ${plan.popular ? 'bg-primary hover:bg-primary/90' : ''}`}
        variant={plan.popular ? 'default' : 'outline'}
        onClick={() => window.location.href = '/register'}
      >
        {plan.cta}
        <ArrowRight className="ml-2 w-4 h-4" />
      </Button>
    </CardFooter>
  </Card>
);

interface FaqItemProps {
  faq: Faq;
  isOpen: boolean;
  toggleFaq: () => void;
}

const FaqItem: React.FC<FaqItemProps> = ({ faq, isOpen, toggleFaq }) => (
  <div className="border-b border-gray-200 py-4">
    <button
      className="flex justify-between items-center w-full text-left font-medium"
      onClick={toggleFaq}
    >
      <span>{faq.question}</span>
      <ChevronDown 
        className={`w-5 h-5 text-gray-500 transform transition-transform ${isOpen ? 'rotate-180' : ''}`}
      />
    </button>
    {isOpen && (
      <div className="mt-2 text-gray-600">
        <p>{faq.answer}</p>
      </div>
    )}
  </div>
);

// Página principal de vendas
export default function VendasPage() {
  const [openFaq, setOpenFaq] = React.useState<number | null>(null);
  
  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.5
      }
    }
  };

  return (
    <>
      <Helmet>
        <title>EduMatrik AI | Revolucione o processo de matrículas da sua escola</title>
        <meta name="description" content="Sistema inteligente com IA para automação completa de matrículas escolares. Reduza erros, economize tempo e melhore a experiência de pais e alunos." />
        <meta property="og:title" content="EduMatrik AI | Automação inteligente de matrículas escolares" />
        <meta property="og:description" content="Reduza em até 80% o tempo gasto com processos de matrícula usando nossa plataforma com inteligência artificial." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://edumatrik.ai/vendas" />
      </Helmet>
      
      <div className="bg-gradient-to-b from-blue-50 to-white">
        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Badge className="mb-6 px-3 py-1 bg-blue-100 text-blue-800 border-none">
              Inovação em Gestão Escolar
            </Badge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-gray-900 mb-6">
              Revolucione o processo de matrículas da sua <span className="text-primary">escola</span> com <span className="text-primary">Matricula</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto mb-8">
              Reduza em até 80% o tempo gasto com processos manuais. Valide documentos automaticamente com IA e ofereça uma experiência digital moderna para pais e alunos.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button 
                size="lg" 
                className="text-lg px-8"
                onClick={() => window.location.href = '/login'}
              >
                Começar agora
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="text-lg px-8"
                onClick={() => window.location.href = '/register'}
              >
                Cadastrar-se
              </Button>
            </div>
            <p className="mt-4 text-sm text-gray-500">
              Já utilizado por mais de 200 instituições educacionais em todo o Brasil
            </p>
          </motion.div>
        </section>

        {/* Imagem/VSL */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
          <div className="relative rounded-xl overflow-hidden shadow-2xl">
            {/* Aqui você pode colocar um player de vídeo ou uma imagem */}
            <div className="aspect-video bg-gray-100 flex items-center justify-center">
              <img 
                src="https://placehold.co/1200x675/e2e8f0/1e293b?text=V%C3%ADdeo+de+Demonstra%C3%A7%C3%A3o+EduMatrik+AI" 
                alt="Demonstração do EduMatrik AI" 
                className="w-full h-full object-cover" 
              />
            </div>
          </div>
        </section>
      </div>

      {/* Benefícios */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            className="text-center mb-16"
          >
            <motion.h2 variants={itemVariants} className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Por que escolher o Matricula?
            </motion.h2>
            <motion.p variants={itemVariants} className="text-xl text-gray-600 max-w-3xl mx-auto">
              Nossa plataforma foi desenvolvida para resolver os desafios mais comuns enfrentados por instituições educacionais.
            </motion.p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <motion.div
              variants={itemVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm"
            >
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <CheckCircle className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Validação Inteligente de Documentos</h3>
              <p className="text-gray-600">
                Reconhecimento automático de CPF, RG, comprovante de residência e documentos escolares, eliminando erros e reduzindo fraudes.
              </p>
            </motion.div>

            <motion.div
              variants={itemVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm"
            >
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Integração com WhatsApp</h3>
              <p className="text-gray-600">
                Comunique-se diretamente com pais e alunos, envie lembretes automáticos e receba documentos pelo aplicativo mais usado no Brasil.
              </p>
            </motion.div>

            <motion.div
              variants={itemVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm"
            >
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <Book className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Formulários Personalizados</h3>
              <p className="text-gray-600">
                Crie formulários adaptados às necessidades específicas da sua instituição, com campos condicionais e validações automáticas.
              </p>
            </motion.div>

            <motion.div
              variants={itemVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm"
            >
              <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center mb-4">
                <Award className="w-6 h-6 text-teal-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Métricas em Tempo Real</h3>
              <p className="text-gray-600">
                Acompanhe o desempenho do processo de matrículas com dashboards interativos, identificando gargalos e oportunidades de melhoria.
              </p>
            </motion.div>

            <motion.div
              variants={itemVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm"
            >
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Segurança e Conformidade LGPD</h3>
              <p className="text-gray-600">
                Proteja os dados dos seus alunos com criptografia de ponta a ponta e processos completamente alinhados à Lei Geral de Proteção de Dados.
              </p>
            </motion.div>

            <motion.div
              variants={itemVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm"
            >
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                <CheckCircle className="w-6 h-6 text-indigo-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Processamento de Pagamentos</h3>
              <p className="text-gray-600">
                Receba pagamentos de matrículas e mensalidades de forma integrada, com conciliação automática e relatórios financeiros detalhados.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Depoimentos */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            className="text-center mb-16"
          >
            <motion.h2 variants={itemVariants} className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              O que nossos clientes dizem
            </motion.h2>
            <motion.p variants={itemVariants} className="text-xl text-gray-600 max-w-3xl mx-auto">
              Escolas de todo o Brasil já transformaram seu processo de matrículas com o Matricula.
            </motion.p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {testimonials.map((testimonial) => (
              <motion.div
                key={testimonial.id}
                variants={itemVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
              >
                <TestimonialCard testimonial={testimonial} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Planos e Preços */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            className="text-center mb-16"
          >
            <motion.h2 variants={itemVariants} className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Escolha o plano ideal para sua instituição
            </motion.h2>
            <motion.p variants={itemVariants} className="text-xl text-gray-600 max-w-3xl mx-auto">
              Soluções flexíveis que crescem junto com sua escola
            </motion.p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {pricingPlans.map((plan) => (
              <motion.div
                key={plan.id}
                variants={itemVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className={plan.popular ? 'mt-[-1rem]' : ''}
              >
                <PricingCard plan={plan} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Garantia e provas sociais */}
      <section className="py-20 bg-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center">
            <motion.div 
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="md:w-1/2 mb-10 md:mb-0 md:pr-10"
            >
              <img 
                src="https://placehold.co/600x400/f9fafb/1e293b?text=Garantia+EduMatrik+AI" 
                alt="Selo de garantia" 
                className="max-w-full rounded-lg shadow-lg" 
              />
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="md:w-1/2"
            >
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                Garantia incondicional de 30 dias
              </h2>
              <p className="text-lg text-gray-700 mb-6">
                Estamos tão confiantes que o Matricula vai transformar sua instituição que oferecemos garantia total de reembolso nos primeiros 30 dias.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <CheckCircle className="w-6 h-6 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Sem compromisso de longo prazo</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-6 h-6 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Suporte completo durante o período de teste</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-6 h-6 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Reembolso integral sem perguntas</span>
                </li>
              </ul>
              <div className="mt-8">
                <Button size="lg">
                  Experimentar sem risco
                </Button>
              </div>
            </motion.div>
          </div>
          
          <div className="mt-20 text-center">
            <h3 className="text-2xl font-semibold text-gray-900 mb-8">
              Instituições que confiam no Matricula
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8">
              {/* Aqui você pode adicionar logos de clientes */}
              {Array(6).fill(0).map((_, i) => (
                <div key={i} className="h-12 bg-white rounded-md flex items-center justify-center p-2">
                  <div className="text-gray-400 font-semibold">Logo Cliente {i+1}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            className="text-center mb-16"
          >
            <motion.h2 variants={itemVariants} className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Perguntas Frequentes
            </motion.h2>
            <motion.p variants={itemVariants} className="text-xl text-gray-600">
              Tire suas dúvidas sobre o Matricula
            </motion.p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            className="divide-y divide-gray-200"
          >
            {faqs.map((faq, index) => (
              <motion.div
                key={index}
                variants={itemVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
              >
                <FaqItem 
                  faq={faq} 
                  isOpen={openFaq === index}
                  toggleFaq={() => toggleFaq(index)}
                />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-16 bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Transforme sua instituição com o Matricula
            </h2>
            <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto">
              Reduza custos, elimine erros e ofereça uma experiência digital de matrícula que vai impressionar pais e alunos.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button 
                size="lg" 
                className="bg-white text-blue-700 hover:bg-blue-50 text-lg px-8"
                onClick={() => window.location.href = '/login'}
              >
                Começar agora
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="border-white text-white hover:bg-blue-600 text-lg px-8"
                onClick={() => window.location.href = '/register'}
              >
                Cadastrar-se
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Rodapé */}
      <footer className="bg-gray-900 text-gray-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-white text-lg font-semibold mb-4">Matricula</h3>
              <p className="text-sm text-gray-400">
                Transformando a experiência de matrículas escolares em todo o Brasil com tecnologia avançada e inteligência artificial.
              </p>
            </div>
            <div>
              <h3 className="text-white text-lg font-semibold mb-4">Recursos</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">Documentação</a></li>
                <li><a href="#" className="hover:text-white">Blog</a></li>
                <li><a href="#" className="hover:text-white">Centro de Ajuda</a></li>
                <li><a href="#" className="hover:text-white">Webinars</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white text-lg font-semibold mb-4">Empresa</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">Sobre nós</a></li>
                <li><a href="#" className="hover:text-white">Carreiras</a></li>
                <li><a href="#" className="hover:text-white">Contato</a></li>
                <li><a href="#" className="hover:text-white">Parceiros</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white text-lg font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">Política de Privacidade</a></li>
                <li><a href="#" className="hover:text-white">Termos de Uso</a></li>
                <li><a href="#" className="hover:text-white">Conformidade LGPD</a></li>
                <li><a href="#" className="hover:text-white">Segurança</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-12 pt-6 flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-gray-500">
              &copy; {new Date().getFullYear()} Matricula. Todos os direitos reservados.
            </p>
            <div className="flex space-x-4 mt-4 md:mt-0">
              <a href="#" className="text-gray-400 hover:text-white">
                <span className="sr-only">Facebook</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
                </svg>
              </a>
              <a href="#" className="text-gray-400 hover:text-white">
                <span className="sr-only">Instagram</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" />
                </svg>
              </a>
              <a href="#" className="text-gray-400 hover:text-white">
                <span className="sr-only">Twitter</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                </svg>
              </a>
              <a href="#" className="text-gray-400 hover:text-white">
                <span className="sr-only">LinkedIn</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" clipRule="evenodd" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}