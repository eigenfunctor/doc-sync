import * as DS from "../../src";
import uuid from "uuid/v4";
import Validation = require("pouchdb-validation");

import PouchDB = require("pouchdb");
DS.setupPlugins(PouchDB);

export interface DBRefs {
  db?: PouchDB.Database;
}

export function createLocalDB(): DBRefs {
  const refs = { db: null };

  beforeAll(() => {
    refs.db = new PouchDB(`test-${uuid()}`, { adapter: "memory" });

    // @ts-ignore
    refs.db.installValidationMethods();
  });

  afterAll(() => {
    refs.db && refs.db.destroy();
  });

  return refs;
}
