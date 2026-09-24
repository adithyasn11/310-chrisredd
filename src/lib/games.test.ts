import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getGameById,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

async function seedGamesForFiltering(db: Database) {
    const [strategy] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [puzzle] = await db
        .insert(categories)
        .values({ name: 'Puzzle', description: 'cat' })
        .returning({ id: categories.id });
    const [orbit] = await db
        .insert(publishers)
        .values({ name: 'Orbit Games', description: 'pub' })
        .returning({ id: publishers.id });
    const [pixel] = await db
        .insert(publishers)
        .values({ name: 'Pixel Forge', description: 'pub' })
        .returning({ id: publishers.id });

    await db.insert(games).values([
        { title: 'Alpha', description: 'Alpha desc', starRating: 4.0, categoryId: strategy.id, publisherId: orbit.id },
        { title: 'Beta', description: 'Beta desc', starRating: 4.5, categoryId: strategy.id, publisherId: pixel.id },
        { title: 'Gamma', description: 'Gamma desc', starRating: 3.5, categoryId: puzzle.id, publisherId: orbit.id },
        { title: 'Delta', description: 'Delta desc', starRating: 5.0, categoryId: puzzle.id, publisherId: pixel.id },
    ]);

    return { strategy, puzzle, orbit, pixel };
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('filters games by category and publisher together', async () => {
        const { strategy, orbit } = await seedGamesForFiltering(db);
        const all = await getAllGames(db, { categoryId: strategy.id, publisherId: orbit.id });

        expect(all.map((game) => game.title)).toEqual(['Alpha']);
        expect(all.every((game) => game.category?.id === strategy.id)).toBeTruthy();
        expect(all.every((game) => game.publisher?.id === orbit.id)).toBeTruthy();
    });

    it('filters game ids by publisher when multiple publishers are present', async () => {
        const { orbit } = await seedGamesForFiltering(db);
        const ids = await getAllGameIds(db, { publisherId: orbit.id });

        expect(ids).toEqual([1, 3]);
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });
});
