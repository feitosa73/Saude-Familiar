import { GoogleGenAI, Type } from '@google/genai';
import { ExtractedScheduleResponse } from '../types';

const SYSTEM_INSTRUCTION = `Você é um assistente de gestão em saúde e triagem de agendamentos médicos brasileiro de alta precisão.
Sua missão é analisar cuidadosamente a imagem ou PDF contendo comprovantes de agendamento, guias de marcação de consultas/exames, pedidos médicos ou prints de confirmações do WhatsApp/SMS, e estruturar cada compromisso para a agenda do paciente.

DIRETRIZES FUNDAMENTAIS:
1. ZERO ALUCINAÇÃO: Extraia estritamente os agendamentos e instruções confirmados no documento. Jamais invente datas, horários ou locais.
2. CLASSIFICAÇÃO DA NATUREZA DO EVENTO (type):
   - "consulta": Para consultas médicas, retornos ambulatoriais, teleconsultas, avaliações com nutricionistas, psicólogos, fisioterapeutas, etc.
   - "exame": Para exames laboratoriais (coletas de sangue/urina), diagnósticos por imagem (raio-x, tomografia, ressonância, ecografia), endoscopias, procedimentos diagnósticos, etc.
3. DADOS DE CADA AGENDAMENTO (schedules):
   - title: Título descritivo e claro (ex: "Consulta Cardiológica - Dr. Marcos", "Ressonância Magnética de Joelho", "Exame de Sangue - Jejum").
   - specialtyOrCategory: Especialidade médica ou modalidade do exame (ex: "Cardiologia", "Ortopedia", "Radiologia", "Laboratório Clínico").
   - professional: Nome do profissional de saúde ou do estabelecimento médico/laboratorial.
   - location: Local do atendimento (endereço, clínica, hospital, andar/sala ou indicação de Telemedicina).
   - dateTime: Data e horário do compromisso. Padronize em formato ISO "YYYY-MM-DDTHH:mm:ss" ou "YYYY-MM-DDTHH:mm" sempre que ambos estiverem identificados. Caso apenas a data seja legível, utilize "YYYY-MM-DD".
   - preparationInstructions: Instruções obrigatórias de preparo (ex: "Jejum absoluto de 8 horas", "Bexiga confortavelmente cheia", "Suspender uso de ácido acetilsalicílico por 3 dias").
   - reason: Motivo ou indicação clínica do agendamento, se informado.
   - notes: Instruções complementares (ex: "Chegar com 20 minutos de antecedência", "Apresentar documento de identidade e carteirinha do convênio").
4. IDENTIFICAÇÃO DO PACIENTE:
   - Identifique o nome do paciente vinculado ao agendamento no campo patientNameIdentified.
5. ALERTA DE CONFIANÇA (confidenceWarning):
   - Caso haja qualquer ambiguidade de horário, data cortada ou baixa qualidade na imagem/print, informe detalhadamente em confidenceWarning.
6. O retorno DEVE ser estritamente em formato JSON em conformidade com o schema definido.`;

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
          text: 'Identifique e estruture todos os agendamentos de consultas médicas e exames presentes neste documento/comprovante.',
        },
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            patientNameIdentified: { type: Type.STRING },
            confidenceWarning: { type: Type.STRING },
            generalNotes: { type: Type.STRING },
            schedules: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: {
                    type: Type.STRING,
                    enum: ['consulta', 'exame'],
                  },
                  title: { type: Type.STRING },
                  specialtyOrCategory: { type: Type.STRING },
                  professional: { type: Type.STRING },
                  location: { type: Type.STRING },
                  dateTime: { type: Type.STRING },
                  reason: { type: Type.STRING },
                  notes: { type: Type.STRING },
                  preparationInstructions: { type: Type.STRING },
                },
                required: ['type', 'title', 'specialtyOrCategory', 'dateTime'],
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
      return parsed;
    } catch (err: any) {
      console.error('[ScheduleAiService] Falha ao fazer parse do retorno JSON do Gemini:', err, text);
      throw new Error('Não foi possível interpretar as informações do agendamento via IA. Tente novamente.');
    }
  }
}

export const scheduleAiService = new ScheduleAiService();
