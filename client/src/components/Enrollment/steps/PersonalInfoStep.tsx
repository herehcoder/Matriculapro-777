import React, { useState } from 'react';
import { 
  Form, 
  FormControl, 
  FormDescription, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface PersonalInfoStepProps {
  formData: any;
  updateFormData: (data: any) => void;
  courses: any[];
  questions: any[];
}

const PersonalInfoStep: React.FC<PersonalInfoStepProps> = ({ 
  formData, 
  updateFormData, 
  courses,
  questions
}) => {
  const [selectedGender, setSelectedGender] = useState<string>(formData.gender || '');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    formData.birthDate ? new Date(formData.birthDate) : undefined
  );

  const formSchema = z.object({
    fullName: z.string()
      .min(3, { message: 'Nome completo deve ter no mínimo 3 caracteres' })
      .max(100, { message: 'Nome completo deve ter no máximo 100 caracteres' }),
    email: z.string()
      .email({ message: 'E-mail inválido' }),
    phone: z.string()
      .min(10, { message: 'Telefone deve ter no mínimo 10 dígitos' })
      .max(15, { message: 'Telefone deve ter no máximo 15 dígitos' }),
    birthDate: z.string()
      .min(1, { message: 'Data de nascimento é obrigatória' }),
    gender: z.string()
      .min(1, { message: 'Gênero é obrigatório' }),
    address: z.string()
      .min(5, { message: 'Endereço deve ter no mínimo 5 caracteres' }),
    city: z.string()
      .min(2, { message: 'Cidade deve ter no mínimo 2 caracteres' }),
    state: z.string()
      .min(2, { message: 'Estado deve ter no mínimo 2 caracteres' }),
    zipCode: z.string()
      .min(5, { message: 'CEP deve ter no mínimo 5 caracteres' }),
    courseId: z.any(),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: formData.fullName || '',
      email: formData.email || '',
      phone: formData.phone || '',
      birthDate: formData.birthDate || '',
      gender: formData.gender || '',
      address: formData.address || '',
      city: formData.city || '',
      state: formData.state || '',
      zipCode: formData.zipCode || '',
      courseId: formData.courseId || null,
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    updateFormData(data);
    toast({
      title: 'Dados pessoais salvos',
      description: 'Seus dados pessoais foram salvos com sucesso!',
    });
  };

  const handleDateChange = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date) {
      form.setValue('birthDate', date.toISOString().split('T')[0], { shouldValidate: true });
    }
  };

  const handleGenderChange = (value: string) => {
    setSelectedGender(value);
    form.setValue('gender', value, { shouldValidate: true });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="space-y-8">
          <div>
            <h3 className="text-lg font-medium">Informações Pessoais</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              Preencha seus dados pessoais para dar início ao processo de matrícula.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo</FormLabel>
                  <FormControl>
                    <Input placeholder="João da Silva" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <Input placeholder="joao@exemplo.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone</FormLabel>
                  <FormControl>
                    <Input placeholder="(11) 99999-9999" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="birthDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Data de Nascimento</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full text-left font-normal flex justify-between",
                            !field.value && "text-neutral-500"
                          )}
                        >
                          {field.value ? (
                            format(new Date(field.value), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                          ) : (
                            <span>Selecione uma data</span>
                          )}
                          <CalendarIcon className="h-4 w-4 opacity-70" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={handleDateChange}
                        disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="gender"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Gênero</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={handleGenderChange}
                      defaultValue={field.value}
                      className="flex space-x-4"
                      value={selectedGender}
                    >
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="male" />
                        </FormControl>
                        <FormLabel className="font-normal">Masculino</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="female" />
                        </FormControl>
                        <FormLabel className="font-normal">Feminino</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="other" />
                        </FormControl>
                        <FormLabel className="font-normal">Outro</FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="courseId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Curso de Interesse</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value?.toString()}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um curso" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {courses && courses.length > 0 ? (
                        courses.map((option, index) => (
                          <SelectItem key={option.id} value={option.id.toString()}>
                            {option.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>
                          Nenhum curso disponível
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Selecione o curso para o qual deseja se matricular.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div>
            <h3 className="text-lg font-medium">Endereço</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              Informe seu endereço completo para fins de registro.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem className="col-span-full">
                  <FormLabel>Endereço Completo</FormLabel>
                  <FormControl>
                    <Input placeholder="Rua, número, complemento" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cidade</FormLabel>
                  <FormControl>
                    <Input placeholder="São Paulo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="state"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado</FormLabel>
                  <FormControl>
                    <Input placeholder="SP" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="zipCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CEP</FormLabel>
                  <FormControl>
                    <Input placeholder="01310-000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {questions && questions.length > 0 && (
            <>
              <div>
                <h3 className="text-lg font-medium">Perguntas Adicionais</h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                  Por favor, responda às perguntas abaixo.
                </p>
              </div>

              <Card className="border-dashed">
                <CardContent className="p-6 space-y-4">
                  {questions.map((question, index) => (
                    <div key={question.id || index} className="space-y-2">
                      <h4 className="font-medium">{question.text}</h4>
                      {question.type === 'text' && (
                        <Input placeholder="Sua resposta" />
                      )}
                      {question.type === 'select' && (
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma opção" />
                          </SelectTrigger>
                          <SelectContent>
                            {question.options && question.options.map((option: any, index: any) => (
                              <SelectItem key={index} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          )}

          <div className="flex justify-end">
            <Button type="submit">Salvar Dados Pessoais</Button>
          </div>
        </div>
      </form>
    </Form>
  );
};

export default PersonalInfoStep;