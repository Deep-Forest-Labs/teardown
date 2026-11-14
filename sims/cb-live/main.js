// THE CHOPPING BLOCK live page, with the reference spawn table (timeline, power curve, swarm size). Shared code in ../cb-shared.
import {runLive} from '../cb-shared/live.js';
import table from '../cb-shared/reference-table.json';

runLive({table});
