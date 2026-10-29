// Gerado. Não editar.
import createClient from "openapi-fetch";
import type { paths } from "./schema";
export const createGeneratedClient = (baseUrl: string, fetcher: typeof fetch) => createClient<paths>({ baseUrl, fetch: fetcher });
