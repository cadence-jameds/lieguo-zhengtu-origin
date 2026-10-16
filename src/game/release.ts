import type {ReleaseMetadata} from './releaseTypes';
export const RELEASE:ReleaseMetadata=__APP_RELEASE_METADATA__;
export const releaseNotes=RELEASE.history[0].notes;
export const releaseHistory=RELEASE.history;
