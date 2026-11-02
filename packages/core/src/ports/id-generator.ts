/** Mints our own ids (AGENT.md rule 8). */
export interface IdGenerator {
  /** A new ULID (26 chars, uppercase Crockford base32). */
  newId(): string;
}
