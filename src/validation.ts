import * as R from "ramda";
import uuid from "uuid/v4";
import {
  Path,
  Validation,
  ValidationLib,
  ValidationSchema,
  ValidationSpec
} from "./types";

export async function defineOnly<T>(db, ...specs: (() => ValidationSpec<T>)[]) {
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

  const code = `
    function (newDoc, savedDoc, userCtx) {
      ${body}

      return typeFound
    }
  `;

  const validationDDoc = {
    _id: "design/validate_allowed_doc_types",
    validate_doc_update: code
  };

  try {
    await db.put(validationDDoc);
  } catch (e) {
    console.warn(e);
  }
}

export async function defineSpec<T>(
  db: PouchDB.Database,
  spec: () => ValidationSpec<T>
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
        map: `
          function (doc) {
            ${viewGaurds}

            emit([doc.path, doc._id], null);
          }
        `
      },
      docs: {
        map: `
          function (doc) {
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
    console.warn(e);
  }

  try {
    await db.put(viewDDoc);
  } catch (e) {
    console.warn(e);
  }
}

export function getViewDocID<T>(spec: () => ValidationSpec<T>): string {
  return `_design/view_${spec().type}`;
}

export function getView<T>(
  spec: () => ValidationSpec<T>,
  include_docs?: boolean
): string {
  return `view_${spec().type}/${include_docs ? "docs" : "ids"}`;
}

export function getValidationDocID<T>(spec: () => ValidationSpec<T>): string {
  return `_design/validate_${spec().type}`;
}

function createValidator<T>(spec: () => ValidationSpec<T>): string {
  const validator = `
    function (newDoc, savedDoc, userCtx) {
      var errors = [];

      var failIf = function(condition, message) {
        if (condition) {
          errors.push(message);
        }
      }
      
      var lib = {
        failIf: failIf,
        JSON: JSON;
        isArray: isArray;
        log: log;
        sum: sum;
        toJSON: toJSON;
      }

      if (!!newDoc.content) {
        ${genValidationsFromSpec(spec)}
      }

      if (errors.length > 0) {
        throw new Error({ forbidden: JSON.stringify(errors) });
      }
    }
  `;

  function genValidationsFromSpec(spec: () => ValidationSpec<T>): string {
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
          ${name}(lib, newDoc.content['${key}'])
        }
      `;
    }

    return validations.reduce(reducer, "");
  }

  return validator;
}
