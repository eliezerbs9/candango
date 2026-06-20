import { SetMetadata } from '@nestjs/common';

export const SCOPES_KEY = 'required_scopes';

/** Required scopes for a route. Enforced for API-key callers (JWT users are session-authorized). */
export const Scopes = (...scopes: string[]) => SetMetadata(SCOPES_KEY, scopes);
