import * as R from "ramda";
import * as PouchDB from "pouchdb";
import uuid from "uuid/v4";
import { getView, getViewDocID } from "./validation";
import {
  SpecFunction,
  Doc,
  DocHandle,
  DocID,
  Path,
  ListQuery,
  PathHandle
} from "./types";

/**
 * Creates a {@link PathHandle} to work with documents at the root path (empty array).
 * Example:
 *
 * ```typescript
 * const root = DS.useRoot(db, PostSpec);
 *
 * await root
 *   .then(_ => _.create())
 *   .then(_ => _.path.reply())
 *   .then(_ => _.create());
 *
 * const list = await root.then(_ => _.list());
 *
 * const replyList = await root
 *   .then(_ => _.find())
 *   .then(_ => _ && _.path.reply())
 *   .then(_ => _ && _.list());
 * ```
 *
 */
export async function useRoot<T>(
  db: PouchDB.Database,
  spec: SpecFunction<T>
): Promise<PathHandle<T>> {
  return usePathHandle<T>(db, spec, []);
}

/**
 * Creates a {@link PathHandle} to work with documents at the given path.
 */
export async function usePathHandle<T>(
  db: PouchDB.Database,
  spec: SpecFunction<T>,
  path: Path
): Promise<PathHandle<T>> {
  try {
    await db.get(getViewDocID(spec));
  } catch (_) {
    throw new Error(`Cannot find document type: ${spec().type}.`);
  }

  const originDB = await getDBName(db);

  async function create() {
    const doc = {
      _id: uuid(),
      originDB,
      path,
      type: spec().type
    };

    await db.put(doc);

    return useDocHandle(db, spec, doc._id);
  }

  async function list(query?) {
    return getMany(db, spec, path, query);
  }

  async function find(id?) {
    if (id) {
      return useDocHandle(db, spec, id);
    }

    return (await list({ skip: 0, take: 1 }))[0];
  }

  async function selector() {
    return getPathSelector<T>(db, spec, path);
  }

  return {
    db,
    spec,
    path,
    selector,
    create,
    list,
    find
  };
}

/**
 * Creates a {@link DocHandle} to work with single document.
 */
export async function useDocHandle<T>(
  db: PouchDB.Database,
  spec: SpecFunction<T>,
  docID: DocID
): Promise<DocHandle<T>> {
  try {
    await db.get(getViewDocID(spec));
  } catch (_) {
    throw new Error(`Cannot find document type: ${spec().type}.`);
  }

  try {
    await db.get(docID);
  } catch (_) {
    throw new Error(`No document has _id set to '${docID}'.`);
  }

  const path = R.fromPairs(
    R.toPairs(spec().schema)
      .filter(([key, schema]) => !!schema.spec)
      .map(([key, schema]) => [
        key,
        async () => {
          const doc = await resolve();

          return usePathHandle(db, schema.spec, [
            ...(doc.path || []),
            `${doc._id}:${key}`
          ]);
        }
      ])
  );

  async function resolve() {
    return (await db.get(docID)) as Doc<T>;
  }

  async function mutate(mutator) {
    const doc = await resolve();
    const { _id } = doc;
    const newContent = await mutator(doc.content);

    if (newContent) {
      R.toPairs(spec().schema).forEach(([key, schema]) => {
        if (!!schema.spec) {
          delete newContent[key];
        }
      });
    }

    await db.put(R.assoc("content", newContent, doc));
  }

  return {
    db,
    spec,
    docID,
    path,
    resolve,
    mutate
  };
}

/**
 * Returns the database name of the given PouchDB database.
 * Throws an error if the database is not reachable.
 */
export async function getDBName(db: PouchDB.Database): Promise<string> {
  const dbInfo = await db.info();

  if (!dbInfo.db_name) {
    throw new Error("Cannot get database name from PouchDB");
  }

  return dbInfo.db_name;
}

/**
 * Returns a [mango query](https://pouchdb.com/guides/mango-queries.html)
 * that filters all documents that match the given ${@link SpecFunction},
 * are nested under the given path, and originate from the . This is helpful for
 * [filtered replication](https://pouchdb.com/api.html#filtered-replication)
 */
export async function getPathSelector<T>(
  db: PouchDB.Database,
  spec: SpecFunction<T>,
  path: Path
): Promise<PouchDB.Find.Selector> {
  async function traverse(spec, state = { filter: [], visited: [] }) {
    if (!spec || state.visited.includes(spec().type)) {
      return state;
    }

    state.filter.push({ type: spec().type });
    state.visited.push(spec().type);

    R.toPairs(spec().schema).forEach(([key, schema]) =>
      traverse(schema.spec, state)
    );

    return state;
  }

  const filterPath = path || [];
  const traversalState = await traverse(spec);

  return {
    originDB: await getDBName(db),
    $or: traversalState.filter,
    path: [{ $gte: [...filterPath, ""] }, { $lte: [...filterPath, "\ufff0"] }]
  };
}

/** @private */
async function getMany<T>(
  db: PouchDB.Database,
  spec: SpecFunction<T>,
  path: Path,
  query?: ListQuery
): Promise<DocHandle<T>[]> {
  const result = await db.query(getView(spec), {
    startkey: [path, ""],
    endkey: [path, "\ufff0"],
    skip: query && query.skip,
    limit: query && query.take
  });

  return Promise.all(result.rows.map(row => useDocHandle<T>(db, spec, row.id)));
}
