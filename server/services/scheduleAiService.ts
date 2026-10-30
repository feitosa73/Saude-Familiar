import { GoogleGenAI, Type } from '@google/genai';
import { ExtractedScheduleResponse, ExtractedScheduleItem } from '../types';

const SYSTEM_INSTRUCTION = `Você é um assistente de gestão em saúde e triagem documental brasileira de alta precisão clínica e administrativa.
Sua missão é analisar cuidadosamente a imagem ou PDF contendo comprovantes de agendamento, guias de solicitação médica, pedidos de exames do SUS/convênio ou prints de confirmações do WhatsApp/SMS, distinguindo com rigor a natureza documental de cada item.

DIRETRIZES FUNDAMENTAIS DE CLASSIFICAÇÃO E INTEGRIDADE:

1. DISTINÇÃO RIGOROSA DA NATUREZA DOCUMENTAL:
   A. PEDIDO OU GUIA DE SOLICITAÇÃO DE EXAME (pedido_guia_exame):
      - Documentos que contenham pedido médico, guia de encaminhamento do SUS (ex: Secretaria Municipal da Saúde, UBS, AME), requisição de convênio ou receituário solicitando exames (urina, sangue, imagem, fezes, biópsia, etc.) SEM comprovação de agendamento (sem data/horário marcado para comparecimento).
      - Classificação: type = "solicitacao_exame", status = "solicitado".
      - Data da Solicitação (requestDate): Preencha com a data de emissão ou data da assinatura/carimbo do médico na guia (formato ISO "YYYY-MM-DD").
      - Data do Agendamento (scheduledDate) e dateTime: NUNCA PREENCHA NEM INVENTE! Devem permanecer vazios.
      - REGRA DE OURO: NUNCA interprete a data de emissão da guia como data de agendamento. NUNCA invente horários (ex: 08:00) para solicitações de exames.
      - professional: Nome da médica ou médico solicitante que assina a guia.
      - Registre em confidenceWarning: "Guia de solicitação médica identificada sem comprovação de agendamento."

   B. COMPROVANTE EXPLÍCITO DE AGENDAMENTO (comprovante_agendamento):
      - Documentos ou prints que comprovam marcação efetiva com data e/ou horário agendados para realização de exame.
      - Classificação: type = "exame_agendado", status = "agendado".
      - scheduledDate: Data agendada ("YYYY-MM-DD").
      - dateTime: Data e horário se presente ("YYYY-MM-DDTHH:mm").

   C. CONSULTA MÉDICA OU RETORNO (consulta_retorno):
      - Comprovantes ou convites para consulta médica ambulatorial, retorno, teleconsulta ou avaliação com especialista.
      - Classificação: type = "consulta".
      - dateTime: Data e horário do atendimento ("YYYY-MM-DDTHH:mm").

   D. COMPROVANTE DE COLETA OU REALIZAÇÃO (comprovante_coleta_realizacao):
      - Comprovante de laboratório atestando que o paciente já colheu ou realizou o exame.
      - Classificação: type = "exame", status = "realizado".
      - executionDate: Data da realização ("YYYY-MM-DD").

   E. DOCUMENTO AMBÍGUO (ambiguo):
      - Se houver dúvida ou o documento não permitir determinar com confiança se o exame já está agendado, trate por segurança como type = "solicitacao_exame" com status = "solicitado", não crie agendamento fictício e alerte em confidenceWarning para conferência humana.

2. CONCISÃO E ESTILO:
   - Os campos reason, preparationInstructions e notes devem ter no máximo 10 a 15 palavras.
   - NUNCA transcreva texto burocrático completo nem repita informações.

3. O retorno DEVE ser estritamente em formato JSON em conformidade com o schema definido.`;

export class ScheduleAiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  async extractFromBuffer(buffer: Buffer, mimeType: string): Promise<ExtractedScheduleResponse> {
    const base64Data = buffer.toString('base64');

