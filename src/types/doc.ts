import * as PouchDB from "pouchdb";
import { SpecFunction } from "./validation";

export type DocID = string;

export interface Doc<T> {
  _id: DocID;
  originDB: string;
  path: Path;
  type: string;
  content?: Partial<T>;
}

export type Path = string[];

export interface ListQuery {
  skip?: number;
  take?: number;
}

export interface DocHandle<T> {
  readonly db: PouchDB.Database;
  readonly spec: SpecFunction<T>;
  readonly docID: string;
  /**
   * If a document field's {@link ValidationSchema} has a {@link SpecFunction},
   * `path[key]` offers a function to acquire a @{@link PathHandle} to all associated documents
   * for the document field's key.
   * Example:
   * ```typescript
   * const root = DS.useRoot(db, PostSpec);
   *
   * const repliesHandle = await root
   *   .then(_ => _.create())
   *   .then(_ => _.path.reply())
   * ```
   */
  readonly path: {
    [K in keyof T]?: () => Promise<PathHandle<T[K]>>;
  };
  /**
   * `resolve()` will read the handling document out from the pouchDB database handle.
   */
  resolve(): Promise<Doc<T>>;
  /**
   * `mutate(mutator)` will update the handling document given some content transformation function.
   */
  mutate(mutator: (content?: Partial<T>) => Partial<T> | void): Promise<void>;
}

export interface PathHandle<T> {
  readonly db: PouchDB.Database;
  readonly spec: SpecFunction<T>;
  readonly path: Path;
  /**
   * `selector()` will return the [mango query](https://pouchdb.com/guides/mango-queries.html)
   * to filter every document under this {@link PathHandle}'s path
   * with all documents originating from the database under this
   * {@link PathHandle}.
   */
  selector(): Promise<PouchDB.Find.Selector>;
  /**
   * `create()` will add a new document under the {@link PathHandle}'s path,
   *  and then yield its document handle.`
   */
  create(): Promise<DocHandle<T>>;
  /**
   * `list()` will yield a paginated list of document handles to the collection of documents
   * under the {@link PathHandles}'s path
   */
  list(query?: ListQuery): Promise<DocHandle<T>[]>;
  /**
   * `find(id?)` will yield a ducment handle to the document with the specified ID,
   * or the first document handle that comes from `list()`
   */
  find(id?: DocID): Promise<DocHandle<T> | void>;
}
