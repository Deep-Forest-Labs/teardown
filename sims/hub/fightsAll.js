// Every prince fight by layer, latest version. v0 rigs stay in fights.js and fights2.js (frozen); detail passes
// live in fights/*.js and replace their layer here.
import {FIGHTS} from './fights.js';
import {FIGHTS2} from './fights2.js';
import {leviathan} from './fights/leviathan.js';
import {altarStage} from './stages/altar.js';
import {voidStage} from './stages/void.js';
import {ruinsStage} from './stages/ruins.js';
import {gluttonyStage} from './stages/gluttony.js';
import {greedStage} from './stages/greed.js';
import {lustStage} from './stages/lust.js';
import {wrathStage} from './stages/wrath.js';
import {fraudStage} from './stages/fraud.js';
import {treacheryStage} from './stages/treachery.js';

// v2 stages (stages/*.js) are model-first: a kin file, interlock checks, states Run / Arrival / Phase 1 / Phase 2
export const ALL_FIGHTS = {...FIGHTS, ...FIGHTS2, altar: altarStage, void: voidStage, ruins: ruinsStage, gluttony: gluttonyStage, greed: greedStage, lust: lustStage, wrath: wrathStage, fraud: fraudStage, treachery: treacheryStage};
export const FIGHT_V1 = {altar: leviathan};
export const FIGHT_V0 = {...FIGHTS, ...FIGHTS2};
