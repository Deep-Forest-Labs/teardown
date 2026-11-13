// Every prince fight by layer, latest version. v0 rigs stay in fights.js and fights2.js (frozen); detail passes
// live in fights/*.js and replace their layer here.
import {FIGHTS} from './fights.js';
import {FIGHTS2} from './fights2.js';
import {leviathan} from './fights/leviathan.js';

export const ALL_FIGHTS = {...FIGHTS, ...FIGHTS2, altar: leviathan};
export const FIGHT_V0 = {...FIGHTS, ...FIGHTS2};
