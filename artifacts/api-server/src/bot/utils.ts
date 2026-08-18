/** Normalise a game name for fuzzy matching — lowercase, strip spaces and punctuation.
 *  "BF (blox fruit)" and "BF (bloxfruit)" both become "bfbloxfruit". */
export const normGame = (s: string): string =>
  s.toLowerCase().replace(/[\s\-_()\[\].,!?]/g, "");
