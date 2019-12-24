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
 * Creates a {@link PathHandle} to work with documents at the root (path = []) of the heirarchy.
 * Example:
 * ```
 * const root = DS.useRoot(refs.db, PostSpec);
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

  async function create() {
    const doc = {
      _id: uuid(),
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

  return {
    db,
    spec,
    path,
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
 * Returns a [mango query](https://pouchdb.com/guides/mango-queries.html)
 * that filters all documents nested under the given path. This is helpful
 * for [filtered replication](https://pouchdb.com/api.html#filtered-replication)
 */
export function getPathFilter<T>(
  spec: SpecFunction<T>,
  path: Path
): PouchDB.Find.Selector {
  let filterPath = path || [];

  return {
    type: { $eq: spec().type },
    path: [{ $gte: [...filterPath, ""] }, { $lte: [...filterPath, "\ufff0"] }]
  };
}

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
