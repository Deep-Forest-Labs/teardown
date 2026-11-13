// Every builder by kind: the frozen v0 stand-ins (standins.js) plus later versions (enemies/*.js).
// A version listed in versions.js points at one of these keys; keys are never reused for a different behaviour.
import {buildSwarmer} from './enemies/swarmer.js';
import {BUILD} from './standins.js';

export const BUILDS = {...BUILD, swarmer: buildSwarmer};
