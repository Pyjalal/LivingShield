import { TOWNSHIPS, type TownshipId } from '../township/model.ts';

export const REVIEW_STAGES = [
  { id: 'survey', label: 'Survey & drainage', role: 'Survey / drainage lead' },
  { id: 'hydraulics', label: 'Flood-model review', role: 'Hydraulic engineer' },
  { id: 'bank-design', label: 'Bank-design review', role: 'Geotechnical / structural engineer' },
  { id: 'quotation', label: 'Supply & installation', role: 'Quantity surveyor / supplier' },
] as const;

export const REVIEW_EVIDENCE = [
  { id: 'levels', label: 'Surveyed ground and bank levels' },
  { id: 'drainage', label: 'Drainage connectivity and asset capacities' },
  { id: 'boundaries', label: 'River, tide and external-inflow conditions' },
  { id: 'observed-flood', label: 'Observed flood levels and timing' },
  { id: 'bank-tests', label: 'Materials, anchorage, scour and planting tests (if bank works selected)' },
  { id: 'quotation', label: 'Supplier and installation quotations (if works are in scope)' },
] as const;

export type ReviewStage = (typeof REVIEW_STAGES)[number]['id'];
export type ReviewEvidence = (typeof REVIEW_EVIDENCE)[number]['id'];
export interface ReviewPlan {
  schemaVersion: 1;
  townshipId: TownshipId;
  status: 'draft' | 'prepared-for-review';
  stage: ReviewStage;
  reviewerRole: string;
  nextAction: string;
  targetDate: string | null;
  requestedEvidence: ReviewEvidence[];
  updatedAt: string | null;
}
export type ReviewStorageStatus = 'not-saved' | 'browser' | 'session';
type StorageAdapter = Pick<Storage, 'getItem' | 'setItem'>;
const PILOTS = new Set(TOWNSHIPS.map((township) => township.id));
const KEY = 'livingshield-review-plan-v1:';
const cleanText = (value: unknown, max: number) =>
  typeof value === 'string'
    ? value.replace(/\r\n?/g, '\n').replace(/\p{Cc}/gu, (character) =>
      character === '\n' || character === '\t' ? character : '').slice(0, max)
    : '';

function validDate(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value &&
    value >= '1900-01-01' && value <= '2200-12-31'
    ? value
    : null;
}

export function emptyReviewPlan(townshipId: TownshipId): ReviewPlan {
  if (!PILOTS.has(townshipId)) throw new Error('Unknown township review context.');
  return {
    schemaVersion: 1,
    townshipId,
    status: 'draft',
    stage: 'survey',
    reviewerRole: '',
    nextAction: '',
    targetDate: null,
    requestedEvidence: ['levels', 'drainage', 'boundaries', 'observed-flood'],
    updatedAt: null,
  };
}

export function canPrepareReview(plan: ReviewPlan): boolean {
  return !!plan.reviewerRole.trim() && !!plan.nextAction.trim() && plan.requestedEvidence.length > 0;
}

export function parseReviewPlan(value: unknown, townshipId: TownshipId): ReviewPlan | null {
  if (!PILOTS.has(townshipId) || !value || typeof value !== 'object' || Array.isArray(value)) return null;
  const saved = value as Record<string, unknown>;
  if (saved.schemaVersion !== 1 || saved.townshipId !== townshipId ||
    typeof saved.status !== 'string' || !['draft', 'prepared-for-review'].includes(saved.status) ||
    !REVIEW_STAGES.some((item) => item.id === saved.stage) || !Array.isArray(saved.requestedEvidence)) return null;
  const updatedAt = typeof saved.updatedAt === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(saved.updatedAt) &&
    Number.isFinite(Date.parse(saved.updatedAt)) && new Date(saved.updatedAt).toISOString() === saved.updatedAt
    ? saved.updatedAt
    : null;
  if (saved.updatedAt !== null && !updatedAt) return null;
  const plan: ReviewPlan = {
    schemaVersion: 1,
    townshipId,
    status: saved.status as ReviewPlan['status'],
    stage: saved.stage as ReviewStage,
    reviewerRole: cleanText(saved.reviewerRole, 80),
    nextAction: cleanText(saved.nextAction, 600),
    targetDate: validDate(saved.targetDate),
    requestedEvidence: REVIEW_EVIDENCE.filter((item) =>
      (saved.requestedEvidence as unknown[]).includes(item.id)).map((item) => item.id),
    updatedAt,
  };
  if (!canPrepareReview(plan) || !updatedAt) plan.status = 'draft';
  return plan;
}

export function createReviewPlanStore(storage?: StorageAdapter, now = () => new Date().toISOString()) {
  const memory = new Map<TownshipId, { plan: ReviewPlan; status: ReviewStorageStatus }>();
  const copy = (plan: ReviewPlan): ReviewPlan => ({ ...plan, requestedEvidence: [...plan.requestedEvidence] });
  function read(townshipId: TownshipId): ReviewPlan {
    if (!PILOTS.has(townshipId)) throw new Error('Unknown township review context.');
    const cached = memory.get(townshipId);
    if (cached) return copy(cached.plan);
    let plan = null;
    try {
      const value = storage?.getItem(`${KEY}${townshipId}`);
      if (value && value.length <= 10000) plan = parseReviewPlan(JSON.parse(value), townshipId);
    } catch {
      plan = null;
    }
    const record = { plan: plan ?? emptyReviewPlan(townshipId), status: plan ? 'browser' as const : 'not-saved' as const };
    memory.set(townshipId, record);
    return copy(record.plan);
  }
  return {
    read,
    storageStatus(townshipId: TownshipId): ReviewStorageStatus {
      read(townshipId);
      return memory.get(townshipId)!.status;
    },
    save(value: ReviewPlan) {
      const plan = parseReviewPlan({ ...value, updatedAt: now() }, value.townshipId);
      if (!plan) throw new Error('Review plan failed validation.');
      let status: ReviewStorageStatus = 'session';
      try {
        if (storage) {
          storage.setItem(`${KEY}${plan.townshipId}`, JSON.stringify(plan));
          status = 'browser';
        }
      } catch {
        status = 'session';
      }
      memory.set(plan.townshipId, { plan: copy(plan), status });
      return copy(plan);
    },
  };
}

let browserStore: ReturnType<typeof createReviewPlanStore> | undefined;
export function getReviewPlanStore() {
  if (!browserStore) {
    let storage: StorageAdapter | undefined;
    try {
      storage = window.localStorage;
    } catch {
      storage = undefined;
    }
    browserStore = createReviewPlanStore(storage);
  }
  return browserStore;
}
