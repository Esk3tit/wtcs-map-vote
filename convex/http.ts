/**
 * HTTP Routes
 *
 * HTTP router for auth callback routes and other HTTP endpoints.
 */
import { httpRouter } from "convex/server";

import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

export default http;
