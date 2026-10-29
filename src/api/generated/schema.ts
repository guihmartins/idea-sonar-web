// Gerado pelo snapshot identificado em contracts/source.json. Não editar.
export interface paths {
    "/health/live": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Processo disponível */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @enum {string} */
                            status: "ok";
                        };
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/catalog": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Catálogos do domínio */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Catalog"];
                    };
                };
                /** @description Token ausente ou inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Proprietário ou scope não autorizado */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Identidade autorizada */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Identity"];
                    };
                };
                /** @description Token ausente ou inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Proprietário ou scope não autorizado */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/nodes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    q?: string;
                    kind?: "person" | "tradition" | "concept" | "work";
                    nodeId?: string;
                    contextId?: string;
                    type?: string;
                    includePending?: "true" | "false";
                    startYear?: number | null;
                    endYear?: number | null;
                    includeUnknownPeriod?: "true" | "false";
                    cursor?: string;
                    limit?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Operação concluída */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            items: components["schemas"]["NodeDetail"][];
                            nextCursor: string | null;
                        };
                    };
                };
                /** @description Erro estruturado */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                428: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: {
                    "idempotency-key"?: string;
                };
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["NodeInput"];
                };
            };
            responses: {
                /** @description Operação concluída */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["NodeDetail"];
                    };
                };
                /** @description Erro estruturado */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                428: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/nodes/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Operação concluída */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["NodeDetail"];
                    };
                };
                /** @description Erro estruturado */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                428: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: {
            parameters: {
                query?: never;
                header?: {
                    "if-match"?: string;
                };
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @enum {string} */
                        kind?: "person" | "tradition" | "concept" | "work";
                        label?: string;
                        description?: string;
                        /** @enum {string|null} */
                        conceptScope?: "broad" | "contextual" | null;
                        aliases?: {
                            alias: string;
                            language: string;
                        }[];
                        contexts?: string[];
                        /** @enum {string} */
                        status?: "active" | "pending" | "archived";
                    };
                };
            };
            responses: {
                /** @description Operação concluída */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["NodeDetail"];
                    };
                };
                /** @description Erro estruturado */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                428: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/contexts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    q?: string;
                    kind?: "person" | "tradition" | "concept" | "work";
                    nodeId?: string;
                    contextId?: string;
                    type?: string;
                    includePending?: "true" | "false";
                    startYear?: number | null;
                    endYear?: number | null;
                    includeUnknownPeriod?: "true" | "false";
                    cursor?: string;
                    limit?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Operação concluída */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            items: components["schemas"]["ContextDetail"][];
                            nextCursor: string | null;
                        };
                    };
                };
                /** @description Erro estruturado */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                428: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: {
                    "idempotency-key"?: string;
                };
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["ContextInput"];
                };
            };
            responses: {
                /** @description Operação concluída */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ContextDetail"];
                    };
                };
                /** @description Erro estruturado */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                428: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/contexts/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Operação concluída */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ContextDetail"];
                    };
                };
                /** @description Erro estruturado */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                428: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: {
            parameters: {
                query?: never;
                header?: {
                    "if-match"?: string;
                };
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @enum {string} */
                        status?: "active" | "pending" | "archived";
                        label?: string;
                        /** Format: uuid */
                        traditionNodeId?: string | null;
                        startYear?: number | null;
                        endYear?: number | null;
                        /** @enum {string} */
                        precision?: "unknown" | "approximate" | "range" | "exact";
                        periodLabel?: string | null;
                        regionLabel?: string | null;
                        notes?: string | null;
                    };
                };
            };
            responses: {
                /** @description Operação concluída */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ContextDetail"];
                    };
                };
                /** @description Erro estruturado */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                428: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/sources": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    q?: string;
                    kind?: "person" | "tradition" | "concept" | "work";
                    nodeId?: string;
                    contextId?: string;
                    type?: string;
                    includePending?: "true" | "false";
                    startYear?: number | null;
                    endYear?: number | null;
                    includeUnknownPeriod?: "true" | "false";
                    cursor?: string;
                    limit?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Operação concluída */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            items: components["schemas"]["SourceDetail"][];
                            nextCursor: string | null;
                        };
                    };
                };
                /** @description Erro estruturado */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                428: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: {
                    "idempotency-key"?: string;
                };
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["SourceInput"];
                };
            };
            responses: {
                /** @description Operação concluída */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SourceDetail"];
                    };
                };
                /** @description Erro estruturado */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                428: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/sources/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Operação concluída */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SourceDetail"];
                    };
                };
                /** @description Erro estruturado */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                428: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: {
            parameters: {
                query?: never;
                header?: {
                    "if-match"?: string;
                };
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @enum {string} */
                        status?: "active" | "pending" | "archived";
                        /** Format: uuid */
                        workNodeId?: string | null;
                        title?: string;
                        authorText?: string;
                        /** Format: uri */
                        canonicalUrl?: string | null;
                        publicationLabel?: string | null;
                        doi?: string | null;
                        /** Format: date-time */
                        accessedAt?: string | null;
                        notes?: string | null;
                    };
                };
            };
            responses: {
                /** @description Operação concluída */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SourceDetail"];
                    };
                };
                /** @description Erro estruturado */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                428: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/relations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    q?: string;
                    kind?: "person" | "tradition" | "concept" | "work";
                    nodeId?: string;
                    contextId?: string;
                    type?: string;
                    includePending?: "true" | "false";
                    startYear?: number | null;
                    endYear?: number | null;
                    includeUnknownPeriod?: "true" | "false";
                    cursor?: string;
                    limit?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Operação concluída */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            items: components["schemas"]["RelationDetail"][];
                            nextCursor: string | null;
                        };
                    };
                };
                /** @description Erro estruturado */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                428: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: {
                    "idempotency-key"?: string;
                };
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["RelationInput"];
                };
            };
            responses: {
                /** @description Operação concluída */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RelationDetail"];
                    };
                };
                /** @description Erro estruturado */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                428: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/relations/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Operação concluída */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RelationDetail"];
                    };
                };
                /** @description Erro estruturado */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                428: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: {
            parameters: {
                query?: never;
                header?: {
                    "if-match"?: string;
                };
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** Format: uuid */
                        sourceId?: string;
                        /** Format: uuid */
                        targetId?: string;
                        /** @enum {string} */
                        type?: "influenced" | "formulated" | "developed" | "studied" | "used" | "adhered_to" | "transmitted" | "reinterpreted" | "incorporated_from" | "criticized" | "part_of" | "type_of" | "contextualizes" | "appears_in" | "parallel_to" | "differs_from";
                        /** Format: uuid */
                        contextId?: string | null;
                        claim?: string;
                        justification?: string;
                        /** @enum {string} */
                        evidenceStatus?: "documented" | "attributed_interpretation" | "inference";
                        intensity?: number | null;
                        intensityReason?: string | null;
                        /** Format: uuid */
                        attributionNodeId?: string | null;
                        attributionText?: string | null;
                        inferenceAuthor?: string | null;
                        contested?: boolean;
                        contestationNote?: string | null;
                        /** @enum {string} */
                        status?: "active" | "pending" | "archived";
                        evidence?: {
                            /** Format: uuid */
                            sourceId?: string | null;
                            /** @enum {string} */
                            sourceKind: "primary" | "secondary" | "conversation" | "other";
                            /** @enum {string} */
                            stance: "supports" | "challenges" | "contextualizes";
                            locator: string;
                            excerpt?: string | null;
                            explanation: string;
                            conversationReference?: string | null;
                        }[];
                    };
                };
            };
            responses: {
                /** @description Operação concluída */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RelationDetail"];
                    };
                };
                /** @description Erro estruturado */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                428: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/views": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    q?: string;
                    kind?: "person" | "tradition" | "concept" | "work";
                    nodeId?: string;
                    contextId?: string;
                    type?: string;
                    includePending?: "true" | "false";
                    startYear?: number | null;
                    endYear?: number | null;
                    includeUnknownPeriod?: "true" | "false";
                    cursor?: string;
                    limit?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Operação concluída */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            items: components["schemas"]["ViewDetail"][];
                            nextCursor: string | null;
                        };
                    };
                };
                /** @description Erro estruturado */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                428: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: {
                    "idempotency-key"?: string;
                };
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["ViewInput"];
                };
            };
            responses: {
                /** @description Operação concluída */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ViewDetail"];
                    };
                };
                /** @description Erro estruturado */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                428: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/views/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Operação concluída */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ViewDetail"];
                    };
                };
                /** @description Erro estruturado */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                428: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: {
            parameters: {
                query?: never;
                header?: {
                    "if-match"?: string;
                };
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @enum {string} */
                        status?: "active" | "pending" | "archived";
                        name?: string;
                        /** Format: uuid */
                        rootNodeId?: string | null;
                        filters?: {
                            /** @enum {string} */
                            kind?: "person" | "tradition" | "concept" | "work";
                            type?: string;
                            includePending?: boolean;
                            /** Format: uuid */
                            contextId?: string;
                            startYear?: number;
                            endYear?: number;
                            includeUnknownPeriod?: boolean;
                        };
                        positions?: {
                            [key: string]: {
                                x: number;
                                y: number;
                            };
                        };
                        expandedNodes?: string[];
                        viewport?: {
                            zoom: number;
                            pan: {
                                x: number;
                                y: number;
                            };
                        };
                    };
                };
            };
            responses: {
                /** @description Operação concluída */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ViewDetail"];
                    };
                };
                /** @description Erro estruturado */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                428: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/nodes/{id}/neighbors": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    q?: string;
                    kind?: "person" | "tradition" | "concept" | "work";
                    nodeId?: string;
                    contextId?: string;
                    type?: string;
                    includePending?: "true" | "false";
                    startYear?: number | null;
                    endYear?: number | null;
                    includeUnknownPeriod?: "true" | "false";
                    cursor?: string;
                    limit?: number;
                };
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Operação concluída */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            nodes: components["schemas"]["NodeDetail"][];
                            relations: components["schemas"]["RelationDetail"][];
                            nextCursor: string | null;
                            truncated: boolean;
                        };
                    };
                };
                /** @description Erro estruturado */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                428: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/nodes/{id}/history": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    q?: string;
                    kind?: "person" | "tradition" | "concept" | "work";
                    nodeId?: string;
                    contextId?: string;
                    type?: string;
                    includePending?: "true" | "false";
                    startYear?: number | null;
                    endYear?: number | null;
                    includeUnknownPeriod?: "true" | "false";
                    cursor?: string;
                    limit?: number;
                };
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Operação concluída */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            items: {
                                [key: string]: unknown;
                            }[];
                            nextCursor: string | null;
                        };
                    };
                };
                /** @description Erro estruturado */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                428: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/relations/{id}/history": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    q?: string;
                    kind?: "person" | "tradition" | "concept" | "work";
                    nodeId?: string;
                    contextId?: string;
                    type?: string;
                    includePending?: "true" | "false";
                    startYear?: number | null;
                    endYear?: number | null;
                    includeUnknownPeriod?: "true" | "false";
                    cursor?: string;
                    limit?: number;
                };
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Operação concluída */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            items: {
                                [key: string]: unknown;
                            }[];
                            nextCursor: string | null;
                        };
                    };
                };
                /** @description Erro estruturado */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                428: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/imports": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    q?: string;
                    kind?: "person" | "tradition" | "concept" | "work";
                    nodeId?: string;
                    contextId?: string;
                    type?: string;
                    includePending?: "true" | "false";
                    startYear?: number | null;
                    endYear?: number | null;
                    includeUnknownPeriod?: "true" | "false";
                    cursor?: string;
                    limit?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Operação concluída */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            items: {
                                [key: string]: unknown;
                            }[];
                            nextCursor: string | null;
                        };
                    };
                };
                /** @description Erro estruturado */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                428: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: {
                    "idempotency-key"?: string;
                };
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["ImportBatchV1"];
                };
            };
            responses: {
                /** @description Operação concluída */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ImportResult"];
                    };
                };
                /** @description Erro estruturado */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                428: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/imports/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Operação concluída */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            [key: string]: unknown;
                        };
                    };
                };
                /** @description Erro estruturado */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                428: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/imports/{id}/undo": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                        reason: string;
                    };
                };
            };
            responses: {
                /** @description Operação concluída */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** Format: uuid */
                            batchId: string;
                            /** @enum {string} */
                            status: "undone";
                            reason: string;
                        };
                    };
                };
                /** @description Erro estruturado */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                428: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/pending": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    q?: string;
                    kind?: "person" | "tradition" | "concept" | "work";
                    nodeId?: string;
                    contextId?: string;
                    type?: string;
                    includePending?: "true" | "false";
                    startYear?: number | null;
                    endYear?: number | null;
                    includeUnknownPeriod?: "true" | "false";
                    cursor?: string;
                    limit?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Operação concluída */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            items: {
                                [key: string]: unknown;
                            }[];
                            nextCursor: string | null;
                        };
                    };
                };
                /** @description Erro estruturado */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                428: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/pending/{id}/resolve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                        reason: string;
                        selection: {
                            /** Format: uuid */
                            entityId: string;
                        } | {
                            /** @enum {string} */
                            entity: "nodes";
                            data: components["schemas"]["NodeInput"];
                        } | {
                            /** @enum {string} */
                            entity: "contexts";
                            data: components["schemas"]["ContextInput"];
                        } | {
                            /** @enum {string} */
                            entity: "sources";
                            data: components["schemas"]["SourceInput"];
                        } | {
                            /** @enum {string} */
                            entity: "relations";
                            data: components["schemas"]["RelationInput"];
                        } | {
                            /** @enum {string} */
                            entity: "views";
                            data: components["schemas"]["ViewInput"];
                        };
                    };
                };
            };
            responses: {
                /** @description Operação concluída */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** Format: uuid */
                            id: string;
                            /** Format: uuid */
                            entityId: string;
                            version: number;
                            reason: string;
                        };
                    };
                };
                /** @description Erro estruturado */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                428: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Operação concluída */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @enum {string} */
                            contractVersion: "1";
                            exportedAt: string;
                            nodes: components["schemas"]["NodeDetail"][];
                            contexts: components["schemas"]["ContextDetail"][];
                            sources: components["schemas"]["SourceDetail"][];
                            relations: components["schemas"]["RelationDetail"][];
                            views: components["schemas"]["ViewDetail"][];
                        };
                    };
                };
                /** @description Erro estruturado */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                428: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Erro estruturado */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        Catalog: {
            nodeKinds: ("person" | "tradition" | "concept" | "work")[];
            relationTypes: {
                code: string;
                label: string;
                inverseLabel: string;
                symmetric: boolean;
                allowedEndpoints: {
                    /** @enum {string} */
                    source: "person" | "tradition" | "concept" | "work";
                    /** @enum {string} */
                    target: "person" | "tradition" | "concept" | "work";
                }[];
            }[];
            evidenceStatuses: ("documented" | "attributed_interpretation" | "inference")[];
            editorialStatuses: ("active" | "pending" | "archived")[];
            intensities: {
                value: number | null;
                label: string;
            }[];
        };
        /**
         * @example {
         *       "error": {
         *         "code": "VALIDATION_ERROR",
         *         "message": "Dados inválidos",
         *         "details": [
         *           {
         *             "path": "relations.0.evidence",
         *             "message": "Fonte necessária"
         *           }
         *         ],
         *         "requestId": "00000000-0000-4000-8000-000000000000"
         *       }
         *     }
         */
        ApiError: {
            error: {
                code: string;
                message: string;
                details: {
                    path: string;
                    message: string;
                }[];
                requestId: string;
            };
        };
        Identity: {
            /** Format: uri */
            issuer: string;
            subject: string;
            scopes: string[];
        };
        NodeDetail: {
            /** @enum {string} */
            kind: "person" | "tradition" | "concept" | "work";
            label: string;
            description: string;
            /** @enum {string|null} */
            conceptScope?: "broad" | "contextual" | null;
            /** @default [] */
            aliases: {
                alias: string;
                language: string;
            }[];
            /** @default [] */
            contexts: string[];
            /**
             * @default active
             * @enum {string}
             */
            status: "active" | "pending" | "archived";
            /** Format: uuid */
            id: string;
            version: number;
            createdAt: string;
            updatedAt: string;
            degreeTotal: number;
            archivedAt: string | null;
        };
        NodeInput: {
            /** @enum {string} */
            kind: "person" | "tradition" | "concept" | "work";
            label: string;
            description: string;
            /** @enum {string|null} */
            conceptScope?: "broad" | "contextual" | null;
            /** @default [] */
            aliases: {
                alias: string;
                language: string;
            }[];
            /** @default [] */
            contexts: string[];
            /**
             * @default active
             * @enum {string}
             */
            status: "active" | "pending" | "archived";
        };
        ContextDetail: {
            /**
             * @default active
             * @enum {string}
             */
            status: "active" | "pending" | "archived";
            label: string;
            /** Format: uuid */
            traditionNodeId?: string | null;
            startYear?: number | null;
            endYear?: number | null;
            /**
             * @default unknown
             * @enum {string}
             */
            precision: "unknown" | "approximate" | "range" | "exact";
            periodLabel?: string | null;
            regionLabel?: string | null;
            notes?: string | null;
            /** Format: uuid */
            id: string;
            version: number;
            createdAt: string;
            updatedAt: string;
        };
        ContextInput: {
            /**
             * @default active
             * @enum {string}
             */
            status: "active" | "pending" | "archived";
            label: string;
            /** Format: uuid */
            traditionNodeId?: string | null;
            startYear?: number | null;
            endYear?: number | null;
            /**
             * @default unknown
             * @enum {string}
             */
            precision: "unknown" | "approximate" | "range" | "exact";
            periodLabel?: string | null;
            regionLabel?: string | null;
            notes?: string | null;
        };
        SourceDetail: {
            /**
             * @default active
             * @enum {string}
             */
            status: "active" | "pending" | "archived";
            /** Format: uuid */
            workNodeId?: string | null;
            title: string;
            authorText: string;
            /** Format: uri */
            canonicalUrl?: string | null;
            publicationLabel?: string | null;
            doi?: string | null;
            /** Format: date-time */
            accessedAt?: string | null;
            notes?: string | null;
            /** Format: uuid */
            id: string;
            version: number;
            createdAt: string;
            updatedAt: string;
        };
        SourceInput: {
            /**
             * @default active
             * @enum {string}
             */
            status: "active" | "pending" | "archived";
            /** Format: uuid */
            workNodeId?: string | null;
            title: string;
            authorText: string;
            /** Format: uri */
            canonicalUrl?: string | null;
            publicationLabel?: string | null;
            doi?: string | null;
            /** Format: date-time */
            accessedAt?: string | null;
            notes?: string | null;
        };
        RelationDetail: {
            /** Format: uuid */
            sourceId: string;
            /** Format: uuid */
            targetId: string;
            /** @enum {string} */
            type: "influenced" | "formulated" | "developed" | "studied" | "used" | "adhered_to" | "transmitted" | "reinterpreted" | "incorporated_from" | "criticized" | "part_of" | "type_of" | "contextualizes" | "appears_in" | "parallel_to" | "differs_from";
            /** Format: uuid */
            contextId?: string | null;
            claim: string;
            justification: string;
            /** @enum {string} */
            evidenceStatus: "documented" | "attributed_interpretation" | "inference";
            /** @default null */
            intensity: number | null;
            intensityReason?: string | null;
            /** Format: uuid */
            attributionNodeId?: string | null;
            attributionText?: string | null;
            inferenceAuthor?: string | null;
            /** @default false */
            contested: boolean;
            contestationNote?: string | null;
            /**
             * @default active
             * @enum {string}
             */
            status: "active" | "pending" | "archived";
            /** @default [] */
            evidence: {
                /** Format: uuid */
                sourceId?: string | null;
                /** @enum {string} */
                sourceKind: "primary" | "secondary" | "conversation" | "other";
                /** @enum {string} */
                stance: "supports" | "challenges" | "contextualizes";
                locator: string;
                excerpt?: string | null;
                explanation: string;
                conversationReference?: string | null;
            }[];
            /** Format: uuid */
            id: string;
            version: number;
            createdAt: string;
            updatedAt: string;
            archivedAt: string | null;
        };
        RelationInput: {
            /** Format: uuid */
            sourceId: string;
            /** Format: uuid */
            targetId: string;
            /** @enum {string} */
            type: "influenced" | "formulated" | "developed" | "studied" | "used" | "adhered_to" | "transmitted" | "reinterpreted" | "incorporated_from" | "criticized" | "part_of" | "type_of" | "contextualizes" | "appears_in" | "parallel_to" | "differs_from";
            /** Format: uuid */
            contextId?: string | null;
            claim: string;
            justification: string;
            /** @enum {string} */
            evidenceStatus: "documented" | "attributed_interpretation" | "inference";
            /** @default null */
            intensity: number | null;
            intensityReason?: string | null;
            /** Format: uuid */
            attributionNodeId?: string | null;
            attributionText?: string | null;
            inferenceAuthor?: string | null;
            /** @default false */
            contested: boolean;
            contestationNote?: string | null;
            /**
             * @default active
             * @enum {string}
             */
            status: "active" | "pending" | "archived";
            /** @default [] */
            evidence: {
                /** Format: uuid */
                sourceId?: string | null;
                /** @enum {string} */
                sourceKind: "primary" | "secondary" | "conversation" | "other";
                /** @enum {string} */
                stance: "supports" | "challenges" | "contextualizes";
                locator: string;
                excerpt?: string | null;
                explanation: string;
                conversationReference?: string | null;
            }[];
        };
        ViewDetail: components["schemas"]["ViewInput"] & {
            /** Format: uuid */
            id: string;
            version: number;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
        };
        ViewInput: {
            /**
             * @default active
             * @enum {string}
             */
            status: "active" | "pending" | "archived";
            name: string;
            /** Format: uuid */
            rootNodeId?: string | null;
            /** @default {} */
            filters: {
                /** @enum {string} */
                kind?: "person" | "tradition" | "concept" | "work";
                type?: string;
                includePending?: boolean;
                /** Format: uuid */
                contextId?: string;
                startYear?: number;
                endYear?: number;
                includeUnknownPeriod?: boolean;
            };
            /** @default {} */
            positions: {
                [key: string]: {
                    x: number;
                    y: number;
                };
            };
            /** @default [] */
            expandedNodes: string[];
            /**
             * @default {
             *       "zoom": 1,
             *       "pan": {
             *         "x": 0,
             *         "y": 0
             *       }
             *     }
             */
            viewport: {
                zoom: number;
                pan: {
                    x: number;
                    y: number;
                };
            };
        };
        ImportResult: {
            /** Format: uuid */
            batchId: string;
            /** @enum {string} */
            status: "committed" | "committed_with_pending";
            created: number;
            updated: number;
            reused: number;
            pending: number;
            clientRefToId: {
                [key: string]: string;
            };
            items: {
                clientRef: string;
                entityType: string;
                /** Format: uuid */
                entityId: string | null;
                /** @enum {string} */
                outcome: "created" | "updated" | "reused" | "pending";
                reason: string | null;
            }[];
            viewUrl: string | null;
            dryRun: boolean;
        };
        ImportBatchV1: {
            /** @enum {string} */
            contractVersion: "1";
            /** @enum {string} */
            policyVersion: "1";
            idempotencyKey: string;
            /** @enum {string} */
            origin: "chat" | "manual" | "local_classifier" | "seed";
            inputSummary: string;
            /** @default false */
            dryRun: boolean;
            /** @default [] */
            nodes: ({
                /** @enum {string} */
                kind: "person" | "tradition" | "concept" | "work";
                label: string;
                description: string;
                /** @enum {string|null} */
                conceptScope?: "broad" | "contextual" | null;
                /** @default [] */
                aliases: {
                    alias: string;
                    language: string;
                }[];
                /** @default [] */
                contexts: ({
                    /** Format: uuid */
                    id: string;
                } | {
                    clientRef: string;
                })[];
                /**
                 * @default active
                 * @enum {string}
                 */
                status: "active" | "pending" | "archived";
                clientRef: string;
                /** @enum {string} */
                op: "create";
            } | {
                /** @enum {string} */
                kind: "person" | "tradition" | "concept" | "work";
                label: string;
                description: string;
                /** @enum {string|null} */
                conceptScope?: "broad" | "contextual" | null;
                /** @default [] */
                aliases: {
                    alias: string;
                    language: string;
                }[];
                /** @default [] */
                contexts: ({
                    /** Format: uuid */
                    id: string;
                } | {
                    clientRef: string;
                })[];
                /**
                 * @default active
                 * @enum {string}
                 */
                status: "active" | "pending" | "archived";
                clientRef: string;
                /** @enum {string} */
                op: "update";
                /** Format: uuid */
                id: string;
                expectedVersion: number;
            } | {
                clientRef: string;
                /** @enum {string} */
                op: "reference";
                /** Format: uuid */
                id: string;
            })[];
            /** @default [] */
            contexts: ({
                /**
                 * @default active
                 * @enum {string}
                 */
                status: "active" | "pending" | "archived";
                label: string;
                traditionNodeId?: {
                    /** Format: uuid */
                    id: string;
                } | {
                    clientRef: string;
                } | null;
                startYear?: number | null;
                endYear?: number | null;
                /**
                 * @default unknown
                 * @enum {string}
                 */
                precision: "unknown" | "approximate" | "range" | "exact";
                periodLabel?: string | null;
                regionLabel?: string | null;
                notes?: string | null;
                clientRef: string;
                /** @enum {string} */
                op: "create";
            } | {
                /**
                 * @default active
                 * @enum {string}
                 */
                status: "active" | "pending" | "archived";
                label: string;
                traditionNodeId?: {
                    /** Format: uuid */
                    id: string;
                } | {
                    clientRef: string;
                } | null;
                startYear?: number | null;
                endYear?: number | null;
                /**
                 * @default unknown
                 * @enum {string}
                 */
                precision: "unknown" | "approximate" | "range" | "exact";
                periodLabel?: string | null;
                regionLabel?: string | null;
                notes?: string | null;
                clientRef: string;
                /** @enum {string} */
                op: "update";
                /** Format: uuid */
                id: string;
                expectedVersion: number;
            } | {
                clientRef: string;
                /** @enum {string} */
                op: "reference";
                /** Format: uuid */
                id: string;
            })[];
            /** @default [] */
            sources: ({
                /**
                 * @default active
                 * @enum {string}
                 */
                status: "active" | "pending" | "archived";
                workNodeId?: {
                    /** Format: uuid */
                    id: string;
                } | {
                    clientRef: string;
                } | null;
                title: string;
                authorText: string;
                /** Format: uri */
                canonicalUrl?: string | null;
                publicationLabel?: string | null;
                doi?: string | null;
                /** Format: date-time */
                accessedAt?: string | null;
                notes?: string | null;
                clientRef: string;
                /** @enum {string} */
                op: "create";
            } | {
                /**
                 * @default active
                 * @enum {string}
                 */
                status: "active" | "pending" | "archived";
                workNodeId?: {
                    /** Format: uuid */
                    id: string;
                } | {
                    clientRef: string;
                } | null;
                title: string;
                authorText: string;
                /** Format: uri */
                canonicalUrl?: string | null;
                publicationLabel?: string | null;
                doi?: string | null;
                /** Format: date-time */
                accessedAt?: string | null;
                notes?: string | null;
                clientRef: string;
                /** @enum {string} */
                op: "update";
                /** Format: uuid */
                id: string;
                expectedVersion: number;
            } | {
                clientRef: string;
                /** @enum {string} */
                op: "reference";
                /** Format: uuid */
                id: string;
            })[];
            /** @default [] */
            relations: ({
                /** @enum {string} */
                type: "influenced" | "formulated" | "developed" | "studied" | "used" | "adhered_to" | "transmitted" | "reinterpreted" | "incorporated_from" | "criticized" | "part_of" | "type_of" | "contextualizes" | "appears_in" | "parallel_to" | "differs_from";
                contextId?: {
                    /** Format: uuid */
                    id: string;
                } | {
                    clientRef: string;
                } | null;
                claim: string;
                justification: string;
                /** @enum {string} */
                evidenceStatus: "documented" | "attributed_interpretation" | "inference";
                /** @default null */
                intensity: number | null;
                intensityReason?: string | null;
                attributionNodeId?: {
                    /** Format: uuid */
                    id: string;
                } | {
                    clientRef: string;
                } | null;
                attributionText?: string | null;
                inferenceAuthor?: string | null;
                /** @default false */
                contested: boolean;
                contestationNote?: string | null;
                /**
                 * @default active
                 * @enum {string}
                 */
                status: "active" | "pending" | "archived";
                /** @default [] */
                evidence: {
                    sourceId?: {
                        /** Format: uuid */
                        id: string;
                    } | {
                        clientRef: string;
                    } | null;
                    /** @enum {string} */
                    sourceKind: "primary" | "secondary" | "conversation" | "other";
                    /** @enum {string} */
                    stance: "supports" | "challenges" | "contextualizes";
                    locator: string;
                    excerpt?: string | null;
                    explanation: string;
                    conversationReference?: string | null;
                }[];
                source: {
                    /** Format: uuid */
                    id: string;
                } | {
                    clientRef: string;
                };
                target: {
                    /** Format: uuid */
                    id: string;
                } | {
                    clientRef: string;
                };
                clientRef: string;
                /** @enum {string} */
                op: "create";
            } | {
                /** @enum {string} */
                type: "influenced" | "formulated" | "developed" | "studied" | "used" | "adhered_to" | "transmitted" | "reinterpreted" | "incorporated_from" | "criticized" | "part_of" | "type_of" | "contextualizes" | "appears_in" | "parallel_to" | "differs_from";
                contextId?: {
                    /** Format: uuid */
                    id: string;
                } | {
                    clientRef: string;
                } | null;
                claim: string;
                justification: string;
                /** @enum {string} */
                evidenceStatus: "documented" | "attributed_interpretation" | "inference";
                /** @default null */
                intensity: number | null;
                intensityReason?: string | null;
                attributionNodeId?: {
                    /** Format: uuid */
                    id: string;
                } | {
                    clientRef: string;
                } | null;
                attributionText?: string | null;
                inferenceAuthor?: string | null;
                /** @default false */
                contested: boolean;
                contestationNote?: string | null;
                /**
                 * @default active
                 * @enum {string}
                 */
                status: "active" | "pending" | "archived";
                /** @default [] */
                evidence: {
                    sourceId?: {
                        /** Format: uuid */
                        id: string;
                    } | {
                        clientRef: string;
                    } | null;
                    /** @enum {string} */
                    sourceKind: "primary" | "secondary" | "conversation" | "other";
                    /** @enum {string} */
                    stance: "supports" | "challenges" | "contextualizes";
                    locator: string;
                    excerpt?: string | null;
                    explanation: string;
                    conversationReference?: string | null;
                }[];
                source: {
                    /** Format: uuid */
                    id: string;
                } | {
                    clientRef: string;
                };
                target: {
                    /** Format: uuid */
                    id: string;
                } | {
                    clientRef: string;
                };
                clientRef: string;
                /** @enum {string} */
                op: "update";
                /** Format: uuid */
                id: string;
                expectedVersion: number;
            } | {
                clientRef: string;
                /** @enum {string} */
                op: "reference";
                /** Format: uuid */
                id: string;
            })[];
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export type operations = Record<string, never>;
