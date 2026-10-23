import type { BankEvidence, FloodEvidence, PlatformView } from './evidence';
import { updateSettings, useSettings } from '../malaysia/settings';
import { useState } from 'react';

const STEPS = [
  {
    name: '1 · Explore',
    title: 'What should SDP investigate first?',
    view: 'township',
    instruction:
      'You are preparing a concept review for an SDP township asset team. Start with the Bukit Raja study window, inspect the place, then test an assumed storm. This is a proposed workflow, not an approved SDP scheme.',
    ms: {
      name: '1 · Terokai',
      title: 'Apakah yang perlu disiasat oleh SDP dahulu?',
      instruction:
        'Sediakan semakan konsep untuk pasukan aset perbandaran SDP. Mulakan dengan kawasan kajian Bukit Raja, periksa lokasi dan uji ribut andaian. Ini cadangan aliran kerja, bukan skim SDP yang diluluskan.',
    },
  },
  {
    name: '2 · Compare the storm',
    title: 'Test the option. Inspect what stays wet.',
    view: 'township',
    instruction:
      'Run flood comparison, choose Place pooling-point demo basins and run again. Compare the same timestamp: how much water is captured, and what remains? Review this flood option directly, or inspect the optional bank concept.',
    ms: {
      name: '2 · Bandingkan ribut',
      title: 'Uji pilihan. Periksa kawasan yang masih bertakung.',
      instruction:
        'Klik Run flood comparison, pilih Place pooling-point demo basins dan jalankan semula. Bandingkan masa yang sama: berapa air ditakung dan apa yang masih tinggal? Teruskan ke ringkasan atau periksa konsep tebing pilihan.',
    },
  },
  {
    name: '3 · Optional bank study',
    title: 'Optional: put a bank concept to the test.',
    view: 'living-shield',
    instruction:
      'If bank works are part of the investigation, inspect the module and Plan the bank. Record quantities and tests to request. This optional concept receives no flood-storage benefit; leave the rate blank without a quote.',
    ms: {
      name: '3 · Kajian tebing pilihan',
      title: 'Pilihan: semak konsep tebing untuk diuji.',
      instruction:
        'Jika kerja tebing perlu disiasat, periksa modul dan Plan the bank. Rekod kuantiti serta ujian yang diperlukan. Konsep pilihan ini tidak diberi manfaat takungan banjir; biarkan harga kosong tanpa sebut harga.',
    },
  },
  {
    name: '4 · Review the brief',
    title: 'Leave with a specific investigation request.',
    view: 'evidence',
    instruction:
      'Prepare the local review: propose a reviewer, next action and site evidence to collect. Export the readable brief or JSON. The bank attachment is optional; this scopes an investigation, not approval to build.',
    ms: {
      name: '4 · Semak ringkasan',
      title: 'Sediakan permintaan siasatan yang khusus.',
      instruction:
        'Sediakan semakan setempat: cadangkan penyemak, tindakan seterusnya dan bukti tapak yang diperlukan. Eksport ringkasan atau JSON. Lampiran tebing ialah pilihan; ini skop siasatan, bukan kelulusan membina.',
    },
  },
] as const;

