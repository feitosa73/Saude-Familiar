import { GoogleGenAI, Type } from '@google/genai';
import { ExtractedScheduleResponse } from '../types';

const SYSTEM_INSTRUCTION = `Você é um assistente de gestão em saúde e triagem de agendamentos médicos brasileiro de alta precisão.
Sua missão é analisar cuidadosamente a imagem ou PDF contendo comprovantes de agendamento, guias de marcação de consultas/exames, pedidos médicos ou prints de confirmações do WhatsApp/SMS, e estruturar cada compromisso para a agenda do paciente.

DIRETRIZES FUNDAMENTAIS DE EXTRAÇÃO:
1. CONCISÃO E ESTILO ESTRITOS (ANTI-VERBORRAGIA / ZERO LOOP):
   - Seja extremamente conciso e direto. Os campos reason, preparationInstructions e notes devem ter no máximo 10 a 15 palavras.
   - NUNCA transcreva o texto completo do documento. NUNCA repita informações. Use bullet points curtos se necessário.
   - Jamais inclua números de leis, portarias, códigos administrativos longos ou repetições de termos burocráticos.

2. EXTRAÇÃO OBRIGATÓRIA DE DATA E HORA EXATA (dateTime):
   - Busque ATIVAMENTE a data e o horário exato do compromisso no documento (ex: 13:50, 08:00, 14:30).
   - Componha SEMPRE o campo dateTime no formato ISO estrito: "YYYY-MM-DDTHH:mm" (ex: "2026-10-06T13:50").
   - Se o horário estiver visível em qualquer parte do comprovante, NUNCA o omita. Se apenas a data estiver presente sem nenhum horário, utilize "YYYY-MM-DD".

3. CLASSIFICAÇÃO DA NATUREZA DO EVENTO (type):
   - "consulta": Para consultas médicas, retornos ambulatoriais, teleconsultas, avaliações com especialistas (Dermatologia, Cardiologia, etc.).
   - "exame": Para exames laboratoriais (sangue, urina), diagnósticos por imagem (Ultrassonografia, Raio-X, Tomografia, Ressonância), endoscopias, etc.

4. DADOS DE CADA AGENDAMENTO (schedules):
   - title: Título curto e claro (ex: "Consulta Dermatologia", "Ultrassonografia Doppler").
   - specialtyOrCategory: Especialidade médica ou modalidade do exame (ex: "Dermatologia", "Ultrassonografia").
   - professional: Nome do profissional de saúde ou do estabelecimento médico (máximo 5 palavras).
   - location: Local do atendimento em poucas palavras (ex: "CRI Norte - Complexo Hospitalar Mandaqui").
   - dateTime: Data e horário em formato ISO "YYYY-MM-DDTHH:mm".
   - reason: Motivo ou queixa ultraconciso (MÁXIMO 10 a 15 palavras). Ex: "Avaliação dermatológica de rotina".
   - preparationInstructions: Preparo obrigatório ultraconciso (MÁXIMO 10 a 15 palavras). Ex: "Jejum de 8h, bexiga cheia".
   - notes: Observações complementares essenciais (MÁXIMO 10 a 15 palavras). Ex: "Chegar com 20 min de antecedência, levar documento com foto".

5. IDENTIFICAÇÃO DO PACIENTE:
   - Identifique apenas o nome do paciente no campo patientNameIdentified.

6. ALERTA DE CONFIANÇA (confidenceWarning):
   - Se houver horário ilegível ou data duvidosa, aponte em até uma frase curta em confidenceWarning.

7. O retorno DEVE ser estritamente em formato JSON em conformidade com o schema definido.`;

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
          text: 'Identifique e estruture todos os agendamentos presentes neste documento. Seja extremamente conciso e direto (máximo 10 a 15 palavras nos campos reason, preparationInstructions e notes). NUNCA repita informações. Extraia obrigatoriamente a data e a hora exata no campo dateTime no formato ISO YYYY-MM-DDTHH:mm.',
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

      // Safeguard: sanitize dateTime format and truncate any accidental repetitive text
      const trimWords = (val?: string, maxWords = 16): string | undefined => {
        if (!val) return undefined;
        const words = val.trim().split(/\s+/);
        if (words.length > maxWords) {
          return words.slice(0, maxWords).join(' ');
        }
        return val.trim();
      };

      parsed.schedules = parsed.schedules.map((s) => {
        let dt = s.dateTime ? s.dateTime.trim() : '';
        if (dt.includes(' ')) {
          dt = dt.replace(' ', 'T');
        }
        if (dt.length > 16 && dt.includes('T')) {
          dt = dt.slice(0, 16);
        }

        return {
          ...s,
          dateTime: dt,
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
