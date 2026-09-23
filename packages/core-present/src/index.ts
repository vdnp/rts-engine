/**
 * @bfme/core-present — sim durumundan gorsele kopru.
 *
 * Bu katman sim durumunu YALNIZCA OKUR. Tip sistemi bunu zorlar:
 * `ReadonlySimState` icindeki tipli dizilerin yazma yontemleri gorunmez.
 */
export { TICK_MS, bamToRadians, interpolationAlpha, lerp, lerpAngle } from './interpolate';

export { TransformRing, isContinuous } from './ring';
export type { Snapshot } from './ring';

export { DEFAULT_VIEW_CONFIG, ViewBuilder, placeEntity } from './view';
export type { Placement, ViewConfig } from './view';

export { DEFAULT_SAMPLE_WINDOW_MS, StatsTracker, formatDataHash, formatStats } from './stats';
export type { StatsSample } from './stats';
