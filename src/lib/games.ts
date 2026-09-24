/**
 * Build-time game lookups used by the catalog pages.
 *
 * The helpers return deterministic, relation-aware rows for Astro build-time
 * rendering and support optional category/publisher filters used by the index
 * page and its unit tests.
 */

import { eq, asc, and, inArray } from 'drizzle-orm';
import type { Database } from './db';
import { games, categories, publishers } from '../../db/schema';
import type { Game } from '../types/game';

export interface GameFilters {
    categoryId?: number | null;
    publisherId?: number | null;
    categoryIds?: number[];
    publisherIds?: number[];
}

const gameSelection = {
    id: games.id,
    title: games.title,
    description: games.description,
    starRating: games.starRating,
    categoryId: categories.id,
    categoryName: categories.name,
    publisherId: publishers.id,
    publisherName: publishers.name,
};

type GameSelectionRow = {
    id: number;
    title: string;
    description: string;
    starRating: number | null;
    categoryId: number | null;
    categoryName: string | null;
    publisherId: number | null;
    publisherName: string | null;
};

function mapGame(row: GameSelectionRow): Game {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        starRating: row.starRating,
        category:
            row.categoryId !== null && row.categoryName !== null
                ? { id: row.categoryId, name: row.categoryName }
                : null,
        publisher:
            row.publisherId !== null && row.publisherName !== null
                ? { id: row.publisherId, name: row.publisherName }
                : null,
    };
}

function collectFilterValues(primaryValue: number | null | undefined, secondaryValues?: number[]): number[] {
    const values = new Set<number>();

    if (primaryValue !== undefined && primaryValue !== null) {
        values.add(primaryValue);
    }

    for (const value of secondaryValues ?? []) {
        values.add(value);
    }

    return [...values];
}

function buildGameFilterConditions(filters: GameFilters) {
    const conditions = [];
    const categoryValues = collectFilterValues(filters.categoryId, filters.categoryIds);
    const publisherValues = collectFilterValues(filters.publisherId, filters.publisherIds);

    if (categoryValues.length > 0) {
        conditions.push(inArray(games.categoryId, categoryValues));
    }

    if (publisherValues.length > 0) {
        conditions.push(inArray(games.publisherId, publisherValues));
    }

    return conditions;
}

function baseGamesQuery(db: Database) {
    return db
        .select(gameSelection)
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id));
}

/**
 * Returns every game ordered by title, optionally narrowing the result set to
 * matching category and/or publisher filters.
 *
 * @param db - Database connection used to query the games table.
 * @param filters - Optional category/publisher filters applied before ordering.
 * @returns A list of games with their related category and publisher metadata.
 */
export async function getAllGames(db: Database, filters: GameFilters = {}): Promise<Game[]> {
    const conditions = buildGameFilterConditions(filters);

    if (conditions.length > 0) {
        const rows = await baseGamesQuery(db).where(and(...conditions)).orderBy(asc(games.title));
        return rows.map(mapGame);
    }

    const rows = await baseGamesQuery(db).orderBy(asc(games.title));
    return rows.map(mapGame);
}

/**
 * Returns all game ids in title order, optionally restricted to a set of
 * category and/or publisher filters.
 *
 * @param db - Database connection used to query the games table.
 * @param filters - Optional category/publisher constraints to apply before ordering.
 * @returns Game ids sorted alphabetically by title.
 */
export async function getAllGameIds(db: Database, filters: GameFilters = {}): Promise<number[]> {
    const conditions = buildGameFilterConditions(filters);

    if (conditions.length > 0) {
        const rows = await db.select({ id: games.id }).from(games).where(and(...conditions)).orderBy(asc(games.title));
        return rows.map((row) => row.id);
    }

    const rows = await db.select({ id: games.id }).from(games).orderBy(asc(games.title));
    return rows.map((row) => row.id);
}

/**
 * Fetches a single game by id, or null when it does not exist.
 *
 * @param db - Database connection used to query the games table.
 * @param id - Game identifier to look up.
 * @param filters - Optional filters that must also match the selected row.
 * @returns The matching game, or null when no row exists.
 */
export async function getGameById(db: Database, id: number, filters: GameFilters = {}): Promise<Game | null> {
    const conditions = [eq(games.id, id), ...buildGameFilterConditions(filters)];

    if (conditions.length > 0) {
        const row = await baseGamesQuery(db).where(and(...conditions)).get();
        return row ? mapGame(row) : null;
    }

    const row = await baseGamesQuery(db).where(eq(games.id, id)).get();
    return row ? mapGame(row) : null;
}