    const response = await this.ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          inlineData: {
            mimeType: mimeType || 'image/jpeg',
            data: base64Data,
          },
        },
        {
          text: 'Analise este documento com precisão médica e identifique a natureza documental. Distinga pedidos/guias de solicitação de exame (sem agendamento) de comprovantes de agendamento confirmado e consultas. Para solicitações de exame, NÃO invente data ou horário de agendamento; extraia a data da solicitação no campo requestDate e mantenha scheduledDate e dateTime vazios.',
        },
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.1,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            patientNameIdentified: { type: Type.STRING },
            confidenceWarning: { type: Type.STRING },
            generalNotes: { type: Type.STRING },
            documentNature: {
              type: Type.STRING,
              enum: [
                'pedido_guia_exame',
                'comprovante_agendamento',
                'consulta_retorno',
                'comprovante_coleta_realizacao',
                'ambiguo',
              ],
            },
            schedules: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: {
                    type: Type.STRING,
                    enum: ['solicitacao_exame', 'exame_agendado', 'consulta', 'exame'],
                  },
                  status: {
                    type: Type.STRING,
                    enum: ['solicitado', 'agendado', 'realizado'],
                  },
                  title: { type: Type.STRING },
                  specialtyOrCategory: { type: Type.STRING },
                  professional: { type: Type.STRING },
                  location: { type: Type.STRING },
                  requestDate: { type: Type.STRING },
                  scheduledDate: { type: Type.STRING },
                  executionDate: { type: Type.STRING },
                  dateTime: { type: Type.STRING },
                  reason: { type: Type.STRING },
                  notes: { type: Type.STRING },
                  preparationInstructions: { type: Type.STRING },
                },
                required: ['type', 'title', 'specialtyOrCategory'],
              },
            },
          },
          required: ['schedules'],
        },
      },
    });

    const text = response.text?.trim() || '{}';
    try {
      const parsed = JSON.parse(text) as ExtractedScheduleResponse;
      if (!Array.isArray(parsed.schedules)) {
        parsed.schedules = [];
      }

      const trimWords = (val?: string, maxWords = 16): string | undefined => {
        if (!val) return undefined;
        const words = val.trim().split(/\s+/);
        if (words.length > maxWords) {
          return words.slice(0, maxWords).join(' ');
        }
        return val.trim();
      };

      const today = new Date().toISOString().split('T')[0];

      parsed.schedules = parsed.schedules.map((s: ExtractedScheduleItem) => {
        const itemType = s.type;
        const isSolicitacao =
          itemType === 'solicitacao_exame' ||
          s.status === 'solicitado' ||
          parsed.documentNature === 'pedido_guia_exame';

        if (isSolicitacao) {
          // Garante que solicitações de exames não possuam agendamento fictício
          let reqDate = s.requestDate ? s.requestDate.trim() : '';
          if (!reqDate && s.dateTime && s.dateTime.length >= 10) {
            reqDate = s.dateTime.split('T')[0];
          }
          if (!reqDate) {
            reqDate = today;
          }

          return {
            ...s,
            type: 'solicitacao_exame',
            status: 'solicitado',
            requestDate: reqDate,
            scheduledDate: undefined,
            executionDate: undefined,
            dateTime: undefined,
            reason: trimWords(s.reason),
            preparationInstructions: trimWords(s.preparationInstructions),
            notes: trimWords(s.notes),
            documentNature: 'pedido_guia_exame',
          };
        }

        // Caso seja consulta ou exame agendado
        let dt = s.dateTime ? s.dateTime.trim() : '';
        if (dt.includes(' ')) {
          dt = dt.replace(' ', 'T');
        }
        if (dt.length > 16 && dt.includes('T')) {
          dt = dt.slice(0, 16);
        }

        const isExameAgendado = itemType === 'exame_agendado' || (itemType === 'exame' && s.status === 'agendado');
        const isExameRealizado = s.status === 'realizado';

        return {
          ...s,
          type: itemType === 'consulta' ? 'consulta' : isExameAgendado ? 'exame_agendado' : itemType,
          status: isExameRealizado ? 'realizado' : isExameAgendado ? 'agendado' : s.status,
          dateTime: dt || undefined,
          scheduledDate: s.scheduledDate || (dt ? dt.split('T')[0] : undefined),
          executionDate: s.executionDate || undefined,
          requestDate: s.requestDate || (isSolicitacao ? today : undefined),
          reason: trimWords(s.reason),
          preparationInstructions: trimWords(s.preparationInstructions),
          notes: trimWords(s.notes),
        };
      });

      return parsed;
    } catch (err: any) {
      console.error('[ScheduleAiService] Falha ao fazer parse do retorno JSON do Gemini:', err, text);
      throw new Error('Não foi possível interpretar as informações do agendamento via IA. Tente novamente.');
    }
  }
}

export const scheduleAiService = new ScheduleAiService();
