import { GoogleGenAI, Type } from '@google/genai';
import { ExtractedExamReportResponse } from '../types';

const SYSTEM_INSTRUCTION = `Você é um médico patologista clínico e especialista em diagnóstico laboratorial e por imagem de alta precisão.
Sua missão é analisar cuidadosamente a imagem ou PDF do laudo/resultado de exame e transcrever com rigor científico todos os parâmetros avaliados, valores encontrados, intervalos de referência e impressões clínicas para o prontuário do paciente.

DIRETRIZES FUNDAMENTAIS:
1. ZERO ALUCINAÇÃO: Extraia estritamente os exames, parâmetros e resultados legíveis no laudo. Jamais invente ou estime valores que não constem no texto do documento.
2. DADOS CADASTRAIS DO LAUDO:
   - Identifique o nome principal do exame ou painel (ex: "Hemograma Completo", "Perfil Lipídico", "Glicemia de Jejum", "Ultrassonografia de Abdome Total").
   - Identifique o laboratório ou clínica emitente.
   - Identifique a data de realização/coleta (formato YYYY-MM-DD se possível ou texto).
   - Identifique o médico solicitante e o nome do paciente, se legíveis.
3. PARÂMETROS E RESULTADOS ANALÍTICOS (results):
   - parameter: Nome do analito ou achado (ex: "Hemoglobina", "Glicose", "Creatinina", "TSH", "Colesterol Total").
   - value: Valor numérico ou textual encontrado no documento (ex: "13.8", "92", "1.05", "Ausente", "Negativo").
   - unit: Unidade de medida indicada (ex: "mg/dL", "g/dL", "/mm³", "mUI/L", "%").
   - referenceRange: Faixa de referência normal informada no próprio laudo (ex: "70 a 99 mg/dL", "12.0 a 16.0 g/dL").
   - status: Classifique estritamente como:
     * "altered": se o resultado estiver fora do intervalo de referência (marcado com asterisco, "alto", "baixo", "reagente", alteração radiológica, etc.).
     * "normal": se estiver dentro da faixa de referência normal ou ausente de patologia.
     * "inconclusive": se o laudo indicar resultado duvidoso, inconclusivo ou indeterminado.
   - notes: Observações pontuais pertinentes ao parâmetro específico, se houver.
4. RESUMO CLÍNICO (clinicalSummary):
   - Elabore um resumo conciso, didático e humano dos principais achados para familiares e cuidadores, pontuando claramente se houve itens alterados de atenção.
5. ILEGIBILIDADE OU DÚVIDA (confidenceWarning):
   - Caso o documento esteja cortado, com baixa resolução, borrado ou com páginas faltando, declare explicitamente no campo confidenceWarning.
6. O retorno DEVE ser estritamente em formato JSON em conformidade com o schema definido.`;

export class ExamAiService {
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

  async extractFromBuffer(buffer: Buffer, mimeType: string): Promise<ExtractedExamReportResponse> {
    const base64Data = buffer.toString('base64');

    const response = await this.ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          inlineData: {
            mimeType: mimeType || 'application/pdf',
            data: base64Data,
          },
        },
        {
          text: 'Analise este laudo de exame médico, transcreva e estruture todos os parâmetros laboratoriais e diagnósticos conforme as instruções do sistema.',
        },
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            examName: { type: Type.STRING },
            laboratory: { type: Type.STRING },
            examDate: { type: Type.STRING },
            requestingDoctor: { type: Type.STRING },
            patientNameIdentified: { type: Type.STRING },
            confidenceWarning: { type: Type.STRING },
            generalNotes: { type: Type.STRING },
            clinicalSummary: { type: Type.STRING },
            results: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  parameter: { type: Type.STRING },
                  value: { type: Type.STRING },
                  unit: { type: Type.STRING },
                  referenceRange: { type: Type.STRING },
                  status: {
                    type: Type.STRING,
                    enum: ['normal', 'altered', 'inconclusive'],
                  },
                  notes: { type: Type.STRING },
                },
                required: ['parameter', 'value', 'status'],
              },
            },
          },
          required: ['examName', 'results', 'clinicalSummary'],
        },
      },
    });

    const text = response.text?.trim() || '{}';
    try {
      const parsed = JSON.parse(text) as ExtractedExamReportResponse;
      if (!Array.isArray(parsed.results)) {
        parsed.results = [];
      }
      if (!parsed.clinicalSummary) {
        parsed.clinicalSummary = 'Laudo processado com sucesso.';
      }
      return parsed;
    } catch (err: any) {
      console.error('[ExamAiService] Falha ao fazer parse do retorno JSON do Gemini:', err, text);
      throw new Error('Não foi possível interpretar os resultados do laudo de exame via IA. Tente novamente.');
    }
  }
}

export const examAiService = new ExamAiService();
