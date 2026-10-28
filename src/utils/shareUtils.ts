/**
 * shareUtils.ts
 * Utilitários para compartilhamento nativo via Web Share API
 * com fallback transparente para a Área de Transferência (Clipboard).
 * Custo de infraestrutura: ZERO (100% Client-Side).
 */

export interface ShareAppointmentData {
  patientName: string;
  specialty: string;
  professional: string;
  dateStr: string;
  timeStr?: string;
  location?: string;
  reason?: string;
  notes?: string;
}

export interface ShareExamData {
  patientName: string;
  examName: string;
  requestingDoctor?: string;
  dateStr: string;
  statusLabel?: string;
  notes?: string;
  laboratory?: string;
  protocolNumber?: string;
  expectedResultDate?: string;
  portalUrl?: string;
  accessUser?: string;
  accessPassword?: string;
  accessCode?: string;
  includeCredentials?: boolean;
}

/**
 * Monta mensagem estruturada e acolhedora com emojis para avisar a família sobre Consulta.
 */
export function buildAppointmentShareText(data: ShareAppointmentData): { title: string; text: string } {
  const title = `Consulta de ${data.patientName}: ${data.specialty}`;

  const lines: string[] = [
    `🏥 *Aviso de Consulta - Saúde Familiar*`,
    ``,
    `Olá família! Seguem os detalhes do agendamento de *${data.patientName}*:`,
    ``,
    `🩺 *Especialidade:* ${data.specialty}`,
    data.professional ? `👨‍⚕️ *Profissional:* ${data.professional}` : '',
    data.timeStr
      ? `📅 *Data e Horário:* ${data.dateStr} às ${data.timeStr}`
      : `📅 *Data:* ${data.dateStr}`,
    data.location ? `📍 *Local:* ${data.location}` : '',
    data.reason ? `🎯 *Motivo:* ${data.reason}` : '',
    data.notes ? `📝 *Observações / Preparo:* ${data.notes}` : '',
    ``,
    `_Mensagem compartilhada via App Saúde Familiar_`,
  ].filter((line) => line !== '');

  return {
    title,
    text: lines.join('\n'),
  };
}

/**
 * Monta mensagem estruturada e acolhedora com emojis para avisar a família sobre Exame.
 * Por padrão seguro, NUNCA inclui senhas ou dados confidenciais a menos que includeCredentials seja explicitamente true.
 */
export function buildExamShareText(data: ShareExamData): { title: string; text: string } {
  const title = `Exame de ${data.patientName}: ${data.examName}`;

  const hasCredentials = Boolean(data.accessUser || data.accessPassword || data.accessCode);
  const shouldIncludeCredentials = Boolean(data.includeCredentials && hasCredentials);

  const lines: string[] = [
    `🔬 *Lembrete de Exame - Saúde Familiar*`,
    ``,
    `Olá família! Seguem as informações do exame de *${data.patientName}*:`,
    ``,
    `🧪 *Exame:* ${data.examName}`,
    data.laboratory ? `🏢 *Laboratório:* ${data.laboratory}` : '',
    data.protocolNumber ? `🔢 *Protocolo:* ${data.protocolNumber}` : '',
    data.requestingDoctor ? `👨‍⚕️ *Médico Solicitante:* ${data.requestingDoctor}` : '',
    `📅 *Data da Coleta/Execução:* ${data.dateStr}`,
    data.expectedResultDate ? `⏳ *Previsão de Resultado:* ${data.expectedResultDate}` : '',
    data.statusLabel ? `📊 *Status Atual:* ${data.statusLabel}` : '',
    data.portalUrl && !shouldIncludeCredentials ? `🌐 *Portal de Resultados:* ${data.portalUrl}` : '',
    data.notes ? `💡 *Recomendações / Observações:* ${data.notes}` : '',
  ];

  if (shouldIncludeCredentials) {
    lines.push(
      ``,
      `🔐 *Dados de Acesso aos Resultados Online:*`,
      data.portalUrl ? `🌐 *Portal:* ${data.portalUrl}` : '',
      data.accessUser ? `👤 *Usuário / Login:* ${data.accessUser}` : '',
      data.accessPassword ? `🔑 *Senha de Acesso:* ${data.accessPassword}` : '',
      data.accessCode ? `🏷️ *Código / Localizador:* ${data.accessCode}` : '',
      `⚠️ _Atenção: Informações confidenciais. Compartilhe apenas com pessoas de confiança da família._`
    );
  }

  lines.push(``, `_Mensagem compartilhada via App Saúde Familiar_`);

  return {
    title,
    text: lines.filter((line) => line !== '').join('\n'),
  };
}

export interface ShareResult {
  success: boolean;
  method?: 'native' | 'clipboard';
  cancelled?: boolean;
  error?: string;
}

/**
 * Executa compartilhamento nativo via navigator.share ou fallback via clipboard.
 */
export async function shareContentNative(title: string, text: string): Promise<ShareResult> {
  // 1. Tentar Web Share API se suportada pelo navegador/dispositivo
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title,
        text,
      });
      return { success: true, method: 'native' };
    } catch (err: any) {
      // Se o usuário cancelou o menu de compartilhamento do SO (AbortError), não é erro
      if (err.name === 'AbortError') {
        return { success: false, cancelled: true };
      }
      // Se falhou por outro motivo de permissão ou SO, tenta o fallback do clipboard abaixo
      console.warn('[WebShare] Falha no navigator.share, acionando fallback clipboard:', err);
    }
  }

  // 2. Fallback: Copiar para Área de Transferência (Clipboard API)
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return { success: true, method: 'clipboard' };
    } else {
      // Fallback legado para navegadores mais antigos sem clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (successful) {
        return { success: true, method: 'clipboard' };
      }
      return { success: false, error: 'Não foi possível copiar o texto automaticamente.' };
    }
  } catch (err: any) {
    console.error('[WebShare] Erro ao copiar texto:', err);
    return { success: false, error: err.message || 'Erro ao copiar dados do agendamento' };
  }
}
