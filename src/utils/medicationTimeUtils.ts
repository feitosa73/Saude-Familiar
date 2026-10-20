import { Medication } from '../types';

export interface NextMedicationResult {
  medication: Medication;
  nextTime: string;
  isTomorrow: boolean;
}

/**
 * Retorna o medicamento com o próximo horário de administração mais próximo do horário atual,
 * baseado estritamente na lista de horários cadastrados (times: string[] no formato 'HH:MM').
 * Sem inferir regras clínicas de atraso ou esquecimento.
 */
export function getNextChronologicalMedication(
  medications: Medication[],
  referenceDate: Date = new Date()
): NextMedicationResult | null {
  if (!medications || medications.length === 0) return null;

  const activeMeds = medications.filter((m) => m.active);
  if (activeMeds.length === 0) return null;

  const currentHours = referenceDate.getHours();
  const currentMinutes = referenceDate.getMinutes();
  const currentMinutesOfDay = currentHours * 60 + currentMinutes;

  interface DoseCandidate {
    medication: Medication;
    timeStr: string;
    minutesOfDay: number;
    diffMinutes: number;
  }

  const todayCandidates: DoseCandidate[] = [];
  const tomorrowCandidates: DoseCandidate[] = [];

  for (const med of activeMeds) {
    const times = Array.isArray(med.times) && med.times.length > 0 ? med.times : ['08:00'];
    for (const timeStr of times) {
      const parts = timeStr.split(':');
      const hours = parseInt(parts[0], 10) || 0;
      const minutes = parseInt(parts[1], 10) || 0;
      const doseMinutes = hours * 60 + minutes;

      if (doseMinutes >= currentMinutesOfDay) {
        todayCandidates.push({
          medication: med,
          timeStr,
          minutesOfDay: doseMinutes,
          diffMinutes: doseMinutes - currentMinutesOfDay,
        });
      } else {
        tomorrowCandidates.push({
          medication: med,
          timeStr,
          minutesOfDay: doseMinutes,
          diffMinutes: 1440 - currentMinutesOfDay + doseMinutes,
        });
      }
    }
  }

  if (todayCandidates.length > 0) {
    todayCandidates.sort((a, b) => a.diffMinutes - b.diffMinutes);
    return {
      medication: todayCandidates[0].medication,
      nextTime: todayCandidates[0].timeStr,
      isTomorrow: false,
    };
  }

  if (tomorrowCandidates.length > 0) {
    tomorrowCandidates.sort((a, b) => a.minutesOfDay - b.minutesOfDay);
    return {
      medication: tomorrowCandidates[0].medication,
      nextTime: tomorrowCandidates[0].timeStr,
      isTomorrow: true,
    };
  }

  return {
    medication: activeMeds[0],
    nextTime: activeMeds[0].times?.[0] || '08:00',
    isTomorrow: false,
  };
}

/**
 * Ordena a lista de medicamentos ativos para que os com doses mais próximas apareçam primeiro.
 */
export function sortMedicationsByNextDose(
  medications: Medication[],
  referenceDate: Date = new Date()
): Medication[] {
  if (!medications || medications.length <= 1) return medications;

  const currentHours = referenceDate.getHours();
  const currentMinutes = referenceDate.getMinutes();
  const currentMinutesOfDay = currentHours * 60 + currentMinutes;

  const getMinDiff = (med: Medication): number => {
    const times = Array.isArray(med.times) && med.times.length > 0 ? med.times : ['08:00'];
    let minDiff = Infinity;
    for (const timeStr of times) {
      const parts = timeStr.split(':');
      const doseMinutes = (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
      const diff = doseMinutes >= currentMinutesOfDay
        ? doseMinutes - currentMinutesOfDay
        : 1440 - currentMinutesOfDay + doseMinutes;
      if (diff < minDiff) {
        minDiff = diff;
      }
    }
    return minDiff;
  };

  return [...medications].sort((a, b) => getMinDiff(a) - getMinDiff(b));
}
