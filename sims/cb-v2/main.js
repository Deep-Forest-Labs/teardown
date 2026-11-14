// THE CHOPPING BLOCK V2: the game's own horde on the study's spawning, with the reference spawn table. Shared code in ../cb-shared.
import {runLive} from '../cb-shared/live.js';
import table from '../cb-shared/reference-table.json';

runLive({table, v2: true});
