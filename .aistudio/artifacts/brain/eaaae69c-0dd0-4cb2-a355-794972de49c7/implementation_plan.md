# Plano de Implementação: Unificação da Agenda Médica (Consultas e Exames)

## 1. Visão Geral e Alinhamento com o Usuário

Esta refatoração visa eliminar a fragmentação cognitiva para pacientes idosos e seus familiares cuidadores, consolidando **Consultas** e **Exames** em uma jornada única e integrada:

- **Nomenclatura Oficial:** A aba no menu principal e cabeçalho passa a se chamar **"Consultas e Exames"** (id interno: `'agenda'`).
- **Linha do Tempo e Dashboard:** Unificação de eventos de consultas e exames em uma fila cronológica única (`ItemAgenda[]`).
- **Tratamento de Alertas e Pendências (Amarelo):** Itens sem data definida (ex: exames solicitados aguardando agendamento/liberação ou consultas pendentes) flutuam com prioridade ao topo com estilização acolhedora em tons âmbar/amarelo (`bg-amber-50 border-amber-200 text-amber-950`), incentivando a ação sem o estresse de alertas vermelhos de erro.
- **Acordeon Anti-Poluição Visual:** Caso existam mais de 2 pendências sem data, elas são condensadas em um banner sanfona expansível (*"Você possui X agendamentos aguardando data ou liberação"*), preservando o foco nos compromissos confirmados da semana.
- **Acessibilidade na Criação:** Eliminação de menus suspensos (*dropdowns*). No topo da nova tela, dois botões de toque grande ($\ge 44\text{px}$) permitem ação imediata: **[ + Nova Consulta ]** e **[ + Novo Exame ]**.
- **Filtros Rápidos:** Segmented control funcional com opções: *Todos*, *Apenas Consultas* e *Apenas Exames*.

---

## 2. Contratos de Dados (TypeScript)

### 2.1 Interface Unificada `ItemAgenda` (`src/types/index.ts` e `server/types/index.ts`)

```typescript
export type TipoItemAgenda = 'consulta' | 'exame';

export type StatusAgenda = 
  | 'agendado'               // Confirmado com data e hora
  | 'pendente_agendamento'   // Exame solicitado ou retorno médico sem data
  | 'realizado'              // Consulta concluída ou exame coletado/realizado
  | 'cancelado';             // Cancelado

export interface ItemAgenda {
  id: string;
  patientId: string;
  tipo: TipoItemAgenda;
  titulo: string;                   // Ex: "Dermatologia" ou "Ultrassonografia Doppler"
  subtitulo: string;                // Ex: "Dra. Julaine Cristina" ou "Dr. Marcos (Solicitante)"
  categoriaOuEspecialidade: string; // Ex: "Dermatologia", "Radiologia", "Cardiologia"
  local?: string;                   // Ex: "CRI Norte - Complexo Mandaqui"
  
  // Temporalidade
  dataHora?: string;                // ISO string ("2026-10-06T13:50"). Ausente/nulo em pendências.
  dataExibicao?: string;            // Formatada: "06 de out. de 2026"
  horarioExibicao?: string;         // Formatada: "13:50"
  possuiDataDefinida: boolean;      // true se dataHora for válido
  
  // Status e Indicadores Visuais
  status: StatusAgenda;
  statusRotulo: string;             // Ex: "Agendada", "Aguardando Agendamento / Guia"
  ehAlertaPendente: boolean;        // true -> Card amarelo flutuante
  motivoAlerta?: string;            // Ex: "Aguardando liberação de vaga/guia SUS ou convênio"
  
  // Orientações e Preparo
  motivo?: string;                  // Motivo conciso da consulta/exame
  instrucoesPreparo?: string;       // Jejum, bexiga cheia, medicamentos a suspender
  observacoes?: string;             // Documentos necessários, chegada antecipada
  
  // Vínculos clínicos
  documentoId?: string;             // Documento/laudo associado
  nomeDocumento?: string;
  referenciaOrigemId: string;       // ID original da Appointment ou Exam
}

export interface AgendaUnificadaResponse {
  totalItens: number;
  totalPendenciasSemData: number;
  itensConfirmados: ItemAgenda[];
  itensPendentes: ItemAgenda[];
  linhaDoTempoGeral: ItemAgenda[]; // Pendências no topo + confirmados cronológicos
}
```

---

## 3. Lógica de Backend (Node.js & Express)

