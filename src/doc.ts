import * as R from "ramda";
import * as PouchDB from "pouchdb";
import uuid from "uuid/v5";
import { createValidator } from "./validation";
import { hasNamespaceFilter } from "./util";
import {
  ValidationSpec,
  Doc,
  DocHandle,
  DocID,
  Path,
  PathHandle
} from "./types";

export async function useDocHandle<T>(
  db: PouchDB.Database,
  spec: () => ValidationSpec<T>,
  id: DocID
): Promise<DocHandle<T>> {
  return;
}

export async function usePathHandle<T>(
  db: PouchDB.Database,
  spec: () => ValidationSpec<T>,
  path: Path
): Promise<PathHandle<T>> {
  return;
}
