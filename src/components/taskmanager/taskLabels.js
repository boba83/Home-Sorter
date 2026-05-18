/** Labele zadataka — redosled prikaza u modalu */
export const LABEL_OPTIONS = ['Hitno', 'Opasno', 'Problem', 'Zadatak', 'Ostalo'];

/** Boje bedževa na kartici (i u modalu kad je labela izabrana) */
export const LABEL_COLORS = {
  Hitno: 'bg-red-500 text-white',
  Opasno: 'bg-orange-500 text-white',
  Problem: 'bg-yellow-400 text-yellow-950',
  Zadatak: 'bg-green-500 text-white',
  Ostalo: 'bg-blue-500 text-white',
  // stare labele u bazi (ako postoje)
  Bug: 'bg-orange-500 text-white',
  Feature: 'bg-green-500 text-white',
  Design: 'bg-yellow-400 text-yellow-950',
};
