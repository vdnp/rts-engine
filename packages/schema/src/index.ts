/**
 * @bfme/schema — icerik veri bicimleri ve dogrulama.
 *
 * Bu paket sadece sekil bilir, icerik bilmez: hicbir fraksiyon veya birim ismi
 * burada gecmez.
 */
export {
  ColorSchema,
  DisplayNameSchema,
  SLUG_PATTERN,
  SlugSchema,
  VERSION_PATTERN,
  VERSION_RANGE_PATTERN,
  VersionRangeSchema,
  VersionSchema,
} from './primitives';
export type { Color } from './primitives';

export { ManifestSchema } from './manifest';
export type { Manifest } from './manifest';

export { UnitSchema } from './unit';
export type { UnitData } from './unit';

export { FactionSchema } from './faction';
export type { FactionData } from './faction';

export {
  ContentError,
  describeValue,
  formatIssue,
  formatIssues,
  toIssues,
  valueAtPath,
} from './error';
export type { ContentIssue, IssueContext } from './error';

export type {
  AngularRate,
  Content,
  Faction,
  FactionId,
  ModInfo,
  UnitType,
  UnitTypeId,
} from './content';