### 3.1 Service de Agregação Unificada (`server/services/agendaService.ts`)

A lógica utiliza `Promise.all` para consultar as coleções em paralelo, normalizando registros em `ItemAgenda` e aplicando a regra de ordenação por prioridade:

```typescript
import { IFamilyRepository } from '../repositories/IFamilyRepository';
import { Appointment, Exam, ItemAgenda, AgendaUnificadaResponse } from '../types';

export class AgendaService {
  constructor(private repository: IFamilyRepository) {}

  async getAgendaUnificada(patientId: string, familyId: string): Promise<AgendaUnificadaResponse> {
    // 1. Consulta paralela de alta performance
    const [appointments, exams, documents] = await Promise.all([
      this.repository.getAppointments(patientId, familyId),
      this.repository.getExams(patientId, familyId),
      this.repository.getDocuments(patientId, familyId),
    ]);

    const docsMap = new Map(documents.map((d) => [d.id, d.fileName || d.title]));

    // 2. Normalização de Consultas
    const itensConsultas: ItemAgenda[] = appointments.map((apt) => {
      const temData = Boolean(apt.dateTime && !isNaN(new Date(apt.dateTime).getTime()));
      
      return {
        id: `consulta-${apt.id}`,
        referenciaOrigemId: apt.id,
        patientId,
        tipo: 'consulta',
        titulo: apt.specialty || 'Consulta Médica',
        subtitulo: apt.professional || 'Profissional não informado',
        categoriaOuEspecialidade: apt.specialty || 'Clínica Geral',
        local: apt.location,
        dataHora: temData ? apt.dateTime : undefined,
        possuiDataDefinida: temData,
        status: apt.status === 'agendada' ? 'agendado' : apt.status === 'realizada' ? 'realizado' : 'cancelado',
        statusRotulo: apt.status === 'agendada' ? 'Consulta Agendada' : apt.status === 'realizada' ? 'Realizada' : 'Cancelada',
        ehAlertaPendente: !temData,
        motivoAlerta: !temData ? 'Retorno ou consulta sem data confirmada' : undefined,
        motivo: apt.reason,
        observacoes: apt.notes,
      };
    });

    // 3. Normalização de Exames
    const itensExames: ItemAgenda[] = exams.map((exam) => {
      const dataHoraExame = exam.executionDate || undefined;
      const temData = Boolean(dataHoraExame && !isNaN(new Date(dataHoraExame).getTime()));
      const ehPendente = exam.status === 'solicitado' || !temData;

      return {
        id: `exame-${exam.id}`,
        referenciaOrigemId: exam.id,
        patientId,
        tipo: 'exame',
        titulo: exam.name,
        subtitulo: `Solicitante: ${exam.requestingDoctor || 'Médico Assistente'}`,
        categoriaOuEspecialidade: 'Exame Diagnóstico',
        dataHora: temData ? dataHoraExame : undefined,
        possuiDataDefinida: temData,
        status: exam.status === 'solicitado' 
          ? 'pendente_agendamento' 
          : exam.status === 'agendado' 
          ? 'agendado' 
          : 'realizado',
        statusRotulo: exam.status === 'solicitado' 
          ? 'Aguardando Liberação / Agendamento' 
          : exam.status === 'agendado' 
          ? 'Exame Agendado' 
          : 'Resultado Disponível',
        ehAlertaPendente: ehPendente,
        motivoAlerta: ehPendente ? 'Aguardando marcação de data pelo SUS/Convênio ou laboratório' : undefined,
        observacoes: exam.notes,
        documentoId: exam.documentId,
        nomeDocumento: exam.documentId ? docsMap.get(exam.documentId) : undefined,
      };
    });

    // 4. Separação de Pendências (sem data) e Confirmados (com data)
    const todos = [...itensConsultas, ...itensExames];
    const itensPendentes = todos.filter((item) => item.ehAlertaPendente);
    
    // 5. Ordenação cronológica dos itens com data
    const itensConfirmados = todos
      .filter((item) => !item.ehAlertaPendente && item.dataHora)
      .sort((a, b) => (a.dataHora!).localeCompare(b.dataHora!));

    return {
      totalItens: todos.length,
      totalPendenciasSemData: itensPendentes.length,
      itensPendentes,
      itensConfirmados,
      linhaDoTempoGeral: [...itensPendentes, ...itensConfirmados],
    };
  }
}
```

