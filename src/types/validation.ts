/**
 * Data specifications are functions that return a {@link ValidationSpec}
 */
export type SpecFunction<T> = () => ValidationSpec<T>;

/**
 * A {@link ValidationSpec} keeps track of a type name and a schema.
 */
export interface ValidationSpec<T> {
  type: string;
  schema: ValidationSchema<T>;
}

/**
 * A {@link ValidationSchema} Determines how record fields should validate
 * its associated data type.
 */
export type ValidationSchema<T> = {
  readonly [K in keyof T]?: {
    /**
     * Reference to another data specification ({@link SpecFunction})
     */
    spec?: SpecFunction<T>;
    /**
     * Whether or not the field is required.
     */
    required?: boolean;
    /**
     * A list of {@link Validation} elements to run inside pouchdb or couchdb validation updates.
     */
    validations?: Validation<T[K]>[];
  };
};

/**
 * A {@link Validation} is a function that takes a validation library and a documents content as input, and throws
 * a couchDB validation error object.
 * Example:
 *
 * ```typescript
 * interface Post {
 *   body: string;
 *   reply: Post;
 * }
 *
 * function PostSpec(): DS.ValidationSpec<Post> {
 *   return {
 *     type: "post",
 *     schema: {
 *       body: {
 *         required: true,
 *         validations: [
 *           (lib, body) =>
 *             lib.failIf(
 *               body.length > 10,
 *               "Post must be at most 10 characters"
 *             )
 *         ]
 *       },
 *       reply: {
 *         spec: PostSpec
 *       }
 *     }
 *   };
 * }
 * ```
 *
 * NOTE: Validations cannot close over variables outside the function's scope as all scope
 * information is lost after function serialization.
 */
export type Validation<T> = (lib: ValidationLib, content: T[]) => void;

/**
 * Since validation functions are not allowed
 * to close over scope variables, {@link ValidationLib}
 * objects contain some helpers to use in validations.
 */
export interface ValidationLib {
  failIf(condition: boolean, message: string): void;
  JSON: typeof JSON;
  isArray(obj: object): boolean;
  log(message: string): void;
  sum(arr: number[]): number;
  toJSON(obj: object): string;
}
