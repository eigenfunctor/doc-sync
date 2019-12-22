import * as PouchDB from "pouchdb";
import PouchDBFind = require("pouchdb-find");
import PouchDBValidation = require("pouchdb-validation");
import PouchDBMemory = require("pouchdb-adapter-memory");

export function setupPlugins(PouchDB: any) {
  PouchDB.plugin(PouchDBFind);
  PouchDB.plugin(PouchDBValidation);
  PouchDB.plugin(PouchDBMemory);
}
