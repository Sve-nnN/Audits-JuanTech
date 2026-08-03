/**
 * Output contract of the social meta extractor. Deliberately data-only: this
 * package never knows about `Issue` or `PageCheck`, so Phase 32 can reuse it
 * from the Vercel graph without pulling in the crawler or the database layer.
 */
export interface MetaSocialData {
  /**
   * Normalized meta key (lowercased, trimmed) -> every non-empty `content`
   * carrying that key, in document order.
   *
   * This is a `Map` and not a plain object literal on purpose: the audited
   * site fully controls these keys, so a hostile key such as a reserved
   * `Object.prototype` member would become a prototype write on an object
   * literal accumulator (T-30-01). A `Map` stores it as an ordinary entry.
   *
   * Canonical serialization for Phase 32 is `Object.fromEntries(data.tags)`,
   * which defines own properties and therefore does not reopen that vector.
   */
  tags: Map<string, string[]>;
}
