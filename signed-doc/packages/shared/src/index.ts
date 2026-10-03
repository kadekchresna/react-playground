/**
 * `@signed-doc/shared` — the frozen public API (ADR-007 item 2).
 *
 * `apps/server` and `apps/web` import their rules from here and nowhere else,
 * so there is exactly one source of truth for name, email, signature-count,
 * duplicate, filename and pricing rules (PRD §8.5).
 *
 * Two invariants hold for every symbol below:
 *
 * 1. **Zero runtime dependencies**, and nothing is imported from either app.
 * 2. **No price, quota or upload-size value is exported.** Those belong to the
 *    demo account, are known only to the server (PRD §5), and reach the browser
 *    only inside a server response (ADR-003). Every function that needs one
 *    takes it as a parameter. The rule constants that ARE exported —
 *    `ALLOWED_EXTENSIONS`, `MAX_FILENAME_LENGTH`, `MAX_RECIPIENTS`,
 *    `MIN/MAX_SIGNATURE_COUNT` — are PRD §6 validation rules, not commercial
 *    terms, and both layers need them to agree.
 */

// Errors — the shared vocabulary every rejection speaks.
export {
  ERROR_CODES,
  isValidationFailure,
  validationFailure,
  type ErrorCode,
  type ValidationFailure,
  type ValidationFailureDetails,
} from './errors.js';

// Wire + domain types, imported by both layers so the contract is compiler-checked.
export type {
  ApiError,
  ChargePreviewRequest,
  ChargePreviewResponse,
  ChargeRecord,
  EnvelopeCreatedResponse,
  EnvelopeMeta,
  Field,
  FieldInput,
  FieldKind,
  Money,
  OrderMode,
  PriceRecord,
  QuotaRecord,
  Recipient,
  RecipientInput,
  StepGroup,
} from './types.js';

// Money — bigint minor units; the only decimal-string conversion points (ADR-006).
export {
  formatDecimalString,
  multiplyMinor,
  parseDecimalString,
  sumMinor,
  type Minor,
} from './money.js';

// Filename sanitization and file-type rules (PRD §7.8, §7.9).
export {
  ALLOWED_EXTENSIONS,
  MAX_FILENAME_LENGTH,
  extensionOf,
  isAllowedExtension,
  sanitizeFilename,
  validateFileMeta,
  type SanitizedFilename,
} from './file.js';

// Recipient rules — the one shared validation module (PRD §8.5, Case 2 §A3).
export {
  MAX_METERAI_COUNT,
  MAX_RECIPIENTS,
  MAX_SIGNATURE_COUNT,
  MIN_METERAI_COUNT,
  MIN_RECIPIENTS,
  MIN_SIGNATURE_COUNT,
  RECIPIENT_LIST_STAGES,
  clampMeteraiCount,
  clampSignatureCount,
  countStage,
  duplicateStage,
  findDuplicateEmailGroups,
  isValidMeteraiCount,
  isValidSignatureCount,
  meteraiCountOf,
  meteraiVsSignatureStage,
  meteraiWithinSignatures,
  normalizeEmail,
  perRecipientStage,
  runRecipientStages,
  signatureCountOf,
  validateRecipient,
  validateRecipientList,
  type RecipientListStage,
} from './recipient.js';

// Signing order — mode, steps, renormalization and the §B4 projection (§A2, P2).
export {
  DEFAULT_ORDER_MODE,
  FIRST_STEP,
  ORDER_MODES,
  groupByStep,
  isOrderMode,
  isValidStep,
  meteraiStepPlacementStage,
  orderModeOf,
  orderModeStage,
  renormalizeSteps,
  stepOf,
  stepStructureStage,
  validateMeteraiStepPlacement,
  validateOrderMode,
  validateStepSequence,
} from './steps.js';

// Field placement — geometry, shape and the reconciliation invariant (§A4, P3).
//
// The geometry is TWO functions on purpose (§B2: "The UI clamps. The API
// rejects."): `clampFieldPosition` repairs a position and belongs to the
// frontend; `isFieldInBounds` / `validateFieldBounds` judge one and belong to
// the server, which must answer `FIELD_OUT_OF_BOUNDS` rather than silently
// clamp (§B7.15, §B7.16). They are not interchangeable.
export {
  CONTENT_AREA,
  FIELD_KINDS,
  FIELD_PAGE,
  FIELD_SIZES,
  PAGE_PADDING,
  PAGE_SIZE,
  canCarryMeteraiField,
  clampFieldPosition,
  fieldBoundsFor,
  fieldListOf,
  fieldOwnerOf,
  fieldReconciliationStage,
  fieldShapeStage,
  fieldSizeOf,
  fieldStages,
  fieldsProvided,
  isFieldInBounds,
  isFieldKind,
  reconcileFields,
  validateFieldBounds,
  validateFieldCounts,
  validateFieldIdentity,
  validateFieldList,
  validateFieldOwnership,
  validateFieldPage,
  validateFieldReconciliation,
  validateFieldShape,
  validateMeteraiFieldPlacement,
  type FieldBounds,
  type FieldCounts,
  type FieldPosition,
  type FieldReconciliation,
  type FieldSize,
  type RecipientFieldProgress,
} from './fields.js';

// Derived totals — pure, component-free (PRD §8.6, Case 2 §A3.6/§A3.7).
export {
  computeCharges,
  quotaRemaining,
  type ChargeBreakdown,
  type ChargeRow,
  type ChargeTable,
  type PriceTable,
  type QuotaBalance,
  type QuotaStatus,
  type QuotaTable,
  type QuotaUsage,
} from './pricing.js';

// Quota stages — the only rules that are TOLD an allowance (ADR-003, §B5).
export {
  chargePreviewStages,
  meteraiQuotaStage,
  quotaStages,
  signatureQuotaStage,
} from './quota.js';

// Page count — fixture table, never file content (PRD §4 fact 3, §6).
export { DEFAULT_PAGE_COUNT, pageCountFor } from './page-count.js';
