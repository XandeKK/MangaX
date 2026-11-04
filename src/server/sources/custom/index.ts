import { MangaSource } from '../types';
import { DemonicScansSource } from './demonic-scans';
import { AsuraScansSource } from './asura-scans';

/**
 * Reviewed TypeScript adapters may be imported and registered here.
 * Never load user supplied files or dynamically import paths from requests.
 */
export const trustedSourceAdapters: MangaSource[] = [new DemonicScansSource(), new AsuraScansSource()];
