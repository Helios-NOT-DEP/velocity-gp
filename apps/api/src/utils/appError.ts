/**
 * Base custom error class for the application.
 * All domain-specific and HTTP-aware errors should extend this class
 * to ensure consistent error-handling behavior upstream (e.g., in global error handlers).
 *
 * @param statusCode - The HTTP status code to map this error to (e.g. 400).
 * @param code - A stable string identifier for the error category (e.g. 'VALIDATION_ERROR').
 * @param message - The human-readable message intended for logs or end-users.
 * @param details - An optional object providing additional structured context.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

// Convenience subclasses map directly to stable API error codes/statuses.
/**
 * Represents a missing resource (HTTP 404).
 * Used when a requested entity (e.g., an Event or Team) cannot be found in the database.
 */
export class NotFoundError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(404, 'NOT_FOUND', message, details);
  }
}

/**
 * Represents a client input or business logic violation (HTTP 400).
 * Used when payloads are malformed or when a state transition is invalid.
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

/**
 * Represents authentication failure (HTTP 401).
 * Typically thrown when session verification fails or JWTs are missing/invalid.
 */
export class UnauthorizedError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(401, 'UNAUTHORIZED', message, details);
  }
}

/**
 * Represents authorization failure (HTTP 403).
 * Used when an authenticated user attempts an action outside their role's permissions
 * (e.g., a standard user calling an admin endpoint).
 */
export class ForbiddenError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(403, 'FORBIDDEN', message, details);
  }
}

/**
 * Represents an external dependency failure (HTTP 502 Bad Gateway).
 * Thrown when an expected external service (e.g., n8n webhook) timeouts, returns 5xx, or
 * provides malformed output. This differentiates system failures from client faults.
 */
export class DependencyError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(502, 'DEPENDENCY_ERROR', message, details);
  }
}
