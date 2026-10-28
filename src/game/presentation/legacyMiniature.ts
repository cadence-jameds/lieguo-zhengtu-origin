/** Display-only offsets for existing lower-row city atlas cells, in art-box percent.
 * These panels previously put their ground discs above the front wall.
 * No scaling, atlas edits, or changes to imperial / unwalled / other civilizations.
 */
export const LEGACY_CITY_GROUND:Readonly<Record<string,readonly [number,number,number]>>={
 civ_britannia:[14.77,5.59,8.33],
 civ_japan:[15.16,3.25,7.54],
 civ_mongol:[14.19,2.47,7.54],
};
export function legacyCityGroundOffset(civ:string,era:number,wall:number){return wall>0&&era>=0&&era<3?LEGACY_CITY_GROUND[civ]?.[era]:undefined;}