### 3.2 Endpoint no Router (`server/routes/api.ts`)

```typescript
router.get(
  '/patients/:patientId/agenda',
  requireAuth,
  requireActiveMembership,
  async (req: AuthorizedFamilyRequest, res: Response) => {
    try {
      const { patientId } = req.params;
      const familyId = req.membership!.familyId;
      const agendaService = new AgendaService(repository);
      const agenda = await agendaService.getAgendaUnificada(patientId, familyId);
      res.json(agenda);
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao carregar agenda unificada' });
    }
  }
);
```

---

## 4. Componentização Frontend (React + Tailwind CSS)

### 4.1 Card Unificado com Renderização Condicional de Alerta Amarelo (`src/components/AgendaCard.tsx`)

O componente aplica regras visuais sem "AI slop", contraste WCAG AA e estilização em âmbar acolhedor:

```tsx
import React from 'react';
import { ItemAgenda } from '../types';
import { Calendar, Clock, MapPin, User, AlertCircle, FileCheck, Share2 } from 'lucide-react';

interface AgendaCardProps {
  item: ItemAgenda;
  onEdit: (item: ItemAgenda) => void;
  onShare: (item: ItemAgenda) => void;
  onActionPrimary?: (item: ItemAgenda) => void;
}

export const AgendaCard: React.FC<AgendaCardProps> = ({ item, onEdit, onShare, onActionPrimary }) => {
  const isPendente = item.ehAlertaPendente;

  return (
    <article
      id={`agenda-card-${item.id}`}
      className={`rounded-2xl border transition-all p-4 sm:p-5 relative ${
        isPendente
          ? 'bg-amber-50/80 border-amber-300/80 text-amber-950 shadow-xs'
          : 'bg-white border-slate-200/90 hover:border-slate-300 text-slate-900 shadow-xs'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        {/* Cabeçalho do Card */}
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`font-bold uppercase tracking-wider text-[11px] ${
                item.tipo === 'consulta' ? 'text-blue-700' : 'text-emerald-700'
              }`}
            >
              {item.tipo === 'consulta' ? 'Consulta Médica' : 'Exame Diagnóstico'}
            </span>
            <span className="text-slate-300">·</span>
            <span
              className={`font-semibold ${
                isPendente ? 'text-amber-800' : 'text-slate-600'
              }`}
            >
              {item.statusRotulo}
            </span>
          </div>

          <h3 className="text-base sm:text-lg font-bold truncate">
            {item.titulo}
          </h3>

          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{item.subtitulo}</span>
          </div>
        </div>

        {/* Data e Horário em Destaque */}
        <div className="sm:text-right shrink-0">
          {item.possuiDataDefinida && item.dataHora ? (
            <div className="inline-flex sm:flex-col items-center sm:items-end gap-1.5 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>{item.dataExibicao || item.dataHora.split('T')[0]}</span>
              </div>
              {item.dataHora.includes('T') && (
                <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 font-mono">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>{item.horarioExibicao || item.dataHora.split('T')[1].slice(0, 5)}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-900 border border-amber-300 px-3 py-1.5 rounded-xl text-xs font-bold">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Data a Definir</span>
            </div>
          )}
        </div>
      </div>

      {/* Alerta de Guia ou Vaga */}
      {isPendente && item.motivoAlerta && (
        <div className="mt-3 p-2.5 bg-amber-100/70 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed font-medium">
            <strong>Ação Necessária:</strong> {item.motivoAlerta}
          </p>
        </div>
      )}

      {/* Localização e Preparo */}
      <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4 text-slate-600">
          {item.local && (
            <div className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate max-w-[200px]">{item.local}</span>
            </div>
          )}
          {item.nomeDocumento && (
            <div className="flex items-center gap-1 text-blue-700 font-medium">
              <FileCheck className="w-3.5 h-3.5" />
              <span className="truncate max-w-[150px]">{item.nomeDocumento}</span>
            </div>
          )}
        </div>

        {/* Botão de Avisar Família */}
        <button
          onClick={() => onShare(item)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors min-h-[36px]"
        >
          <Share2 className="w-3.5 h-3.5 text-slate-500" />
          <span>Avisar Família</span>
        </button>
      </div>
    </article>
  );
};
```

### 4.2 Tela Unificada `AgendaUnifiedView.tsx` com Banners e Botões Superiores

```tsx
import React, { useState } from 'react';
import { ItemAgenda } from '../types';
import { AgendaCard } from './AgendaCard';
import { CalendarCheck2, Activity, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

interface AgendaUnifiedViewProps {
  itens: ItemAgenda[];
  onOpenNovaConsulta: () => void;
  onOpenNovoExame: () => void;
  onEditItem: (item: ItemAgenda) => void;
  onShareItem: (item: ItemAgenda) => void;
}

export const AgendaUnifiedView: React.FC<AgendaUnifiedViewProps> = ({
  itens,
  onOpenNovaConsulta,
  onOpenNovoExame,
  onEditItem,
  onShareItem,
}) => {
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'consultas' | 'exames'>('todos');
  const [isAccordionOpen, setIsAccordionOpen] = useState(false);

  // Separação de pendências sem data e confirmados
  const pendencias = itens.filter((i) => i.ehAlertaPendente);
  const confirmados = itens.filter((i) => !i.ehAlertaPendente);

  // Aplicação do filtro de tipo
  const filtrarLista = (lista: ItemAgenda[]) => {
    if (filtroTipo === 'consultas') return lista.filter((i) => i.tipo === 'consulta');
    if (filtroTipo === 'exames') return lista.filter((i) => i.tipo === 'exame');
    return lista;
  };

  const confirmadosFiltrados = filtrarLista(confirmados);
  const pendenciasFiltradas = filtrarLista(pendencias);

  const temMuitasPendencias = pendenciasFiltradas.length > 2;

  return (
    <div className="space-y-6 pb-16 max-w-5xl mx-auto">
      {/* 1. TOPO ACESSÍVEL: Dois Botões de Ação Direta (Sem dropdowns, >= 44px) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Consultas e Exames
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Agenda médica centralizada e prazos de acompanhamento
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center">
          <button
            id="btn-agenda-nova-consulta"
            onClick={onOpenNovaConsulta}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-xl font-bold text-sm shadow-xs transition-all min-h-[44px]"
          >
            <CalendarCheck2 className="w-4 h-4 shrink-0" />
            <span>+ Nova Consulta</span>
          </button>

          <button
            id="btn-agenda-novo-exame"
            onClick={onOpenNovoExame}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl font-bold text-sm shadow-xs transition-all min-h-[44px]"
          >
            <Activity className="w-4 h-4 shrink-0" />
            <span>+ Novo Exame</span>
          </button>
        </div>
      </div>

      {/* 2. BANNER CONDENSADO ACORDEON (Regra: Mais de 2 pendências sem data) */}
      {temMuitasPendencias && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 overflow-hidden shadow-xs">
          <button
            onClick={() => setIsAccordionOpen(!isAccordionOpen)}
            className="w-full px-5 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-amber-100/60 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-200/80 flex items-center justify-center text-amber-800 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-amber-950">
                  Você possui {pendenciasFiltradas.length} agendamentos aguardando liberação ou data
                </h4>
                <p className="text-xs text-amber-800">
                  Clique para {isAccordionOpen ? 'recolher' : 'visualizar as pendências'} e manter o foco na semana
                </p>
              </div>
            </div>
            {isAccordionOpen ? (
              <ChevronUp className="w-5 h-5 text-amber-800 shrink-0" />
            ) : (
              <ChevronDown className="w-5 h-5 text-amber-800 shrink-0" />
            )}
          </button>

          {isAccordionOpen && (
            <div className="p-4 pt-1 space-y-3 border-t border-amber-200 bg-amber-50/50">
              {pendenciasFiltradas.map((item) => (
                <AgendaCard
                  key={item.id}
                  item={item}
                  onEdit={onEditItem}
                  onShare={onShareItem}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Se houver até 2 pendências, exibi-las no topo diretamente */}
      {!temMuitasPendencias && pendenciasFiltradas.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-900 uppercase tracking-wider">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span>Pendências e Solicitações ({pendenciasFiltradas.length})</span>
          </div>
          <div className="space-y-3">
            {pendenciasFiltradas.map((item) => (
              <AgendaCard
                key={item.id}
                item={item}
                onEdit={onEditItem}
                onShare={onShareItem}
              />
            ))}
          </div>
        </section>
      )}

      {/* 3. FILTROS RÁPIDOS (Segmented Control sem pills estáticas) */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
          Compromissos Confirmados
        </h2>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setFiltroTipo('todos')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              filtroTipo === 'todos' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Todos ({confirmados.length})
          </button>
          <button
            onClick={() => setFiltroTipo('consultas')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              filtroTipo === 'consultas' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Consultas
          </button>
          <button
            onClick={() => setFiltroTipo('exames')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              filtroTipo === 'exames' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Exames
          </button>
        </div>
      </div>

      {/* 4. LISTA CRONOLÓGICA CONFIRMADA */}
      {confirmadosFiltrados.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500">
          Nenhum compromisso confirmado para o filtro selecionado.
        </div>
      ) : (
        <div className="space-y-3">
          {confirmadosFiltrados.map((item) => (
            <AgendaCard
              key={item.id}
              item={item}
              onEdit={onEditItem}
              onShare={onShareItem}
            />
          ))}
        </div>
      )}
    </div>
  );
};
```

---

## 5. Plano de Roteamento e Transição de Navegação

### 5.1 Atualização de `NavigationTab` em `PatientContext.tsx`

Alteração do tipo `NavigationTab`:

```typescript
// Antes:
export type NavigationTab =
  | 'dashboard'
  | 'medicamentos'
  | 'consultas'
  | 'exames'
  | 'documentos'
  | 'linha_tempo'
  | 'historico';

// Depois (com backward compatibility):
export type NavigationTab =
  | 'dashboard'
  | 'medicamentos'
  | 'agenda'         // Nova aba unificada ("Consultas e Exames")
  | 'documentos'
  | 'linha_tempo'
  | 'historico'
  | 'consultas'      // Mantido como alias/redirect para 'agenda'
  | 'exames';        // Mantido como alias/redirect para 'agenda'
```

### 5.2 Roteiro de Migração Passo a Passo

1. **Ajuste no `TabNavigation.tsx`**:
   - No array `DESKTOP_TABS` e `MOBILE_PRIMARY_TABS`, remover as entradas separadas `{ id: 'consultas' }` e `{ id: 'exames' }`.
   - Adicionar o item unificado:
     ```typescript
     { 
       id: 'agenda', 
       label: 'Consultas e Exames', 
       shortLabel: 'Agenda', 
       icon: CalendarCheck2 
     }
     ```
2. **Tratamento de Redirecionamento e Aliases em `PatientContext.tsx`**:
   - Caso qualquer componente ou link interno chame `setActiveTab('consultas')` ou `setActiveTab('exames')`, um *setter interceptor* redireciona automaticamente para `'agenda'`.
3. **Substituição da Visão em `App.tsx`**:
   - No container condicional de visualização, substituir as montagens separadas de `<AppointmentsView />` e `<ExamsView />` por:
     ```tsx
     {activeTab === 'agenda' && (
       <AgendaUnifiedView
         itens={agendaItens}
         onOpenNovaConsulta={() => setIsAptModalOpen(true)}
         onOpenNovoExame={() => setIsExamModalOpen(true)}
         onEditItem={handleEditAgendaItem}
         onShareItem={handleShareAgendaItem}
       />
     )}
     ```
   - Os modais existentes de criação/edição (`AppointmentsView` modal e `ExamsView` modal) permanecem disponíveis globalmente ou acionados diretamente pelos botões superiores.
4. **Integração na Tela Inicial (`DashboardView.tsx`)**:
   - O widget de "Próximos Compromissos" passa a consumir `AgendaService` ou a lista `ItemAgenda`, renderizando os alertas amarelos no topo e os compromissos cronológicos subsequentes.

---

## 6. Verificação e Garantia de Qualidade

1. **Teste de Agregação:** Validar se consultas e exames são normalizados sem perda de metadados (médico, local, preparo, laudos vinculados).
2. **Teste Visual de Alertas Amarelos:** Inserir exames com status `solicitado` (sem data) e certificar que renderizam em âmbar (`bg-amber-50 border-amber-300`).
3. **Teste de Regra de Negócio (>2 pendências):** Adicionar 3 pendências e confirmar que o acordeon condensado aparece com contagem correta e se expande ao clique.
4. **Alvos de Toque e Acessibilidade:** Checar se os botões superiores `[ + Nova Consulta ]` e `[ + Novo Exame ]` atendem o tamanho mínimo de $44\text{px}$ para fácil uso por idosos e cuidadores em dispositivos móveis.
5. **Checagem de Compilação:** Executar `compile_applet` e `lint_applet` para assegurar que não haja quebras de tipos no TypeScript.
