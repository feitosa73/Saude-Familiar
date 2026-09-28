import { GoogleGenAI, Type } from '@google/genai';
import { ExtractedPrescriptionResponse } from '../types';

const SYSTEM_INSTRUCTION = `Você é um médico auditor e assistente farmacêutico de inteligência artificial de alta precisão especializado em prescrições médicas brasileiras.
Sua missão é ler cuidadosamente a imagem ou PDF da receita médica e extrair com precisão cirúrgica todas as prescrições farmacêuticas para um sistema de prontuário e gestão de medicação de idosos.

DIRETRIZES FUNDAMENTAIS:
1. ZERO ALUCINAÇÃO: Extraia estritamente os medicamentos, concentrações e posologias legíveis no documento. Jamais invente ou deduza nomes de remédios ou doses que não estejam no texto.
2. NOMES DE MEDICAMENTOS: Mantenha a nomenclatura como grafada (nome comercial ou denominação genérica).
3. DOSAGEM: Identifique a dosagem ou apresentação (ex: "50mg", "1 comprimido", "5ml", "10 gotas").
4. FREQUÊNCIA E HORÁRIOS:
   - Se for "1x ao dia pela manhã", atribua frequência "1x ao dia" e times: ["08:00"].
   - Se for "de 12 em 12 horas", atribua frequência "A cada 12 horas" e times: ["08:00", "20:00"].
   - Se for "de 8 em 8 horas", atribua frequência "A cada 8 horas" e times: ["06:00", "14:00", "22:00"].
   - Se for "de 6 em 6 horas", atribua frequência "A cada 6 horas" e times: ["06:00", "12:00", "18:00", "00:00"].
   - Se for "se necessário", atribua frequência "Se necessário" e times: [].
   - Se for "ao deitar", atribua frequência "1x ao dia à noite" e times: ["22:00"].
5. ILEGIBILIDADE OU DÚVIDA: Caso a letra do médico esteja parcialmente ilegível ou ambígua em algum item, anote no campo confidenceWarning para que o cuidador humano revise com atenção redobrada antes de aprovar.
6. INFORMAÇÕES DO MÉDICO E DATA: Identifique se constar o nome do médico, CRM e a data da receita.
7. O retorno DEVE ser estritamente em formato JSON em conformidade com o schema definido.`;

export class PrescriptionAiService {
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

  async extractFromBuffer(buffer: Buffer, mimeType: string): Promise<ExtractedPrescriptionResponse> {
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
          text: 'Transcreva e estruture todos os medicamentos prescritos nesta receita médica conforme as instruções do sistema.',
        },
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            prescribingDoctor: { type: Type.STRING },
            doctorCrm: { type: Type.STRING },
            prescriptionDate: { type: Type.STRING },
            patientNameIdentified: { type: Type.STRING },
            confidenceWarning: { type: Type.STRING },
            generalNotes: { type: Type.STRING },
            medications: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  dosage: { type: Type.STRING },
                  frequency: { type: Type.STRING },
                  times: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  durationDays: { type: Type.NUMBER },
                  startDate: { type: Type.STRING },
                  notes: { type: Type.STRING },
                },
                required: ['name', 'dosage', 'frequency', 'times'],
              },
            },
          },
          required: ['medications'],
        },
      },
    });

    const text = response.text?.trim() || '{}';
    try {
      const parsed = JSON.parse(text) as ExtractedPrescriptionResponse;
      if (!Array.isArray(parsed.medications)) {
        parsed.medications = [];
      }
      return parsed;
    } catch (err: any) {
      console.error('[PrescriptionAiService] Falha ao fazer parse do retorno JSON do Gemini:', err, text);
      throw new Error('Não foi possível interpretar a resposta estruturada da IA. Tente novamente.');
    }
  }
}

export const prescriptionAiService = new PrescriptionAiService();
