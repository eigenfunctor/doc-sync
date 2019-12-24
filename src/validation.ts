import * as R from "ramda";
import uuid from "uuid/v4";
import {
  Path,
  Validation,
  ValidationLib,
  ValidationSchema,
  SpecFunction
} from "./types";

/**
 * Given a PouchDB database object and a list of {@link SpecFunction} elements,
 * calls {@link defineSpec} on each {@link SpecFunction} and then inserts an
 * update validation design document into the database that blocks any other document type
 * to be inserted into the database.
 * The following example with throw a validation error.
 *
 * ```typescript
 * defineOnly(db, PostSpec)
 *
 * await db.put({
 *   _id: "invalid-document",
 *   path: [],
 *   type: "non-existent"
 * })
 * ```
 */
export async function defineOnly<T>(db, ...specs: SpecFunction<T>[]) {
  let body = `
    var typeFound = false;
  `;

  for (let spec of specs) {
    await defineSpec(db, spec);

    body = `
      ${body}

      if (newDoc.type === '${spec().type}') {
        typeFound = true;
      }
    `;
  }

  const code = `function (newDoc, savedDoc, userCtx) {
      ${body}

      if (!typeFound) {
        throw({ forbidden: ["Cannot find document type: " + newDoc.type] });
      }
    }
  `;

  const validationDDoc = {
    _id: "_design/validate_allowed_doc_types",
    validate_doc_update: code
  };

  try {
    await db.put(validationDDoc);
  } catch (e) {
    console.warn("WARNING", e.message);
  }
}

/**
 * Given a PouchDB database object and a {@link SpecFunction},
 * {@link defineSpec} will insert an update validation design document
 * that runs specified validation functions on each inserted document
 * for defined specification type name.
 * NOTE:
 * if the `type` field of the document does not match the specified type name,
 * the validation does not fail. If you want to only allow a specific list of
 * document types see {@link defineOnly}.
 */
export async function defineSpec<T>(
  db: PouchDB.Database,
  spec: SpecFunction<T>
): Promise<void> {
  const validationDDoc = {
    _id: getValidationDocID(spec),
    validate_doc_update: createValidator(spec)
  };

  const viewGaurds = `
    if (!doc.type) {
      return;
    }

    if (doc.type !== '${spec().type}') {
      return;
    }
    
    if (!isArray(doc.path)) {
      return;
    }
  `;

  const viewDDoc = {
    _id: getViewDocID(spec),
    views: {
      ids: {
        map: `function (doc) {
            ${viewGaurds}

            emit([doc.path, doc._id], null);
          }
        `
      },
      docs: {
        map: `function (doc) {
            ${viewGaurds}

            emit([doc.path, doc._id], doc);
          }
        `
      }
    }
  };

  try {
    await db.put(validationDDoc);
  } catch (e) {
    console.warn("WARNING", e.message);
  }

  try {
    await db.put(viewDDoc);
  } catch (e) {
    console.warn("WARNING", e.message);
  }
}

/**
 * Get the design document id for the [view](https://docs.couchdb.org/en/2.3.1/ddocs/views/intro.html)
 * that lists all documents specified by the given
 * {@link SpecFunction} with paths as keys.
 */
export function getViewDocID<T>(spec: SpecFunction<T>): string {
  return `_design/view_${spec().type}`;
}

/**
 * Gets the [view](https://docs.couchdb.org/en/2.3.1/ddocs/views/intro.html) path
 * that can be used by [PouchDB query api](https://pouchdb.com/guides/queries.html)
 */
export function getView<T>(
  spec: SpecFunction<T>,
  include_docs?: boolean
): string {
  return `view_${spec().type}/${include_docs ? "docs" : "ids"}`;
}

/**
 * Get the design document id for the
 * [update validation](https://docs.couchdb.org/en/stable/ddocs/ddocs.html#validate-document-update-functions)
 * for the given {@link SpecFunction}.
 */
export function getValidationDocID<T>(spec: SpecFunction<T>): string {
  return `_design/validate_${spec().type}`;
}

function createValidator<T>(spec: SpecFunction<T>): string {
  const validator = `function (newDoc, savedDoc, userCtx) {
      var errors = [];

      var failIf = function (condition, message) {
        if (condition) {
          errors.push(message);
        }
      }
      
      var lib = {
        failIf: failIf,
        JSON: JSON,
        isArray: isArray,
        log: log,
        sum: sum,
        toJSON: toJSON
      }

      if (!!newDoc.content) {
        ${genValidationsFromSpec(spec)}
      }

      if (errors.length > 0) {
        throw({ forbidden: errors });
      }
    }
  `;

  function genValidationsFromSpec(spec: SpecFunction<T>): string {
    function reducer(code, [key, schema]) {
      const isReference = !!schema.spec || false;

      const isRequired = !schema.spec && !!schema.required;

      return `
        ${code}

        if (${isReference} && !!newDoc.content['${key}']) {
          errors.push("doc.content['${key}'] is a reference field, not an attribute field.");
        }

        if (${isRequired} && !newDoc.content['${key}']) {
          errors.push("doc.content['${key}'] is a required field.");
        }

        ${genValidations(key, schema.validations || [])}
      `;
    }

    return R.toPairs(spec().schema).reduce(reducer, "");
  }

  function genValidations(key: string, validations: Validation<T>[]): string {
    function reducer(code, validation, index) {
      const name = `${key}_validation_${index}`;

      return `
        ${code}

        var ${name} = ${validation.toString()};

        if ('${spec().type}' === newDoc.type) {
          ${name}(lib, newDoc.content['${key}']);
        }
      `;
    }

    return validations.reduce(reducer, "");
  }

  return validator;
}
