import { RELEASE } from '../release';
/** Initial B1 contract versions; final freeze belongs to B11. */
export const FORMAL_SCHEMA_VERSION = 1 as const;
export const FORMAL_CONTENT_VERSION = 'lieguo-formal-b1.2-time2' as const;
export const FORMAL_RULESET_VERSION = 'v84-b1-skeleton.1' as const;
export const FORMAL_GENERATOR_VERSION = 'minimal-fixture-b1.1' as const;
export const FORMAL_TERRAIN_VERSION = 1 as const;
export const FORMAL_SAVE_FORMAT = 'lieguo-formal-save' as const;
export const LEGACY_FORMAL_DB_NAME = 'lieguo-formal-stage2-schema1' as const;
export const FORMAL_DB_NAME = 'lieguo-formal-stage2-time2' as const;
export const FORMAL_WRITER_LOCK = `${FORMAL_DB_NAME}-writer`;
export const formalMetadata = () => ({
  appVersion: RELEASE.version,
  schemaVersion: FORMAL_SCHEMA_VERSION,
  contentVersion: FORMAL_CONTENT_VERSION,
  rulesetVersion: FORMAL_RULESET_VERSION,
  worldGeneratorVersion: FORMAL_GENERATOR_VERSION,
  terrainVersion: FORMAL_TERRAIN_VERSION,
});
export const NATIVE_CONTENT_VERSION = 'lieguo-formal-b5.2-time2' as const;
export const NATIVE_RULESET_VERSION = 'v91-b5.2' as const;
export const NATIVE_GENERATOR_VERSION = 'formal-world-384-v1' as const;
export const NATIVE_TERRAIN_VERSION = 3 as const;
export const nativeMetadata = () => ({appVersion:RELEASE.version,schemaVersion:3 as const,contentVersion:NATIVE_CONTENT_VERSION,rulesetVersion:NATIVE_RULESET_VERSION,worldGeneratorVersion:NATIVE_GENERATOR_VERSION,terrainVersion:NATIVE_TERRAIN_VERSION});
export type B4Metadata={appVersion:string;schemaVersion:2;contentVersion:'lieguo-formal-b4.1';rulesetVersion:'v84-b4.1'|'v85-b4.2';worldGeneratorVersion:typeof NATIVE_GENERATOR_VERSION;terrainVersion:2};
export type LegacyB5Metadata=Omit<ReturnType<typeof nativeMetadata>,'terrainVersion'|'rulesetVersion'>&{terrainVersion:2|3;rulesetVersion:'v86-b5.1'|typeof NATIVE_RULESET_VERSION};
export type VersionMetadata = ReturnType<typeof formalMetadata>|ReturnType<typeof nativeMetadata>|B4Metadata|LegacyB5Metadata;
