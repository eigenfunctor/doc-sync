import * as PouchDB from "pouchdb";
import { SpecFunction } from "./validation";

export type DocID = string;

export interface Doc<T> {
  _id: DocID;
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
  readonly path: {
    [K in keyof T]?: () => Promise<PathHandle<T[K]>>;
  };
  resolve(): Promise<Doc<T>>;
  mutate(mutator: (content?: Partial<T>) => Partial<T> | void): Promise<void>;
}

export interface PathHandle<T> {
  readonly db: PouchDB.Database;
  readonly spec: SpecFunction<T>;
  readonly path: Path;
  create(): Promise<DocHandle<T>>;
  list(query?: ListQuery): Promise<DocHandle<T>[]>;
  find(id?: DocID): Promise<DocHandle<T> | void>;
}
