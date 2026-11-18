import type { HealthItem, Pet, Species } from '@/store/types';

export const speciesLabel: Record<Species, string> = {
  dog: 'Cachorro',
  cat: 'Gato',
  other: 'Pet',
};

/** "do" / "da" for Portuguese possessives: "Saúde do Thor", "Saúde da Mel". */
export function de(pet: Pick<Pet, 'sex'> | null): string {
  return pet?.sex === 'female' ? 'da' : 'do';
}

/** Age from "mm/aaaa" → "3 anos" / "8 meses"; empty string when unknown. */
export function ageLabel(birth: string): string {
  const match = birth.trim().match(/^(\d{1,2})\/(\d{4})$/);
  if (!match) return '';
  const month = Number(match[1]);
  const year = Number(match[2]);
  const now = new Date();
  const months = (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month);
  if (months < 0) return '';
  if (months < 12) return months === 1 ? '1 mês' : `${months} meses`;
  const years = Math.floor(months / 12);
  return years === 1 ? '1 ano' : `${years} anos`;
}

export function petSubtitle(pet: Pet): string {
  return [pet.breed || speciesLabel[pet.species], ageLabel(pet.birth)].filter(Boolean).join(' · ');
}

export function defaultHealth(species: Species): HealthItem[] {
  const common: HealthItem[] = [
    { id: 'rabies', name: 'Antirrábica', intervalDays: 365, lastDate: null },
    { id: 'deworm', name: 'Vermífugo', intervalDays: 90, lastDate: null },
    { id: 'flea', name: 'Antipulgas', intervalDays: 30, lastDate: null },
    { id: 'vet', name: 'Consulta de rotina', intervalDays: 365, lastDate: null },
  ];
  if (species === 'dog') {
    return [{ id: 'v10', name: 'Vacina V10 / V8', intervalDays: 365, lastDate: null }, ...common];
  }
  if (species === 'cat') {
    return [{ id: 'v4', name: 'Vacina V4 / V5', intervalDays: 365, lastDate: null }, ...common];
  }
  return [
    { id: 'deworm', name: 'Vermífugo', intervalDays: 90, lastDate: null },
    { id: 'vet', name: 'Consulta de rotina', intervalDays: 365, lastDate: null },
  ];
}
