/**
 * Operational kill switches. Adding an ID here stops it being assigned in new
 * sessions and substitutions on the next app build/update. A remote switch
 * (Supabase table `feature_switches`) can extend this once cloud is enabled;
 * devices that stay offline keep the last switches they received.
 */
export const DISABLED_EXERCISE_IDS: string[] = [];
export const DISABLED_TEMPLATE_IDS: string[] = [];
