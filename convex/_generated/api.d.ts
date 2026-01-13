/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as lib_cascadeDelete from "../lib/cascadeDelete.js";
import type * as lib_constants from "../lib/constants.js";
import type * as lib_types from "../lib/types.js";
import type * as lib_urlValidation from "../lib/urlValidation.js";
import type * as maps from "../maps.js";
import type * as teams from "../teams.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "lib/cascadeDelete": typeof lib_cascadeDelete;
  "lib/constants": typeof lib_constants;
  "lib/types": typeof lib_types;
  "lib/urlValidation": typeof lib_urlValidation;
  maps: typeof maps;
  teams: typeof teams;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
