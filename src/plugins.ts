import * as PouchDB from "pouchdb";
import PouchDBFind = require("pouchdb-find");
import PouchDBValidation = require("pouchdb-validation");
import PouchDBMemory = require("pouchdb-adapter-memory");

/**
 * Adds all required pouchdb plugins used by this library to the locally imported PouchDB module.
 * Example:
 *
 * ```typescript
 * var PouchDB = require("pouchdb");
 *
 * setupPlugins(PouchDB);
 * ```
 *
 */
export function setupPlugins(PouchDB: any) {
  PouchDB.plugin(PouchDBFind);
  PouchDB.plugin(PouchDBValidation);
  PouchDB.plugin(PouchDBMemory);
}
