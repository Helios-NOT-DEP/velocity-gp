import type { NextFunction, Request, RequestHandler, Response } from 'express';

export function asyncHandler(
  handler: (request: Request, response: Response, next: NextFunction) => Promise<void>
): RequestHandler {
  return (request, response, next) => {
    // Forward rejected async route handlers into Express error middleware chain.
    void handler(request, response, next).catch(next);
  };
}
