// Developer start: data + URL helpers for starting a run at any stage/form. Pure (no DOM), reads stages.js only.
// The sim does the actual work (sim.startAt) by replaying the normal evolve/pickChoice path.
//
//   ?stage=<stage id or 0-based index>&form=<choice id>[,<choice id>...]     e.g. ?stage=rocky_planet&form=lava
// `form` ids are the choice ids in stages.js (unique across stages). Earlier menu stages with no id given are abandoned.
import { STAGES, ABANDON_ID, getChoicesFor } from './stages.js';

/** Every stage with the forms offered there, straight from stages.js: [{ index, id, name, minMass, forms: [{ id, label, description }] }]. */
export function devStages() {
  return STAGES.map((s, index) => ({
    index, id: s.id, name: s.name, minMass: s.minMass,
    forms: (getChoicesFor(index) || []).filter((c) => c.id !== ABANDON_ID),
  }));
}

/** A dev spec from a query string, or null when it has no (valid) `stage`. Unknown form ids are dropped. */
export function parseDevQuery(search) {
  const q = new URLSearchParams(search);
  const raw = q.get('stage');
  if (raw == null || raw === '') return null;
  const stages = devStages();
  const stage = /^\d+$/.test(raw) ? stages[Number(raw)] : stages.find((s) => s.id === raw);
  if (!stage) return null;
  const known = new Set(stages.filter((s) => s.index <= stage.index).flatMap((s) => s.forms.map((f) => f.id)));
  const forms = q.getAll('form').flatMap((v) => v.split(',')).map((v) => v.trim()).filter((v) => known.has(v));
  return { stage: stage.id, forms };
}

/** Query string (no leading '?') that reproduces a spec. */
export function devQuery(spec) {
  const q = new URLSearchParams({ stage: spec.stage });
  if (spec.forms && spec.forms.length) q.set('form', spec.forms.join(','));
  return q.toString().replace(/%2C/g, ',');
}
