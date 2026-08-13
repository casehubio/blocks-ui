export { type DatasetContract } from './dataset-contract.js';
export * from './tokens/index.js';
export * from './types/index.js';
export * from './commitment-pill/index.js';
export * from './status-badge/index.js';
export { stateCategoryStyles, type CategoryStyle } from './styles/category.js';

// Re-exports from pages (canonical home — migrated from blocks-ui-core)
export { DataSourceAdapter, DataSourceMixin, EventStreamController, TrendSourceMixin } from '@casehubio/pages-component';
export { timerSubscribe as subscribe, timerUnsubscribe as unsubscribe } from '@casehubio/pages-component';
export { fetchSource, type FetchSourceOptions, createTypedFetchSource, type TypedFetchOptions, EMPTY_DATASET, extractTrendPoints, type TrendPoint } from '@casehubio/pages-data';
export { PagesConfirmDialog as BlocksConfirmDialog, renderSparkline, type SparklineOptions, renderPropertyTree, propertyTreeStyles } from '@casehubio/pages-ui-components';
export { pulseAnimation } from '@casehubio/pages-ui-tokens';
