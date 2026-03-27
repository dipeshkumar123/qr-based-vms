export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "II-VMS Backend API",
    version: "0.2.0",
    description: "Swagger documentation for all backend endpoints in the QR-based Visitor Management System.",
  },
  servers: [
    {
      url: "http://localhost:4000",
      description: "Local backend server",
    },
  ],
  tags: [
    { name: "System", description: "Service health and readiness" },
    { name: "Admin", description: "Admin authentication and session routes" },
    { name: "Visitors", description: "Visitor lifecycle management" },
    { name: "Ledger", description: "Audit ledger operations" },
    { name: "AI", description: "AI assistant endpoints" },
    { name: "Analytics", description: "Analytics ingestion and reporting" },
    { name: "Biometric", description: "Biometric service proxy endpoints" },
    { name: "Uploads", description: "File upload endpoints" },
  ],
  components: {
    securitySchemes: {
      AdminKeyAuth: {
        type: "apiKey",
        in: "header",
        name: "x-admin-key",
      },
      AdminCookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "admin_token",
      },
      ServiceKeyAuth: {
        type: "apiKey",
        in: "header",
        name: "x-service-key",
      },
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        properties: {
          message: { type: "string" },
          error: {
            type: "object",
            nullable: true,
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              status: { type: "number" },
              retryable: { type: "boolean" },
            },
          },
          requestId: { type: "string", nullable: true },
        },
      },
      SuccessMessage: {
        type: "object",
        properties: {
          ok: { type: "boolean" },
          message: { type: "string" },
        },
      },
      VisitorCreateRequest: {
        type: "object",
        properties: {
          name: { type: "string" },
          email: { type: "string", format: "email" },
          phone: { type: "string" },
          purpose: { type: "string" },
          host_name: { type: "string" },
          host_email: { type: "string", format: "email" },
          company: { type: "string" },
          photo_url: { type: "string" },
        },
        required: ["name", "email", "phone", "purpose"],
      },
      VisitorUpdateRequest: {
        type: "object",
        properties: {
          name: { type: "string" },
          email: { type: "string", format: "email" },
          phone: { type: "string" },
          purpose: { type: "string" },
          status: { type: "string" },
        },
      },
      AnalyticsEventRequest: {
        type: "object",
        properties: {
          name: { type: "string", example: "notification_sent" },
          payload: { type: "object", additionalProperties: true },
          source: { type: "string", enum: ["backend", "biometric", "analytics"] },
          correlation_id: { type: "string" },
        },
        required: ["name"],
      },
      BiometricCaptureRequest: {
        type: "object",
        properties: {
          visitor_id: { type: "number" },
          photo_base64: { type: "string" },
        },
        required: ["visitor_id", "photo_base64"],
      },
      BiometricVerifyRequest: {
        type: "object",
        properties: {
          visitor_id: { type: "number" },
          photo_base64: { type: "string" },
          match_threshold: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["visitor_id", "photo_base64"],
      },
      AiGenerateRequest: {
        type: "object",
        properties: {
          prompt: { type: "string" },
        },
        required: ["prompt"],
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["System"],
        summary: "Backend health check",
        responses: {
          "200": {
            description: "Service is healthy",
          },
        },
      },
    },
    "/ready": {
      get: {
        tags: ["System"],
        summary: "Backend readiness check",
        responses: {
          "200": { description: "Service is ready" },
          "503": { description: "Service degraded" },
        },
      },
    },
    "/api/admin/login": {
      post: {
        tags: ["Admin"],
        summary: "Admin login",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { key: { type: "string" } },
                required: ["key"],
              },
            },
          },
        },
        responses: {
          "200": { description: "Login successful" },
          "401": { description: "Invalid admin key" },
        },
      },
    },
    "/api/admin/logout": {
      post: {
        tags: ["Admin"],
        summary: "Admin logout",
        responses: {
          "204": { description: "Logged out" },
        },
      },
    },
    "/api/admin/verify": {
      get: {
        tags: ["Admin"],
        summary: "Verify current admin auth",
        security: [{ AdminKeyAuth: [] }, { AdminCookieAuth: [] }],
        responses: {
          "204": { description: "Authenticated" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/api/admin/me": {
      get: {
        tags: ["Admin"],
        summary: "Read current admin profile",
        security: [{ AdminCookieAuth: [] }],
        responses: {
          "200": { description: "Current admin role" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/api/visitors": {
      post: {
        tags: ["Visitors"],
        summary: "Register a visitor",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/VisitorCreateRequest" },
            },
          },
        },
        responses: {
          "201": { description: "Visitor created" },
          "400": { description: "Validation error" },
        },
      },
      get: {
        tags: ["Visitors"],
        summary: "List visitors",
        security: [{ AdminKeyAuth: [] }, { AdminCookieAuth: [] }],
        responses: {
          "200": { description: "Visitor list" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/api/visitors/stats": {
      get: {
        tags: ["Visitors"],
        summary: "Visitor statistics",
        security: [{ AdminKeyAuth: [] }, { AdminCookieAuth: [] }],
        responses: {
          "200": { description: "Stats payload" },
        },
      },
    },
    "/api/visitors/export": {
      get: {
        tags: ["Visitors"],
        summary: "Export visitors as CSV",
        security: [{ AdminKeyAuth: [] }, { AdminCookieAuth: [] }],
        responses: {
          "200": { description: "CSV export" },
        },
      },
    },
    "/api/visitors/id/{id}": {
      get: {
        tags: ["Visitors"],
        summary: "Get visitor by numeric ID",
        security: [{ AdminKeyAuth: [] }, { AdminCookieAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
        ],
        responses: {
          "200": { description: "Visitor details" },
          "404": { description: "Not found" },
        },
      },
    },
    "/api/visitors/{id}": {
      put: {
        tags: ["Visitors"],
        summary: "Update visitor",
        security: [{ AdminKeyAuth: [] }, { AdminCookieAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/VisitorUpdateRequest" },
            },
          },
        },
        responses: {
          "200": { description: "Visitor updated" },
          "400": { description: "Validation error" },
        },
      },
      delete: {
        tags: ["Visitors"],
        summary: "Delete visitor",
        security: [{ AdminKeyAuth: [] }, { AdminCookieAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
        ],
        responses: {
          "200": { description: "Visitor deleted" },
        },
      },
    },
    "/api/visitors/{token}": {
      get: {
        tags: ["Visitors"],
        summary: "Find visitor by token",
        security: [{ AdminKeyAuth: [] }, { AdminCookieAuth: [] }],
        parameters: [
          { name: "token", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Visitor details" },
          "404": { description: "Not found" },
        },
      },
    },
    "/api/visitors/{token}/check-in": {
      post: {
        tags: ["Visitors"],
        summary: "Check in visitor by token",
        security: [{ AdminKeyAuth: [] }, { AdminCookieAuth: [] }],
        parameters: [
          { name: "token", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Checked in" },
          "400": { description: "Invalid state" },
        },
      },
    },
    "/api/visitors/{token}/check-out": {
      post: {
        tags: ["Visitors"],
        summary: "Check out visitor by token",
        security: [{ AdminKeyAuth: [] }, { AdminCookieAuth: [] }],
        parameters: [
          { name: "token", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Checked out" },
          "400": { description: "Invalid state" },
        },
      },
    },
    "/api/ledger": {
      get: {
        tags: ["Ledger"],
        summary: "List audit ledger entries",
        security: [{ AdminKeyAuth: [] }, { AdminCookieAuth: [] }],
        responses: {
          "200": { description: "Ledger records" },
        },
      },
    },
    "/api/ledger/verify": {
      get: {
        tags: ["Ledger"],
        summary: "Verify ledger integrity",
        security: [{ AdminKeyAuth: [] }, { AdminCookieAuth: [] }],
        responses: {
          "200": { description: "Ledger verification result" },
        },
      },
    },
    "/api/ledger/report": {
      get: {
        tags: ["Ledger"],
        summary: "Get ledger audit report",
        security: [{ AdminKeyAuth: [] }, { AdminCookieAuth: [] }],
        responses: {
          "200": { description: "Audit report" },
        },
      },
    },
    "/api/ai/generate": {
      post: {
        tags: ["AI"],
        summary: "Generate AI response",
        security: [{ AdminKeyAuth: [] }, { AdminCookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AiGenerateRequest" },
            },
          },
        },
        responses: {
          "200": { description: "AI completion" },
          "400": { description: "Bad prompt or AI error" },
        },
      },
    },
    "/api/analytics/events": {
      post: {
        tags: ["Analytics"],
        summary: "Ingest analytics event",
        security: [{ ServiceKeyAuth: [] }, { AdminKeyAuth: [] }, { AdminCookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AnalyticsEventRequest" },
            },
          },
        },
        responses: {
          "200": { description: "Event accepted" },
          "413": { description: "Payload too large" },
        },
      },
      get: {
        tags: ["Analytics"],
        summary: "List recent analytics events",
        security: [{ AdminKeyAuth: [] }, { AdminCookieAuth: [] }],
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 500 } },
        ],
        responses: {
          "200": { description: "Event list" },
        },
      },
    },
    "/api/analytics/events/ingest-health": {
      get: {
        tags: ["Analytics"],
        summary: "Ingestion pipeline health and alert state",
        security: [{ AdminKeyAuth: [] }, { AdminCookieAuth: [] }],
        responses: {
          "200": { description: "Ingest health and monitor alerts" },
        },
      },
    },
    "/api/analytics/report": {
      get: {
        tags: ["Analytics"],
        summary: "Comprehensive analytics report",
        security: [{ AdminKeyAuth: [] }, { AdminCookieAuth: [] }],
        parameters: [
          { name: "days", in: "query", schema: { type: "integer", minimum: 1, maximum: 365 } },
        ],
        responses: {
          "200": { description: "Analytics report" },
        },
      },
    },
    "/api/analytics/peak-hours": {
      get: {
        tags: ["Analytics"],
        summary: "Peak-hour forecast",
        security: [{ AdminKeyAuth: [] }, { AdminCookieAuth: [] }],
        parameters: [
          { name: "days", in: "query", schema: { type: "integer", minimum: 1, maximum: 365 } },
        ],
        responses: {
          "200": { description: "Peak-hour analytics" },
        },
      },
    },
    "/api/analytics/frequent-visitors": {
      get: {
        tags: ["Analytics"],
        summary: "Frequent visitor analysis",
        security: [{ AdminKeyAuth: [] }, { AdminCookieAuth: [] }],
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100 } },
          { name: "min_visits", in: "query", schema: { type: "integer", minimum: 1 } },
        ],
        responses: {
          "200": { description: "Frequent visitors" },
        },
      },
    },
    "/api/analytics/suspicious-activity": {
      get: {
        tags: ["Analytics"],
        summary: "Suspicious pattern detection",
        security: [{ AdminKeyAuth: [] }, { AdminCookieAuth: [] }],
        parameters: [
          { name: "threshold", in: "query", schema: { type: "number", minimum: 0.01, maximum: 0.5 } },
        ],
        responses: {
          "200": { description: "Suspicious activity list" },
        },
      },
    },
    "/api/analytics/trends": {
      get: {
        tags: ["Analytics"],
        summary: "Visitor trend over time",
        security: [{ AdminKeyAuth: [] }, { AdminCookieAuth: [] }],
        parameters: [
          { name: "days", in: "query", schema: { type: "integer", minimum: 1, maximum: 365 } },
        ],
        responses: {
          "200": { description: "Trend data" },
        },
      },
    },
    "/api/analytics/status-distribution": {
      get: {
        tags: ["Analytics"],
        summary: "Visitor status distribution",
        security: [{ AdminKeyAuth: [] }, { AdminCookieAuth: [] }],
        responses: {
          "200": { description: "Status distribution" },
        },
      },
    },
    "/api/biometric/health": {
      get: {
        tags: ["Biometric"],
        summary: "Biometric service health proxy",
        responses: {
          "200": { description: "Biometric service health" },
        },
      },
    },
    "/api/biometric/config": {
      get: {
        tags: ["Biometric"],
        summary: "Biometric verification config",
        responses: {
          "200": { description: "Current biometric thresholds" },
        },
      },
    },
    "/api/biometric/capture": {
      post: {
        tags: ["Biometric"],
        summary: "Capture and store face encoding",
        security: [{ AdminKeyAuth: [] }, { AdminCookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/BiometricCaptureRequest" },
            },
          },
        },
        responses: {
          "200": { description: "Capture result" },
          "400": { description: "Invalid payload" },
        },
      },
    },
    "/api/biometric/verify": {
      post: {
        tags: ["Biometric"],
        summary: "Verify face against stored encoding",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/BiometricVerifyRequest" },
            },
          },
        },
        responses: {
          "200": { description: "Verification result" },
          "429": { description: "Rate limited" },
        },
      },
    },
    "/api/biometric/info/{visitor_id}": {
      get: {
        tags: ["Biometric"],
        summary: "Get biometric info by visitor ID",
        parameters: [
          { name: "visitor_id", in: "path", required: true, schema: { type: "integer" } },
        ],
        responses: {
          "200": { description: "Biometric info" },
          "400": { description: "Invalid ID" },
        },
      },
    },
    "/api/biometric/encoding/{visitor_id}": {
      delete: {
        tags: ["Biometric"],
        summary: "Delete visitor biometric encoding",
        security: [{ AdminKeyAuth: [] }, { AdminCookieAuth: [] }],
        parameters: [
          { name: "visitor_id", in: "path", required: true, schema: { type: "integer" } },
        ],
        responses: {
          "200": { description: "Encoding deleted" },
          "400": { description: "Invalid ID" },
        },
      },
    },
    "/api/biometric/stats": {
      get: {
        tags: ["Biometric"],
        summary: "Biometric storage stats",
        security: [{ AdminKeyAuth: [] }, { AdminCookieAuth: [] }],
        responses: {
          "200": { description: "Biometric stats" },
        },
      },
    },
    "/api/uploads": {
      post: {
        tags: ["Uploads"],
        summary: "Upload image file",
        security: [{ AdminKeyAuth: [] }, { AdminCookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  image: { type: "string", format: "binary" },
                },
                required: ["image"],
              },
            },
          },
        },
        responses: {
          "200": { description: "Uploaded URL" },
          "400": { description: "Upload error" },
        },
      },
    },
  },
} as const;
