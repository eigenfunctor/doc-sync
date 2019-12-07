import * as R from "ramda";
import uuid from "uuid/v4";
import {
  Validation,
  ValidationLib,
  ValidationSchema,
  ValidationSpec
} from "./types";

export async function defineSpec<T>(
  db: PouchDB.Database,
  spec: () => ValidationSpec<T>
): Promise<void> {
  const validationDDoc = {
    _id: getValidationDocID(spec),
    validate_doc_update: createValidator(spec)
  };

  const filterDDoc = {
    _id: getFilterDocID(spec),
    filters: {
      _: `
        function (doc, req) {
          return doc.namespace === '${spec().type}') {
        }
      `
    }
  };

  await db.put(validationDDoc);
  await db.put(filterDDoc);
}

export function createValidator<T>(spec: () => ValidationSpec<T>): string {
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

      ${genValidationsFromSpec(spec)}

      if (errors.length > 0) {
        throw new Error({ forbidden: JSON.stringify(errors) });
      }
    }
  `;

  function genValidationsFromSpec(spec: () => ValidationSpec<T>): string {
    function reducer(code, [key, schema]) {
      return `
        ${code}

        if ((${schema.required} && !newDoc[key]) {
          errors.push("'${key}' is a required field");
        }

        ${genValidations(key, schema.validations || [])}
      `;
    }

    return R.toPairs(spec).reduce(reducer, "");
  }

  function genValidations(key: string, validations: Validation<T>[]): string {
    function reducer(code, validation, index) {
      const name = `${key}_validation${index}`;

      return `
        ${code}

        var ${name} = ${validation.toString()};

        if('${spec().type}' === newDoc.type) {
          ${name}(lib, newDoc.content['${key}'])
        }
      `;
    }

    return validations.reduce(reducer, "");
  }

  return validator;
}

export function getFilterDocID<T>(spec: () => ValidationSpec<T>): string {
  return `_design/filter_${spec().type}`;
}

export function getFilterID<T>(spec: () => ValidationSpec<T>): string {
  return `filter_${spec().type}/_`;
}

export function getValidationDocID<T>(spec: () => ValidationSpec<T>): string {
  return `_design/validate_${spec().type}`;
}
