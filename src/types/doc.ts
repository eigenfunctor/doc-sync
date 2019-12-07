import * as PouchDB from "pouchdb";
import { ValidationSpec } from "./validation";

export type DocID = string;

export interface Doc<T> {
  _id: DocID;
  type: string;
  content: T;
}

export type Path = string[];

export interface DocHandle<T> {
  readonly db: PouchDB.Database;
  readonly spec: () => ValidationSpec<T>;
  readonly docID: string;
  readonly one: {
    [K in keyof T]?: (id?: DocID) => Promise<Doc<T[K]>>;
  };
  readonly path: {
    [K in keyof T]?: () => Promise<PathHandle<T[K]>>;
  };
  resolve(): Promise<Doc<T>>;
  mutate(doc: Doc<T>): Promise<void>;
}

export interface ListQuery {
  skip?: number;
  take?: number;
  find?: PouchDB.Find.FindRequest<any>;
}

export interface PathHandle<T> {
  readonly db: PouchDB.Database;
  readonly spec: () => ValidationSpec<T>;
  readonly path: Path;
  one(id?: DocID): Promise<DocHandle<T>>;
  list(query: ListQuery): Promise<DocHandle<T>[]>;
}
