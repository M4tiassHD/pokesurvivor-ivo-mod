import { STATS } from './features/stats.js';
import { POWERS } from './features/powers.js';
import { SPAWNS } from './features/spawns.js';
import { LOCATOR } from './features/locator.js';
import { AUTOMATION_FEATURES } from './features/automation.js';

export const FEATURES = [...STATS, ...POWERS, ...SPAWNS, ...LOCATOR, ...AUTOMATION_FEATURES];