export default function GuidedDemo({
  step,
  activeView,
  flood,
  bank,
  onStep,
  onClose,
}: {
  step: number;
  activeView: PlatformView;
  flood: FloodEvidence | null;
  bank: BankEvidence | null;
  onStep: (step: number, view: PlatformView) => void;
  onClose: () => void;
}) {
  const ms = useSettings().language === 'ms';
  const [compact, setCompact] = useState(false);
  const current = STEPS[step];
  const copy = ms ? current.ms : current;
  const attachmentCount = Number(!!flood) + Number(!!bank);
  const status =
    step === 1
      ? flood
        ? (flood.input.proposals?.length ?? 0) > 0
          ? ms
            ? `Perbandingan dilampirkan: ${flood.input.proposals?.length} konsep takungan. Baca keputusan sebenar di bawah.`
            : `Comparison attached: ${flood.input.proposals?.length} storage concepts. Read the actual results below.`
          : ms
            ? 'Keputusan asas dilampirkan. Tambah konsep dan jalankan semula untuk membandingkan mitigasi.'
            : 'Baseline attached. Add concepts and rerun to compare mitigation.'
        : ms
          ? 'Belum ada perbandingan lengkap untuk perbandaran ini.'
          : 'No completed comparison attached for this township yet.'
      : step === 2
        ? bank
          ? ms
            ? 'Konsep tebing dilampirkan. Prestasinya belum disahkan.'
            : 'Bank concept attached. Its performance remains unvalidated.'
          : ms
            ? 'Belum ada konsep tebing untuk perbandaran ini.'
            : 'No bank concept attached for this township yet.'
        : step === 3
          ? ms
            ? `${attachmentCount} daripada 2 lampiran tersedia disertakan. Kajian tebing ialah pilihan; bukti yang tiada dinyatakan.`
            : `${attachmentCount} of 2 available attachments included. The bank study is optional; missing evidence stays explicit.`
          : ms
            ? 'Kawasan rintis menggunakan jejak bangunan dan aras permukaan bersumber; sebahagian butiran bangunan ialah ilustrasi.'
            : 'Pilot windows use sourced footprints and surface elevations; building detail is partly illustrative.';
  return (
    <aside className="ls-guide" aria-label="Guided demo" lang={ms ? 'ms' : 'en'}>
      <div className="ls-demo-bar">
        <strong>{ms ? 'PANDUAN LIVINGSHIELD' : 'THE LIVINGSHIELD WALKTHROUGH'}</strong>
        <div>
          {STEPS.map((item, i) => (
            <button key={item.name} aria-pressed={step === i} onClick={() => onStep(i, item.view)}>
              {ms ? item.ms.name : item.name}
            </button>
          ))}
        </div>
        <button
          aria-label="Walkthrough language"
          onClick={() => updateSettings({ language: ms ? 'en' : 'ms' })}
        >
          {ms ? 'English' : 'Bahasa Melayu'}
        </button>
        <button
          aria-label={compact ? 'Expand guide instructions' : 'Collapse guide instructions'}
          aria-expanded={!compact}
          aria-controls="ls-demo-instructions"
          onClick={() => setCompact(!compact)}
        >
          {compact ? '+' : '−'}
        </button>
        <button onClick={onClose} aria-label="Close guided demo">
          ×
        </button>
      </div>
      <div className="ls-demo-coach">
        <div>
          <strong>{copy.title}</strong>
          <p hidden={compact} id="ls-demo-instructions">
            {activeView === current.view
              ? copy.instruction
              : ms
                ? 'Anda sedang meneroka alat lain. Kembali ke langkah ini untuk meneruskan panduan.'
                : 'You are exploring another tool. Return to this step to continue the walkthrough.'}
          </p>
          <small aria-live="polite">{status}</small>
        </div>
        <div className="ls-demo-actions">
          {step === 1 && activeView === 'township' && flood && (
            <button className="ls-demo-review" onClick={() => onStep(3, 'evidence')}>
              {ms ? 'Semak pilihan banjir ini ↗' : 'Review this flood option ↗'}
            </button>
          )}
          {step < 3 && activeView === current.view && (
            <button
              className="ls-demo-jump"
              onClick={() => {
                if (step === 1) {
                  document.querySelector<HTMLButtonElement>('.tt-jump-storm')?.click();
                } else {
                  const target = document.querySelector<HTMLElement>(
                    step === 0 ? '.tt-model-toolbar' : '.ls-viewer-heading',
                  );
                  target?.scrollIntoView({ block: 'start' });
                  target?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
                }
              }}
            >
              {step === 1
                ? ms
                  ? 'Ke kawalan ribut ↓'
                  : 'Storm controls ↓'
                : ms
                  ? 'Lihat model 3D ↓'
                  : 'Show 3D view ↓'}
            </button>
          )}
        {activeView !== current.view ? (
          <button onClick={() => onStep(step, current.view)}>
            {ms ? 'Kembali ke langkah ↗' : 'Return to step ↗'}
          </button>
        ) : step < STEPS.length - 1 ? (
          <button onClick={() => onStep(step + 1, STEPS[step + 1].view)}>
            {ms ? 'Langkah seterusnya →' : 'Next step →'}
          </button>
        ) : (
          <button onClick={onClose}>{ms ? 'Tamatkan panduan' : 'Finish walkthrough'}</button>
        )}
        </div>
      </div>
    </aside>
  );
}
