// ===== Modelo físico: pista, integración RK4 y alturas mínimas =====
// No depende de la página; app.js lo usa para el visor, la pizarra, la tabla y el plano.
const TAU = Math.PI * 2;

function buildTrack(c) {
  // c: { R (radio de la trayectoria del centro, m), alpha (rad), h (m), Rf, L1, L2, dz }
  const { R, alpha: a, h } = c;
  const Rf = c.Rf ?? 0.06, L1 = c.L1 ?? 0.06, L2 = c.L2 ?? 0.30, dz = c.dz ?? 0.03;
  const sa = Math.sin(a), ca = Math.cos(a);
  const x1 = -L1 - Rf * sa, y1 = Rf - Rf * ca;
  const Linc = Math.max(0, (h - y1) / sa);
  const x0 = x1 - Linc * ca, y0 = Math.max(h, y1);
  const s1 = Linc, s2 = s1 + Rf * a, s3 = s2 + L1, s4 = s3 + TAU * R, s5 = s4 + L2;
  function at(s) {
    if (s < s1) { return { x: x0 + s * ca, y: y0 - s * sa, z: 0, th: -a, k: 0, seg: 0 }; }
    if (s < s2) { const ph = -Math.PI / 2 - a + (s - s1) / Rf;
      return { x: -L1 + Rf * Math.cos(ph), y: Rf + Rf * Math.sin(ph), z: 0, th: ph + Math.PI / 2, k: 1 / Rf, seg: 1 }; }
    if (s < s3) { return { x: -L1 + (s - s2), y: 0, z: 0, th: 0, k: 0, seg: 2 }; }
    if (s < s4) { const ps = (s - s3) / R;
      return { x: R * Math.sin(ps), y: R * (1 - Math.cos(ps)), z: dz * ps / TAU, th: ps, k: 1 / R, seg: 3, psi: ps }; }
    return { x: s - s4, y: 0, z: dz, th: 0, k: 0, seg: 4 };
  }
  return { s1, s2, s3, s4, s5, x0, y0, at, dz, L1, L2, Rf };
}

// c: { R, alpha, h, beta, mu, g, record, dt }
function simulate(c) {
  const tr = buildTrack(c);
  const { beta, mu, g } = c;
  const dt = c.dt ?? 2e-4;
  const tMax = c.tMax ?? 8;
  const rec = c.record;
  const recEvery = rec ? Math.max(1, Math.round((1 / 240) / dt)) : 0;
  const frames = [];
  let s = 0, v = 0, t = 0, W = 0, step = 0; // W: energía perdida por unidad de masa (J/kg)
  let W4 = null, maxPsi = 0, vBase = null, vTop = null, nTop = null, result = 'pendiente', detachPsi = null;
  const loopN = []; // [psi, N/mg]

  function f(s, v) {
    const q = tr.at(s);
    const Nm = v * v * q.k + g * Math.cos(q.th);
    const fr = Nm > 0 ? mu * Nm * Math.sign(v) : 0;
    return (-g * Math.sin(q.th) - fr) / (1 + beta);
  }
  function push(q, Nm) {
    frames.push({ t, s, x: q.x, y: q.y, z: q.z, th: q.th, v, Nm, W, free: false, seg: q.seg });
  }
  let q = tr.at(0);
  if (rec) push(q, g * Math.cos(q.th));

  while (t < tMax) {
    // RK4 en (s, v)
    const k1s = v, k1v = f(s, v);
    const k2s = v + 0.5 * dt * k1v, k2v = f(s + 0.5 * dt * k1s, v + 0.5 * dt * k1v);
    const k3s = v + 0.5 * dt * k2v, k3v = f(s + 0.5 * dt * k2s, v + 0.5 * dt * k2v);
    const k4s = v + dt * k3v, k4v = f(s + dt * k3s, v + dt * k3v);
    const sN = s + dt / 6 * (k1s + 2 * k2s + 2 * k3s + k4s);
    const vN = v + dt / 6 * (k1v + 2 * k2v + 2 * k3v + k4v);
    // energía disipada en el paso (trapecio)
    const qa = tr.at(s), Na = Math.max(0, v * v * qa.k + g * Math.cos(qa.th));
    const qb = tr.at(sN), Nb = Math.max(0, vN * vN * qb.k + g * Math.cos(qb.th));
    W += mu * 0.5 * (Na + Nb) * Math.abs(sN - s);
    const prevV = v;
    s = sN; v = vN; t += dt; step++;
    q = qb;
    const Nm = vN * vN * qb.k + g * Math.cos(qb.th);

    if (q.seg <= 2 && vBase === null && s >= tr.s3 - 1e-9) vBase = Math.abs(v);
    if (q.seg === 3) {
      if (vBase === null) vBase = Math.abs(v);
      if (q.psi > maxPsi) maxPsi = q.psi;
      if (rec && v > 0 && (loopN.length === 0 || q.psi > loopN[loopN.length - 1][0] + 0.01)) loopN.push([q.psi, Nm / g]);
      if (vTop === null && q.psi >= Math.PI && v > 0) { vTop = v; nTop = Nm / g; }
      if (Nm < 0) { // se despega del riel
        result = 'desprende'; detachPsi = q.psi;
        if (rec) push(q, Nm);
        if (rec) freeFall(q);
        break;
      }
    }
    if (rec && step % recEvery === 0) push(q, Nm);
    if (s >= tr.s4 && result === 'pendiente') { result = 'completa'; W4 = W; if (!rec) break; }
    if (s >= tr.s5) break;
    if (prevV > 0 && v <= 0) {
      if (result === 'pendiente') { result = 'retrocede'; if (!rec) break; }
      else break; // se detuvo en la salida
    }
    if (s < 0) break;
  }
  if (result === 'pendiente') result = s >= tr.s4 ? 'completa' : 'retrocede';

  function freeFall(q0) {
    let x = q0.x, y = q0.y, z = q0.z;
    let vx = v * Math.cos(q0.th), vy = v * Math.sin(q0.th);
    const vz = c.dz0 ?? 0;
    const fdt = 1 / 240;
    let n = 0;
    while (y > 0 && n < 400) {
      vy -= g * fdt; x += vx * fdt; y += vy * fdt; t += fdt; n++;
      frames.push({ t, s, x, y: Math.max(0, y), z, th: Math.atan2(vy, vx), v: Math.hypot(vx, vy), Nm: 0, W, free: true, seg: 3 });
    }
  }
  return { result, frames, track: tr, W, W4: W4 ?? W, vBase, vTop, nTop, maxPsi, detachPsi, loopN, tEnd: t };
}

function hMinSim(c) {
  const ok = (h) => simulate({ ...c, h, record: false, dt: 5e-4 }).result === 'completa';
  let lo = 2 * c.R, hi = 8 * c.R;
  if (!ok(hi)) return null;
  for (let i = 0; i < 24; i++) { const mid = 0.5 * (lo + hi); if (ok(mid)) hi = mid; else lo = mid; }
  return hi;
}
function hMinTheo(R, beta) { return 2 * R + 0.5 * (1 + beta) * R; }
