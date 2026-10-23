import {
  canPrepareReview,
  REVIEW_EVIDENCE,
  REVIEW_STAGES,
  type ReviewPlan,
  type ReviewStorageStatus,
} from './reviewPlan';
import './review-plan.css';

export default function ReviewPlanner({ plan, attachments, storageStatus, onChange }: {
  plan: ReviewPlan;
  attachments: number;
  storageStatus: ReviewStorageStatus;
  onChange: (plan: ReviewPlan) => void;
}) {
  const prepared = plan.status === 'prepared-for-review';
  const update = (changes: Partial<ReviewPlan>) => onChange({ ...plan, ...changes, status: 'draft' });
  return (
    <section className="ls-review-plan" aria-labelledby="ls-review-plan-title">
      <header>
        <div>
          <p className="tt-eyebrow">03 / THE NEXT CONVERSATION</p>
          <h2 id="ls-review-plan-title" tabIndex={-1}>Give the next review a clear starting point.</h2>
          <p>Keep a proposed review role, action and evidence request with this township’s brief.</p>
        </div>
        <span className="ls-review-status" data-prepared={prepared}>
          {prepared ? 'Prepared for review' : 'Draft'}
        </span>
      </header>
      <ol className="ls-review-route" aria-label="Review route">
        <li><span>01</span><div><strong>Assemble the brief</strong><small>{attachments} of 2 available attachments · bank study optional</small></div></li>
        <li aria-current="step"><span>02</span><div><strong>Prepare a local handover</strong><small>{prepared ? 'Author marked prepared' : 'Draft in this browser'}</small></div></li>
        <li><span>03</span><div><strong>Engineering review</strong><small>External next step · pending</small></div></li>
      </ol>
      <div className="ls-review-body">
        <div className="ls-review-fields">
          <div className="ls-review-pair">
            <label>
              Next review stage
              <select aria-label="Next review stage" value={plan.stage} onChange={(event) => {
                const selected = REVIEW_STAGES.find((item) => item.id === event.target.value)!;
                update({ stage: selected.id, reviewerRole: selected.role });
              }}>
                {REVIEW_STAGES.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}
              </select>
            </label>
            <label>
              Target review date <span className="ls-review-optional">optional</span>
              <input type="date" aria-label="Target review date" min="1900-01-01" max="2200-12-31"
                value={plan.targetDate ?? ''} onChange={(event) => update({ targetDate: event.target.value || null })} />
            </label>
          </div>
          <label>
            Proposed reviewer role <span className="ls-review-required">required to prepare</span>
            <input aria-label="Proposed reviewer role" maxLength={80} value={plan.reviewerRole}
              placeholder="e.g. Survey / drainage lead"
              onChange={(event) => update({ reviewerRole: event.target.value })} />
          </label>
          <label>
            Next action <span className="ls-review-required">required to prepare</span>
            <textarea aria-label="Next review action" maxLength={600} rows={3} value={plan.nextAction}
              placeholder="Describe the site evidence or review needed next."
              onChange={(event) => update({ nextAction: event.target.value })} />
          </label>
          <p className="ls-review-hint">A proposed role is not an assignment. Editing a prepared plan returns it to Draft.</p>
        </div>
        <fieldset className="ls-review-evidence">
          <legend>Evidence to request</legend>
          <p>Select what the next conversation needs. Ticks are requests, not verified evidence.</p>
          {REVIEW_EVIDENCE.map((item) => (
            <label key={item.id}>
              <input type="checkbox" checked={plan.requestedEvidence.includes(item.id)}
                onChange={(event) => update({ requestedEvidence: event.target.checked
                  ? [...plan.requestedEvidence, item.id]
                  : plan.requestedEvidence.filter((id) => id !== item.id) })} />
              <span>{item.label}</span>
            </label>
          ))}
          <small>{plan.requestedEvidence.length} evidence requests selected</small>
        </fieldset>
      </div>
      <footer>
        <div aria-live="polite">
          <strong>{storageStatus === 'browser' ? 'Saved on this browser.'
            : storageStatus === 'session' ? 'Kept for this session; browser storage is unavailable.'
              : 'No authored review plan yet.'}</strong>
          <p>Local planning only. Nothing is submitted, assigned or approved. The plan travels with your exports.</p>
        </div>
        <button className="ls-review-prepare" disabled={!canPrepareReview(plan) || prepared}
          onClick={() => onChange({ ...plan, status: 'prepared-for-review' })}>
          {prepared ? 'Prepared for review' : 'Mark prepared for review'}
        </button>
      </footer>
    </section>
  );
}
