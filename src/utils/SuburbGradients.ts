/**
 * SuburbGradients.ts — Curated state-based gradient backgrounds for suburbs
 * when real photos aren't available from the backend.
 */

export type AustralianState = 'NSW' | 'VIC' | 'QLD' | 'SA' | 'WA' | 'TAS' | 'NT' | 'ACT';

export const STATE_GRADIENTS: Record<AustralianState, string> = {
  NSW: 'linear-gradient(135deg, #1e3a8a 0%, #3730a3 50%, #4c1d95 100%)',
  VIC: 'linear-gradient(135deg, #0f172a 0%, #0f766e 50%, #14b8a6 100%)',
  QLD: 'linear-gradient(135deg, #052e16 0%, #166534 50%, #15803d 100%)',
  SA: 'linear-gradient(135deg, #78350f 0%, #92400e 50%, #b45309 100%)',
  WA: 'linear-gradient(135deg, #166534 0%, #15803d 50%, #16a34a 100%)',
  TAS: 'linear-gradient(135deg, #0369a1 0%, #0284c7 50%, #0ea5e9 100%)',
  NT: 'linear-gradient(135deg, #451a03 0%, #78350f 50%, #92400e 100%)',
  ACT: 'linear-gradient(135deg, #0f172a 0%, #3730a3 50%, #4f46e5 100%)'
};

/**
 * Returns a gradient background based on the state
 * @param state - Australian state abbreviation
 * @returns CSS gradient string
 */
export function getStateGradient(state: string): string {
  const validState = state.toUpperCase() as AustralianState;
  return STATE_GRADIENTS[validState] || STATE_GRADIENTS['VIC'];
}