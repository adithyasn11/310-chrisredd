/**
 * Publisher lookup helpers used by the static catalog pages.
 *
 * These build-time queries read the publisher table from SQLite and return only
 * the fields needed by the site’s listing and detail views.
 */

import { asc } from 'drizzle-orm';
import type { Database } from './db';
import { publishers } from '../../db/schema';
import type { Publisher } from '../types/game';

/**
 * Returns every publisher sorted alphabetically by display name.
 *
 * @param db - Database connection used to query the publishers table.
 * @returns A list of publishers with their identifiers and names.
 */
export async function getAllPublishers(db: Database): Promise<Publisher[]> {
    return db
        .select({ id: publishers.id, name: publishers.name })
        .from(publishers)
        .orderBy(asc(publishers.name));
}
