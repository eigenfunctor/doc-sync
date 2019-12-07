export interface ValidationLib {
  failIf(condition: boolean, message: string): void;
  JSON: typeof JSON;
  isArray(obj: object): boolean;
  log(message: string): void;
  sum(arr: number[]): number;
  toJSON(obj: object): string;
}

/* NOTE: Validations cannot close over variables outside the function's scope as all scope
 * information is lost after function serialization.
 */
export type Validation<T> = (lib: ValidationLib, content: T[]) => void;

export interface ValidationSpec<T> {
  type: string;
  schema: ValidationSchema<T>;
}

export type ValidationSchema<T> = {
  readonly [K in keyof T]?: {
    spec?: () => ValidationSpec<T[K]>;
    required?: boolean;
    validations?: Validation<T[K]>[];
  };
};
