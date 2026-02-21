/**
 * Mock Drizzle DB for testing
 *
 * Provides chainable mock API that mimics Drizzle's query builder pattern.
 * Use this in tests instead of real PostgreSQL connection.
 *
 * @example
 * ```typescript
 * import { db } from "@/db";
 * jest.mock("@/db");
 *
 * beforeEach(() => {
 *   mockDb.reset();
 * });
 *
 * test("fetches topics", async () => {
 *   mockDb.select.mockReturnValue([{ id: 1, name: "Test" }]);
 *
 *   const result = await db.select().from(topics).where(eq(topics.id, 1));
 *
 *   expect(result).toHaveLength(1);
 * });
 * ```
 */

export interface MockDbChain {
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  from: jest.Mock;
  where: jest.Mock;
  orderBy: jest.Mock;
  limit: jest.Mock;
  offset: jest.Mock;
  values: jest.Mock;
  set: jest.Mock;
  onConflictDoUpdate: jest.Mock;
  onConflictDoNothing: jest.Mock;
  returning: jest.Mock;
  leftJoin: jest.Mock;
  groupBy: jest.Mock;
}

export interface MockDbQuery {
  topics: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
  };
  articles: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
  };
  scoreHistory: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
  };
  topicKeywords: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
  };
  auditLogs: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
  };
  trackedKeywords: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
  };
  topicViews: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
  };
  scoreFeedback: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
  };
}

/**
 * Creates a chainable mock that mimics Drizzle's query builder.
 * Each method returns `this` to allow chaining, except the final executor.
 */
export function createMockDbChain(): MockDbChain {
  const chain: any = {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    from: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    offset: jest.fn(),
    values: jest.fn(),
    set: jest.fn(),
    onConflictDoUpdate: jest.fn(),
    onConflictDoNothing: jest.fn(),
    returning: jest.fn(),
    leftJoin: jest.fn(),
    groupBy: jest.fn(),
  };

  // Make methods chainable by default
  Object.keys(chain).forEach((key) => {
    chain[key].mockReturnThis = () => {
      chain[key].mockReturnValue(chain);
      return chain;
    };
    // Default: return self for chaining
    chain[key].mockReturnValue(chain);
  });

  return chain as MockDbChain;
}

/**
 * Creates mock relational query API (db.query.*)
 */
export function createMockDbQuery(): MockDbQuery {
  return {
    topics: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    articles: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    scoreHistory: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    topicKeywords: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    auditLogs: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    trackedKeywords: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    topicViews: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    scoreFeedback: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  };
}

/**
 * Global mock DB instance
 * Import this in test setup to configure mock behavior
 */
export const mockDb = {
  chain: createMockDbChain(),
  query: createMockDbQuery(),

  /**
   * Reset all mocks to initial state
   */
  reset() {
    // Clear existing mocks
    jest.clearAllMocks();

    // Reset all chain methods to return the chain itself
    Object.keys(this.chain).forEach((key) => {
      const method = (this.chain as any)[key];
      if (typeof method.mockReset === 'function') {
        method.mockReset();
        method.mockReturnValue(this.chain);
      }
    });

    // Reset all query methods
    Object.keys(this.query).forEach((table) => {
      (this.query as any)[table].findFirst.mockReset();
      (this.query as any)[table].findMany.mockReset();
    });

    // Remove custom then handler
    delete (this.chain as any).then;
  },

  /**
   * Configure SELECT query mock
   * @example mockDb.mockSelect([{ id: 1, name: "Test" }]);
   */
  mockSelect(returnValue: any) {
    // All intermediate methods return the chain for chaining
    this.chain.select.mockReturnValue(this.chain);
    this.chain.from.mockReturnValue(this.chain);
    this.chain.where.mockReturnValue(this.chain);
    this.chain.orderBy.mockReturnValue(this.chain);
    this.chain.leftJoin.mockReturnValue(this.chain);
    this.chain.groupBy.mockReturnValue(this.chain);

    // Terminal methods that execute the query return a Promise
    // These are called when the query is actually executed (no more chaining)
    this.chain.limit.mockResolvedValue(returnValue);
    this.chain.offset.mockResolvedValue(returnValue);

    // The chain object itself is thenable, so if someone awaits the chain directly
    // without calling limit/offset, it should resolve
    (this.chain as any).then = function(resolve: any) {
      return Promise.resolve(returnValue).then(resolve);
    };
  },

  /**
   * Configure INSERT query mock
   * @example mockDb.mockInsert({ id: 1 });
   */
  mockInsert(returnValue: any) {
    this.chain.insert.mockReturnValue(this.chain);
    this.chain.values.mockReturnValue(this.chain);
    this.chain.onConflictDoUpdate.mockReturnValue(this.chain);
    this.chain.onConflictDoNothing.mockReturnValue(this.chain);

    // Terminal methods that execute the query
    this.chain.returning.mockResolvedValue(returnValue);

    // The chain object itself is thenable for awaiting
    (this.chain as any).then = function(resolve: any) {
      return Promise.resolve(returnValue).then(resolve);
    };
  },

  /**
   * Configure UPDATE query mock
   * @example mockDb.mockUpdate([{ id: 1, name: "Updated" }]);
   */
  mockUpdate(returnValue: any) {
    this.chain.update.mockReturnValue(this.chain);
    this.chain.set.mockReturnValue(this.chain);
    this.chain.where.mockReturnValue(this.chain);
    this.chain.returning.mockReturnValue(this.chain);

    // Make the chain thenable for UPDATE queries
    (this.chain as any).then = function(resolve: any) {
      return Promise.resolve(returnValue).then(resolve);
    };
  },

  /**
   * Configure DELETE query mock
   * @example mockDb.mockDelete([{ id: 1 }]);
   */
  mockDelete(returnValue: any) {
    this.chain.delete.mockReturnValue(this.chain);
    this.chain.where.mockReturnValue(this.chain);
    this.chain.returning.mockReturnValue(this.chain);

    // Make the chain thenable for DELETE queries
    (this.chain as any).then = function(resolve: any) {
      return Promise.resolve(returnValue).then(resolve);
    };
  },

  /**
   * Configure relational query mock (findFirst)
   * @example mockDb.mockFindFirst('topics', { id: 1, name: "Test", articles: [] });
   */
  mockFindFirst(table: keyof MockDbQuery, returnValue: any) {
    this.query[table].findFirst.mockResolvedValue(returnValue);
  },

  /**
   * Configure relational query mock (findMany)
   * @example mockDb.mockFindMany('topics', [{ id: 1 }, { id: 2 }]);
   */
  mockFindMany(table: keyof MockDbQuery, returnValue: any) {
    this.query[table].findMany.mockResolvedValue(returnValue);
  },
};

/**
 * Use this in jest.mock("@/db") to replace the real db
 *
 * @example
 * ```typescript
 * jest.mock("@/db", () => ({
 *   db: mockDbInstance,
 *   pool: { end: jest.fn() }
 * }));
 * ```
 */
export const mockDbInstance = new Proxy(mockDb.chain, {
  get(target, prop) {
    if (prop === "query") {
      return mockDb.query;
    }
    return target[prop as keyof MockDbChain];
  },
});
