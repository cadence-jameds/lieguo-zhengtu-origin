import type {WorldRead} from '../presentationModel';
import {empireOf,legionOf} from '../formal/politics';

/** The shortcuts keep their stable IDs; only the current member's label follows the projection. */
export function politicalCommunity(w:WorldRead){
 const me=w.playerFactionId,legion=legionOf(w,me),empire=empireOf(w,me);
 return legion&&empire?.legions.includes(legion.id)?{legion,empire}:undefined;
}
export function politicalCommunityLabel(w:WorldRead){return politicalCommunity(w)?'帝國':'軍團';}
