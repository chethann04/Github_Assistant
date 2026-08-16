/**
 * Centralized Unicode Sanitizer Utility
 *
 * Removes lone / unpaired Unicode surrogates (U+D800 to U+DFFF) which cause
 * UTF-8 codec errors during JSON serialization and vector database storage (ChromaDB / SQLite).
 * Preserves all valid UTF-8, emojis, multilingual characters (Kannada, Hindi, etc.), and symbols.
 */

export function sanitizeUnicodeText(text: string, filePath?: string, chunkIndex?: number): string {
  if (typeof text !== 'string' || !text) {
    return text || '';
  }

  // Regex targeting lone / unpaired surrogate code units
  const surrogateRegex = /[\uD800-\uDFFF]/g;
  const matches = text.match(surrogateRegex);

  if (matches && matches.length > 0) {
    console.log(
      `[Unicode Sanitizer] Replaced invalid Unicode surrogate\n` +
      `  file: ${filePath || 'unknown'}\n` +
      `  chunk: ${chunkIndex !== undefined ? chunkIndex : 'full-file'}\n` +
      `  count: ${matches.length}`
    );
    return text.normalize('NFC').replace(surrogateRegex, '\uFFFD');
  }

  return text.normalize('NFC');
}

/**
 * Recursively sanitizes any string values inside an object (metadata, payloads, etc.)
 */
export function sanitizeMetadata<T extends Record<string, any>>(metadata: T, filePath?: string): T {
  if (!metadata || typeof metadata !== 'object') return metadata;

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === 'string') {
      result[key] = sanitizeUnicodeText(value, filePath);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === 'string' ? sanitizeUnicodeText(item, filePath) : item
      );
    } else {
      result[key] = value;
    }
  }

  return result as T;
}
