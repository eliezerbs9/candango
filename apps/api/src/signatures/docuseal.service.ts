/**
 * The internal shape for a signing field placed on a document — shared by the acceptance page, the
 * builder/upload field mapping and the Documenso client. (The old DocuSeal REST client was removed
 * when the engine migrated to Documenso; only this neutral field type remains.)
 */

/** A signing field placed on a document. `areas` use normalized (0–1) page coordinates, page 1-indexed. */
export interface DocusealField {
  name: string;
  type: 'signature' | 'initials' | 'date' | 'text' | 'checkbox' | 'name';
  role: string;
  /** Index into the submission's recipients (0 = first signer). Defaults to 0. */
  recipient?: number;
  areas: { page: number; x: number; y: number; w: number; h: number }[];
}
