(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const deg = (r) => r * 180 / Math.PI;
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const fmt = (x, d = 2) => (x === null || x === undefined || !isFinite(x)) ? '—' : x.toFixed(d);
  const RF = 0.06, L1 = 0.06, L2 = 0.22;

  const S = { R: 0.12, d: 0.00953, rho: 7850, ID: 0.0127, alpha: 50 * Math.PI / 180, h: 0.36, beta: 0.4, mu: 0.01, g: 9.775 };
  let sim = null, hTheo = 0, hSim = null, Ref = 0, mass = 0, Hbuild = 0, dz = 0.03;

  function readForm() {
    S.R = +$('inR').value / 100;
    S.d = +$('inD').value / 1000;
    S.rho = +$('inMat').value;
    const id = +$('inID').value; S.ID = (id >= 5 && id <= 30 ? id : 12.7) / 1000;
    const a = +$('inA').value; S.alpha = (a >= 25 && a <= 65 ? a : 50) * Math.PI / 180;
    S.h = +$('inH').value / 100;
    S.beta = +document.querySelector('input[name=model]:checked').value;
    S.mu = +$('inMu').value;
    const g = +$('inG').value; S.g = (g > 9 && g < 10.5) ? g : 9.775;
    $('outR').textContent = (S.R * 100).toFixed(1) + ' cm';
    $('outH').textContent = (S.h * 100).toFixed(1) + ' cm';
    $('outMu').textContent = S.mu.toFixed(3);
  }
  const cfg = (x) => Object.assign({ R: Ref, alpha: S.alpha, beta: S.beta, mu: S.mu, g: S.g, h: S.h, Rf: RF, L1, L2, dz }, x || {});

  function recompute() {
    readForm();
    const r = S.d / 2;
    Ref = S.R - r;
    dz = Math.max(0.025, S.ID * 2.2);
    mass = S.rho * 4 / 3 * Math.PI * r * r * r;
    hTheo = hMinTheo(Ref, S.beta);
    hSim = hMinSim(cfg());
    Hbuild = Math.ceil((Math.max(S.h, 1.3 * Math.max(hTheo, hSim || 0)) + 0.02) * 100) / 100;
    sim = simulate(cfg({ record: true }));
    fitNote(); renderBoard(); renderTable(); renderPlan(); drawN(null);
    rebuildScene(); resetPlayback();
  }

  function fitNote() {
    const el = $('fitNote'), ratio = S.d / S.ID;
    el.className = 'note';
    if (ratio >= 1) { el.className = 'note crit'; el.textContent = 'El balín no entra en la manguera: su diámetro es igual o mayor al interior.'; }
    else if (ratio > 0.8) { el.className = 'note warn'; el.textContent = `Ajustado: el balín ocupa el ${(ratio * 100).toFixed(0)} % del diámetro interior y puede rozar los bordes del corte.`; }
    else if (ratio < 0.4) { el.className = 'note warn'; el.textContent = `Holgado: el balín ocupa el ${(ratio * 100).toFixed(0)} % del diámetro interior y puede zigzaguear.`; }
    else el.textContent = `Buen ajuste: el balín ocupa el ${(ratio * 100).toFixed(0)} % del diámetro interior de la manguera.`;
  }

  // ---------- pizarra ----------
  const Fr = (a, b) => `<span class="frac"><span>${a}</span><span>${b}</span></span>`;
  function row(k, v, cls) { return `<div class="r${cls ? ' ' + cls : ''}"><span class="k">${k}</span><span class="v">${v}</span></div>`; }
  const chip = (s) => `<span class="chip">${s}</span>`;
  const n = (x) => `<span class="n">${x}</span>`;
  function step(num, q, rows, why) { return `<div class="q"><b>${num}</b><span>${q}</span></div><div class="rows">${rows.join('')}</div>${why ? `<p class="why">${why}</p>` : ''}`; }
  function renderBoard() {
    const r = S.d / 2, R = Ref, g = S.g, b = S.beta, h = S.h;
    const vmin = Math.sqrt(g * R), bTxt = b > 0 ? '2/5' : '0';
    $('st1').innerHTML = step('01', '¿Qué radio recorre el centro del balín?', [
      row('Datos', chip(`R = ${fmt(S.R * 100, 1)} cm`) + chip(`r = ${fmt(r * 100, 3)} cm`)),
      row('Fórmula', `<span class="f">R<sub>ef</sub> = R − r</span>`),
      row('Reemplazo', `<span class="sub">R<sub>ef</sub> = ${n(fmt(S.R * 100, 1))} − ${n(fmt(r * 100, 3))}</span>`),
      row('Resultado', `<b class="res">R<sub>ef</sub> = ${fmt(R * 100, 2)} cm</b>`, 'out')],
      `El balín rueda apoyado en el canal, así que su centro va r más adentro. Masa del balín: ${fmt(mass * 1000, 2)} g.`);
    $('st2').innerHTML = step('02', '¿Con qué velocidad mínima debe pasar por la cima?', [
      row('Datos', chip(`g = ${fmt(g, 3)} m/s²`) + chip(`R<sub>ef</sub> = ${fmt(R, 4)} m`)),
      row('Fórmula', `<span class="f">v<sub>mín</sub> = √( g · R<sub>ef</sub> )</span>`),
      row('Reemplazo', `<span class="sub">v<sub>mín</sub> = √( ${n(fmt(g, 3))} × ${n(fmt(R, 4))} )</span>`),
      row('Resultado', `<b class="res">v<sub>mín</sub> = ${fmt(vmin, 3)} m/s</b>`, 'out')],
      'Sale de la 2.ª ley de Newton en la cima: N + mg = mv²/R. El caso límite es N = 0.');
    $('st3').innerHTML = step('03', '¿Desde qué altura mínima hay que soltarlo?', [
      row('Datos', chip(`R<sub>ef</sub> = ${fmt(R * 100, 2)} cm`) + chip(`β = ${bTxt}`)),
      row('Fórmula', `<span class="f">h<sub>mín</sub> = 2R<sub>ef</sub> + ${Fr('1 + β', '2')} R<sub>ef</sub></span>`),
      row('Reemplazo', `<span class="sub">h<sub>mín</sub> = 2(${n(fmt(R * 100, 2))}) + ${n(fmt((1 + b) / 2, 1))}(${n(fmt(R * 100, 2))}) = ${fmt(2 * R * 100, 3)} + ${fmt((1 + b) / 2 * R * 100, 3)}</span>`),
      row('Resultado', `<b class="res">h<sub>mín</sub> = ${fmt(hTheo * 100, 2)} cm</b> <span class="small">= ${b > 0 ? '2.7' : '2.5'} R</span>`, 'out')],
      'Sale de la energía: mgh = mg(2R) + ½(1 + β)mv²<sub>mín</sub>. La masa y g se cancelan.');
    const v2top = 2 * g * (h - 2 * R) / (1 + b);
    if (h >= hTheo) {
      const vt = Math.sqrt(v2top), nt = vt * vt / (g * R) - 1;
      $('st4').innerHTML = step('04', `Tu ensayo, h = ${fmt(h * 100, 1)} cm: ¿llega rápido a la cima?`, [
        row('Datos', chip(`h = ${fmt(h, 3)} m`) + chip(`2R<sub>ef</sub> = ${fmt(2 * R, 4)} m`) + chip(`1 + β = ${fmt(1 + b, 1)}`)),
        row('Fórmula', `<span class="f">v<sub>cima</sub> = √( ${Fr('2g (h − 2R<sub>ef</sub>)', '1 + β')} )</span>`),
        row('Reemplazo', `<span class="sub">v<sub>cima</sub> = √( 2 × ${n(fmt(g, 3))} × (${n(fmt(h, 3))} − ${n(fmt(2 * R, 4))}) / ${n(fmt(1 + b, 1))} )</span>`),
        row('Resultado', `<b class="res">v<sub>cima</sub> = ${fmt(vt, 3)} m/s</b> <span class="good">≥ ${fmt(vmin, 3)} ✓ completa</span>`, 'out')],
        `Sin pérdidas. La normal en la cima vale N = ${fmt(nt, 2)} mg, todavía positiva.`);
    } else if (h > R) {
      const c = -2 * (h / R - 1) / (3 + b), psi = deg(Math.acos(Math.max(-1, Math.min(1, c))));
      $('st4').innerHTML = step('04', `Tu ensayo, h = ${fmt(h * 100, 1)} cm: ¿dónde se despega?`, [
        row('Datos', chip(`h/R<sub>ef</sub> = ${fmt(h / R, 3)}`) + chip(`β = ${bTxt}`)),
        row('Fórmula', `<span class="f">cos ψ = − ${Fr('2 (h/R<sub>ef</sub> − 1)', '3 + β')}</span>`),
        row('Reemplazo', `<span class="sub">cos ψ = −2 × (${n(fmt(h / R, 3))} − 1) / ${n(fmt(3 + b, 1))} = ${fmt(c, 3)}</span>`),
        row('Resultado', `<b class="res">ψ = ${fmt(psi, 1)}°</b> <span class="crit">se despega antes de la cima (180°)</span>`, 'out')],
        'h es menor que h mínima. Ángulo medido desde la base del loop, sin pérdidas (da Silva, 2015).');
    } else {
      $('st4').innerHTML = step('04', `Tu ensayo, h = ${fmt(h * 100, 1)} cm`, [row('Resultado', '<b class="res">No pasa de la mitad del loop</b>', 'out')], 'Con h ≤ R el balín sube hasta la altura h y regresa sin despegarse.');
    }
    const info = resultInfo(sim), diff = hSim ? (hSim - hTheo) / hTheo * 100 : null;
    $('st5').innerHTML = step('05', `Con pérdidas (μ = ${S.mu.toFixed(3)}): ¿cuánto más alto?`, [
      row('Datos', chip(`h<sub>teo</sub> = ${fmt(hTheo * 100, 2)} cm`) + chip(`h<sub>sim</sub> = ${hSim ? fmt(hSim * 100, 2) + ' cm' : '> 8R'}`)),
      row('Fórmula', `<span class="f">%E = ${Fr('| h<sub>sim</sub> − h<sub>teo</sub> |', 'h<sub>teo</sub>')} × 100</span>`),
      row('Reemplazo', `<span class="sub">%E = | ${n(hSim ? fmt(hSim * 100, 2) : '—')} − ${n(fmt(hTheo * 100, 2))} | / ${n(fmt(hTheo * 100, 2))} × 100</span>`),
      row('Resultado', `<b class="res">%E = ${fmt(diff, 1)} %</b>`, 'out')],
      `h<sub>sim</sub> sale del teorema trabajo-energía, E<sub>f</sub> = E<sub>i</sub> + W<sub>nc</sub>, con W<sub>nc</sub> = −∫μN ds. Este ensayo: <span class="${info.cls === 'good' ? 'good' : 'crit'}">${info.txt.toLowerCase()}</span>${sim.vTop ? `, v<sub>cima</sub> = ${fmt(sim.vTop, 3)} m/s` : ''}, pierde ${fmt(sim.W4 * mass * 1000, 2)} mJ en el loop.`);
  }
  let activeStep = null;
  function highlight(id) {
    if (id === activeStep) return; activeStep = id;
    for (let i = 1; i <= 5; i++) $('st' + i).classList.toggle('on', ('st' + i) === id);
    if (id) scrollToStep($(id));
  }
  // lleva el paso activo a la vista dentro del panel, sin mover la página
  function scrollToStep(el) {
    const box = $('sidePizarra');
    if (box.hidden || box.scrollHeight <= box.clientHeight) return;
    const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 8;
    box.scrollTo({ top, behavior: reduceMotion() ? 'auto' : 'smooth' });
  }
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  function stepBy(d) {
    selectSide('pizarra');
    const cur = activeStep ? +activeStep.slice(2) : 0;
    highlight('st' + Math.max(1, Math.min(5, cur + d)));
  }

  const ICON = {
    good: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="currentColor" opacity=".18"/><path d="M6 10.5l2.6 2.6L14.2 7.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    crit: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="currentColor" opacity=".18"/><path d="M10 5.5v5.5M10 14.2v.3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    warn: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="currentColor" opacity=".18"/><path d="M13.5 8.5A4 4 0 1 0 14 11M13.6 5.6v3h-3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    idle: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="4" fill="currentColor"/></svg>'
  };
  function resultInfo(res) {
    if (res.result === 'completa') return { cls: 'good', txt: 'Completa el loop' };
    if (res.result === 'desprende') return { cls: 'crit', txt: `Se despega a ψ = ${deg(res.detachPsi).toFixed(0)}°` };
    return { cls: 'warn', txt: `No alcanza: sube hasta ψ = ${deg(res.maxPsi).toFixed(0)}° y regresa` };
  }
  function setStatus(kind, txt) { const s = $('status'); s.className = 'status ' + kind; s.innerHTML = ICON[kind] + '<span>' + txt + '</span>'; }

  // ---------- energía en vivo ----------
  const ebarEls = [...document.querySelectorAll('#ebars .ebar')].map(el => ({ fill: el.querySelector('.fill'), val: el.querySelector('.val') }));
  const stripEls = [...document.querySelectorAll('#estrip .bar i')];
  let rotFrozen = null;
  function updateEnergy(f) {
    const mJ = mass * 1000, E0 = S.g * S.h * mJ;
    let kr = 0.5 * S.beta * f.v * f.v;
    if (f.free) { if (rotFrozen === null) rotFrozen = lastKr; kr = rotFrozen; } else { rotFrozen = null; lastKr = kr; }
    const vals = [S.g * f.y * mJ, 0.5 * f.v * f.v * mJ, kr * mJ, f.W * mJ];
    vals.forEach((v, i) => {
      const pct = Math.max(0, Math.min(100, v / E0 * 100));
      ebarEls[i].fill.style.width = pct + '%';
      stripEls[i].style.width = pct + '%';
      ebarEls[i].val.innerHTML = `${v.toFixed(2)} <small>mJ · ${pct.toFixed(0)}%</small>`;
    });
    $('eTot').textContent = vals.reduce((a, b) => a + b, 0).toFixed(2) + ' mJ = mgh';
  }
  let lastKr = 0;

  // ---------- normal en el loop (canvas) ----------
  const ncv = $('ncv');
  function drawN(cur) {
    const box = ncv.parentElement, W = box.clientWidth, H = box.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (!W || !H) return;
    if (ncv.width !== Math.round(W * dpr)) { ncv.width = Math.round(W * dpr); ncv.height = Math.round(H * dpr); }
    const c = ncv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    const L = 40, Rm = 10, T = 10, B = 30, pw = W - L - Rm, ph = H - T - B;
    const yMax = 7, yMin = -2;
    const X = (deg) => L + deg / 360 * pw, Y = (n) => T + (yMax - n) / (yMax - yMin) * ph;
    const ink3 = css('--ink-3'), rule = css('--rule'), ink2 = css('--ink-2');
    c.font = '10px "IBM Plex Mono", monospace'; c.fillStyle = ink3; c.strokeStyle = rule; c.lineWidth = 1;
    for (let n = -2; n <= 7; n += 1) { c.globalAlpha = n === 0 ? 0 : .5; c.beginPath(); c.moveTo(L, Y(n)); c.lineTo(L + pw, Y(n)); c.stroke(); c.globalAlpha = 1; if (n % 2 === 0) { c.textAlign = 'right'; c.textBaseline = 'middle'; c.fillText(n, L - 6, Y(n)); } }
    c.textAlign = 'center'; c.textBaseline = 'top';
    for (let d = 0; d <= 360; d += 90) { c.fillText(d + '°', X(d), T + ph + 6); }
    c.fillStyle = ink2; c.fillText('base', X(0) + 14, T + ph + 18); c.fillText('cima', X(180), T + ph + 18);
    // N = 0
    c.strokeStyle = css('--crit'); c.setLineDash([2, 3]); c.beginPath(); c.moveTo(L, Y(0)); c.lineTo(L + pw, Y(0)); c.stroke();
    // ideal
    c.strokeStyle = ink3; c.setLineDash([5, 4]); c.lineWidth = 1.5; c.beginPath();
    let started = false;
    for (let k = 0; k <= 360; k += 2) {
      const ps = k * Math.PI / 180, v2 = 2 * S.g * (S.h - Ref * (1 - Math.cos(ps))) / (1 + S.beta);
      if (v2 < 0) break;
      const n = v2 / (S.g * Ref) + Math.cos(ps);
      if (!started) { c.moveTo(X(k), Y(n)); started = true; } else c.lineTo(X(k), Y(Math.max(yMin, n)));
      if (n < 0) break;
    }
    c.stroke(); c.setLineDash([]);
    // simulado
    if (sim) {
      c.strokeStyle = css('--s-ekt'); c.lineWidth = 2; c.beginPath();
      sim.loopN.forEach(([p, n], i) => { const x = X(deg(p)), y = Y(Math.max(yMin, Math.min(yMax, n))); i ? c.lineTo(x, y) : c.moveTo(x, y); });
      c.stroke();
    }
    if (cur) {
      const x = X(cur[0]), y = Y(Math.max(yMin, Math.min(yMax, cur[1])));
      c.fillStyle = css('--panel'); c.strokeStyle = css('--ink'); c.lineWidth = 2;
      c.beginPath(); c.arc(x, y, 5, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = css('--ink'); c.textAlign = x > L + pw - 70 ? 'right' : 'left'; c.textBaseline = 'bottom';
      c.font = '600 11px "IBM Plex Mono", monospace'; c.fillText(`N = ${cur[1].toFixed(2)} mg`, x + (c.textAlign === 'left' ? 8 : -8), y - 6);
    }
    c.save(); c.translate(11, T + ph / 2); c.rotate(-Math.PI / 2); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = ink3; c.font = '10px "IBM Plex Sans", sans-serif'; c.fillText('N / mg', 0, 0); c.restore();
  }
  new ResizeObserver(() => drawN(lastN)).observe(ncv.parentElement);
  let lastN = null;

  // ---------- plano SVG ----------
  function renderPlan() {
    const tr = buildTrack(cfg({ h: Hbuild }));
    const cm = (v) => v * 100;
    const xmin = Math.floor(cm(tr.x0) / 10) * 10 - 10, xmax = Math.ceil(cm(L2) / 10) * 10 + 5, ymax = Math.ceil(cm(Hbuild) / 10) * 10 + 5, ymin = -8;
    const VW = 900, sc = VW / (xmax - xmin), VH = Math.round((ymax - ymin) * sc);
    const X = (x) => ((x - xmin) * sc).toFixed(1), Y = (y) => ((ymax - y) * sc).toFixed(1);
    const ink = css('--ink'), ink2 = css('--ink-2'), ink3 = css('--ink-3'), rule = css('--rule'), acc = css('--accent'), hose = css('--hose');
    let s = `<svg viewBox="0 0 ${VW} ${VH}" xmlns="http://www.w3.org/2000/svg" font-family="IBM Plex Mono, monospace" font-size="11" role="img" aria-label="Plano frontal de la maqueta con medidas">`;
    s += `<rect x="0" y="0" width="${VW}" height="${VH}" fill="${css('--panel')}"/>`;
    // cuadrícula cada 5 cm
    for (let x = xmin; x <= xmax; x += 5) s += `<line x1="${X(x)}" y1="${Y(ymin)}" x2="${X(x)}" y2="${Y(ymax)}" stroke="${rule}" stroke-width="${x % 10 === 0 ? 1 : 0.5}"/>`;
    for (let y = 0; y <= ymax; y += 5) s += `<line x1="${X(xmin)}" y1="${Y(y)}" x2="${X(xmax)}" y2="${Y(y)}" stroke="${rule}" stroke-width="${y % 10 === 0 ? 1 : 0.5}"/>`;
    for (let y = 0; y <= ymax - 5; y += 10) s += `<text x="${+X(xmin) + 4}" y="${+Y(y) - 3}" fill="${ink3}">${y}</text>`;
    for (let x = xmin + 10; x <= xmax - 5; x += 10) s += `<text x="${X(x)}" y="${+Y(ymin) - 4}" fill="${ink3}" text-anchor="middle">${x}</text>`;
    // trayectoria (eje del balín)
    const pts = []; for (let si = 0; si <= tr.s3; si += 0.004) { const q = tr.at(si); pts.push(`${X(cm(q.x))},${Y(cm(q.y))}`); }
    const loopPts = []; for (let si = tr.s3; si <= tr.s4; si += 0.004) { const q = tr.at(si); loopPts.push(`${X(cm(q.x))},${Y(cm(q.y))}`); }
    const exitPts = [`${X(0)},${Y(0)}`, `${X(cm(L2))},${Y(0)}`];
    const hw = Math.max(6, cm(S.ID) * sc);
    for (const p of [pts, loopPts, exitPts]) s += `<polyline points="${p.join(' ')}" fill="none" stroke="${hose}" stroke-opacity=".45" stroke-width="${hw.toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    for (const p of [pts, exitPts]) s += `<polyline points="${p.join(' ')}" fill="none" stroke="${acc}" stroke-width="1.5"/>`;
    s += `<polyline points="${loopPts.join(' ')}" fill="none" stroke="${acc}" stroke-width="1.5" stroke-dasharray="6 4"/>`;
    // radio
    const cx = X(0), cy = Y(cm(Ref));
    s += `<circle cx="${cx}" cy="${cy}" r="3" fill="${ink}"/><line x1="${cx}" y1="${cy}" x2="${X(cm(Ref) * 0.707)}" y2="${Y(cm(Ref) + cm(Ref) * 0.707)}" stroke="${ink2}" stroke-width="1"/>`;
    s += `<text x="${+cx + 6}" y="${+cy + 16}" fill="${ink}">R = ${cm(S.R).toFixed(1)}</text><text x="${+cx + 6}" y="${+cy + 30}" fill="${ink3}">media caña</text>`;
    // origen
    s += `<circle cx="${X(0)}" cy="${Y(0)}" r="4" fill="none" stroke="${ink}" stroke-width="1.5"/><text x="${+X(0) + 8}" y="${+Y(0) + 16}" fill="${ink}">O (0, 0)</text>`;
    // marcas de soltado sobre la rampa
    const sa = Math.sin(S.alpha), ca = Math.cos(S.alpha), x1 = -L1 - RF * sa, y1 = RF - RF * ca;
    const onRamp = (y) => x1 - (y - y1) / Math.tan(S.alpha);
    const marks = [[hTheo, '--s-ep', 'h mín. teórica'], [hSim, '--s-w', 'h mín. con pérdidas'], [S.h, '--accent', 'tu ensayo']].filter(m => m[0]);
    marks.sort((a, b) => b[0] - a[0]);
    let lastLabY = -1e9;
    marks.forEach(([y, c, t]) => {
      const xr = onRamp(y), col = css(c); const px = +X(cm(xr)), py = +Y(cm(y));
      s += `<line x1="${px - 9}" y1="${py}" x2="${px + 9}" y2="${py}" stroke="${col}" stroke-width="2.5"/>`;
      let ly = Math.max(py, lastLabY + 15); lastLabY = ly;
      s += `<text x="${px + 14}" y="${ly + 4}" fill="${ink}">${t}: (${cm(xr).toFixed(1)}, ${cm(y).toFixed(1)})</text>`;
    });
    // cota de altura máxima de la rampa
    const xt = cm(tr.x0), hx = +X(xt) - 22;
    s += `<line x1="${hx}" y1="${Y(0)}" x2="${hx}" y2="${Y(cm(Hbuild))}" stroke="${ink2}"/><line x1="${hx - 5}" y1="${Y(0)}" x2="${hx + 5}" y2="${Y(0)}" stroke="${ink2}"/><line x1="${hx - 5}" y1="${Y(cm(Hbuild))}" x2="${hx + 5}" y2="${Y(cm(Hbuild))}" stroke="${ink2}"/>`;
    s += `<text x="${hx - 6}" y="${(+Y(cm(Hbuild)) + +Y(0)) / 2}" fill="${ink}" text-anchor="end">${cm(Hbuild).toFixed(0)} cm</text>`;
    s += `<text x="${X(xt)}" y="${+Y(cm(Hbuild)) - 8}" fill="${ink}" text-anchor="middle">tope de rampa (${xt.toFixed(1)}, ${cm(Hbuild).toFixed(0)})</text>`;
    // ángulo
    const ax = X(cm(x1)), ay = Y(cm(y1));
    s += `<text x="${+ax - 70}" y="${+ay - 8}" fill="${ink2}">α = ${Math.round(deg(S.alpha))}°</text>`;
    s += `<text x="${X(cm(L2))}" y="${+Y(0) + 34}" fill="${ink3}" text-anchor="end">salida (${(dz * 100).toFixed(0)} cm delante del tablero)</text>`;
    s += '</svg>';
    $('plan').innerHTML = s;
    $('planInfo').textContent = `Calculado con el montaje del simulador: R = ${cm(S.R).toFixed(1)} cm, balín de ${(S.d * 1000).toFixed(2)} mm, manguera de ${(S.ID * 1000).toFixed(1)} mm y rampa a ${Math.round(deg(S.alpha))}°. Si cambias esos valores, el plano se actualiza.`;

    // lista de cortes (por el eje de la manguera)
    const off = Math.max(0, S.ID / 2 - S.d / 2);
    const Linc = tr.s1, lFil = (RF - off) * S.alpha, lLoop = TAU * (S.R - S.ID / 2);
    const rows = [['Rampa recta', `a ${Math.round(deg(S.alpha))}° desde ${cm(Hbuild).toFixed(0)} cm de alto`, Linc], ['Curva de transición', `radio ${cm(RF).toFixed(0)} cm`, lFil], ['Tramo horizontal', 'antes del loop', L1],
      ['Loop en media caña', `círculo de eje de radio ${cm(S.R - S.ID / 2).toFixed(1)} cm`, lLoop + 0.02], ['Salida', 'horizontal', L2]];
    const total = rows.reduce((a, r) => a + r[2], 0);
    $('cutlist').innerHTML = '<tr><th>Tramo</th><th>Detalle</th><th>Largo</th></tr>' +
      rows.map(r => `<tr><td>${r[0]}</td><td class="small">${r[1]}</td><td>${cm(r[2]).toFixed(1)} cm</td></tr>`).join('') +
      `<tr class="tot"><td>Total, con 10 cm de margen</td><td></td><td>${(cm(total) + 10).toFixed(0)} cm</td></tr>`;
    $('buildSteps').innerHTML = [
      `Usa un tablero de triplay de al menos <b>${(xmax - xmin).toFixed(0)} × ${(ymax - ymin + 5).toFixed(0)} cm</b> y dibuja una cuadrícula de 5 cm con el origen O en el punto más bajo del loop.`,
      `Traza el círculo del loop: centro en <b>(0, ${cm(Ref).toFixed(1)})</b> y radio <b>${cm(S.R - S.ID / 2).toFixed(1)} cm</b> para el eje de la manguera. Sirve de molde un disco de cartón grueso.`,
      `Corta a lo largo, exactamente por la mitad, solo los <b>${cm(lLoop + 0.02).toFixed(0)} cm</b> del loop. Quita la mitad que mira hacia el centro del círculo.`,
      `Fija el loop con tacos que crecen de 0 a <b>${cm(dz).toFixed(0)} cm</b>, para que la salida pase por delante de la entrada sin chocar.`,
      `Arma la rampa recta a <b>${Math.round(deg(S.alpha))}°</b> hasta ${cm(Hbuild).toFixed(0)} cm, con una curva suave al llegar abajo. Sujétala con cinchos cada 8 cm.`,
      `Marca sobre la rampa los puntos de soltado del plano y suelta el balín desde el reposo con una tarjeta como compuerta. Graba en cámara lenta para Tracker.`
    ].map(t => `<li>${t}</li>`).join('');
  }

  // ---------- tabla ----------
  let tableRows = [];
  function renderTable() {
    const factors = [0.90, 0.95, 1.00, 1.03, 1.06, 1.10, 1.15, 1.20, 1.30];
    const hs = [...new Set(factors.map(f => Math.round(hTheo * f * 200) / 200))];
    tableRows = hs.map((h, i) => ({ n: i + 1, h, r: simulate(cfg({ h, record: false })) }));
    $('tbl').querySelector('tbody').innerHTML = tableRows.map(o => {
      const r = o.r, info = resultInfo(r);
      const res = r.result === 'completa' ? 'Completa' : (r.result === 'desprende' ? `Se despega a ${deg(r.detachPsi).toFixed(0)}°` : `Regresa a ${deg(r.maxPsi).toFixed(0)}°`);
      return `<tr data-h="${o.h}"${Math.abs(o.h - S.h) < 1e-4 ? ' class="cur"' : ''}><td>${o.n}</td><td>${(o.h * 100).toFixed(1)}</td><td>${(o.h / Ref).toFixed(2)}</td>` +
        `<td><span class="pill ${info.cls}">${res}</span></td><td>${r.result === 'completa' ? fmt(r.vTop, 2) : '—'}</td>` +
        `<td>${r.result === 'completa' ? fmt(r.nTop, 2) : '—'}</td><td>${fmt(r.W4 / (S.g * o.h) * 100, 1)} %</td></tr>`;
    }).join('');
    $('tblInfo').textContent = `R = ${(S.R * 100).toFixed(1)} cm (R − r = ${(Ref * 100).toFixed(2)} cm) · ${S.beta > 0 ? 'esfera que rueda' : 'partícula'} · μ = ${S.mu.toFixed(3)}`;
  }
  $('tbl').addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-h]'); if (!tr) return;
    location.hash = '#simulador'; showView('simulador');
    $('inH').value = (+tr.dataset.h * 100).toFixed(1); recompute(); play();
  });
  $('btnCopy').addEventListener('click', () => {
    const head = ['Ensayo', 'h (cm)', 'h/R', 'Resultado', 'v cima (m/s)', 'N cima/mg', 'Energía perdida (%)'];
    const lines = [head.join('\t')].concat(tableRows.map(o => [o.n, (o.h * 100).toFixed(1), (o.h / Ref).toFixed(2),
      o.r.result === 'completa' ? 'Completa' : (o.r.result === 'desprende' ? 'Se despega a ' + deg(o.r.detachPsi).toFixed(0) + '°' : 'Regresa'),
      o.r.result === 'completa' ? fmt(o.r.vTop, 2) : '-', o.r.result === 'completa' ? fmt(o.r.nTop, 2) : '-', fmt(o.r.W4 / (S.g * o.h) * 100, 1)].join('\t')));
    const btn = $('btnCopy');
    const done = (ok) => { btn.textContent = ok ? 'Tabla copiada' : 'Selecciona la tabla y cópiala'; setTimeout(() => btn.textContent = 'Copiar tabla', 2200); };
    const sel = () => { try { const rg = document.createRange(); rg.selectNode($('tbl')); const s = getSelection(); s.removeAllRanges(); s.addRange(rg); } catch (e) {} };
    try { navigator.clipboard.writeText(lines.join('\n')).then(() => done(true), () => { sel(); done(false); }); } catch (e) { sel(); done(false); }
  });

  // ---------- escena 3D ----------
  const vp = $('viewport'), labelsEl = $('labels');
  let renderer, scene, camera, controls, keyLight, glOK = false, dirty = true;
  let trackGroup, boardGroup, ball, gate, trail, trailPos, trailCount = 0, ballMark = null;
  let mats = {}, labels = [], view = '3d', fitInfo = null, follow = false, pendingFit = false;

  function initGL() {
    if (typeof THREE === 'undefined') { vp.insertAdjacentHTML('beforeend', '<div class="nogl">No se pudo cargar el motor 3D. Revisa tu conexión y recarga la página. La pizarra, el plano y la tabla siguen funcionando.</div>'); return; }
    try { renderer = new THREE.WebGLRenderer({ antialias: true }); }
    catch (e) { vp.insertAdjacentHTML('beforeend', '<div class="nogl">Tu navegador no tiene WebGL activo. La pizarra, el plano y la tabla siguen funcionando.</div>'); return; }
    glOK = true;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    vp.insertBefore(renderer.domElement, vp.firstChild);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(30, 1.6, 0.005, 20);
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.09; controls.minDistance = 0.06; controls.maxDistance = 4;
    controls.addEventListener('start', () => { if (follow) toggleFollow(false); });
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8f8a80, 0.75));
    keyLight = new THREE.DirectionalLight(0xffffff, 0.95);
    keyLight.castShadow = true; keyLight.shadow.mapSize.set(2048, 2048); keyLight.shadow.bias = -0.0004; keyLight.shadow.radius = 3;
    scene.add(keyLight, keyLight.target);
    const fill = new THREE.DirectionalLight(0xffffff, 0.35); fill.position.set(-1.2, 0.5, 0.8); scene.add(fill);
    mats.hose = new THREE.MeshPhysicalMaterial({ color: 0x86b8ea, transparent: true, opacity: 0.38, roughness: 0.1, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, side: THREE.DoubleSide, depthWrite: false });
    mats.edge = new THREE.LineBasicMaterial({ color: 0x1d68c4 });
    mats.ball = new THREE.MeshStandardMaterial({ color: 0xd2d7dc, metalness: 0.7, roughness: 0.2, map: ballTexture() });
    mats.trail = new THREE.LineBasicMaterial({ color: 0x1d68c4, transparent: true, opacity: 0.85 });
    mats.tie = new THREE.MeshStandardMaterial({ color: 0x1c2227, roughness: 0.6 });
    mats.block = new THREE.MeshStandardMaterial({ color: 0x8d7a5a, roughness: 0.85 });
    mats.gate = new THREE.MeshStandardMaterial({ color: 0xe86a3a, roughness: 0.5 });
    trackGroup = new THREE.Group(); boardGroup = new THREE.Group(); scene.add(trackGroup, boardGroup);
    trailPos = new Float32Array(3 * 5000);
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(trailPos, 3)); tg.setDrawRange(0, 0);
    trail = new THREE.Line(tg, mats.trail); scene.add(trail);
    gate = new THREE.Mesh(new THREE.BoxGeometry(0.0015, 0.026, 0.03), mats.gate); gate.castShadow = true; scene.add(gate);
    controls.addEventListener('change', () => { dirty = true; });
    new ResizeObserver(() => { resize(); if (pendingFit) setView(view); dirty = true; }).observe(vp);
    applyTheme();
  }
  function ballTexture() {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const x = cv.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, '#eef1f3'); g.addColorStop(1, '#a7aeb5'); x.fillStyle = g; x.fillRect(0, 0, 256, 128);
    x.fillStyle = '#e0602f'; x.fillRect(0, 58, 256, 12);
    const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; return t;
  }
  const col = (n) => new THREE.Color(css(n) || '#888').convertSRGBToLinear();
  function applyTheme() {
    if (!glOK) return;
    scene.background = new THREE.Color(css('--stage') || '#888');
    mats.hose.color = col('--hose'); mats.edge.color = col('--accent'); mats.trail.color = col('--accent'); mats.block.color = col('--block');
    if (sim) { rebuildScene(); renderPlan(); drawN(lastN); }
    dirty = true;
  }

  function frame3(tr, s) {
    const q = tr.at(s), tz = tr.dz / (TAU * Ref);
    const T = new THREE.Vector3(Math.cos(q.th), Math.sin(q.th), q.seg === 3 ? tz : 0).normalize();
    const N = new THREE.Vector3(-Math.sin(q.th), Math.cos(q.th), 0); N.addScaledVector(T, -N.dot(T)).normalize();
    return { q, T, N, B: new THREE.Vector3().crossVectors(T, N), p: new THREE.Vector3(q.x, q.y, q.z) };
  }
  function tubeGeometry(tr, sA, sB, radius, off, half) {
    const step = 0.003, radial = half ? 14 : 22, n = Math.max(2, Math.ceil((sB - sA) / step)), ring = radial + 1;
    const pos = new Float32Array((n + 1) * ring * 3), idx = [], edges = [[], []];
    for (let i = 0; i <= n; i++) {
      const F = frame3(tr, Math.min(sA + (sB - sA) * i / n, sB - 1e-7));
      const ax = F.p.clone().addScaledVector(F.N, off);
      for (let j = 0; j < ring; j++) {
        const ph = half ? Math.PI / 2 + Math.PI * j / radial : TAU * j / radial;
        const p = ax.clone().addScaledVector(F.N, radius * Math.cos(ph)).addScaledVector(F.B, radius * Math.sin(ph));
        pos.set([p.x, p.y, p.z], (i * ring + j) * 3);
        if (half && j === 0) edges[0].push(p.x, p.y, p.z);
        if (half && j === ring - 1) edges[1].push(p.x, p.y, p.z);
      }
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < ring - 1; j++) { const a = i * ring + j, b = a + ring; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    return { g, edges };
  }
  function own(o) { o.userData.own = true; return o; }
  function clearGroup(gr) {
    while (gr.children.length) {
      const o = gr.children.pop(); o.geometry && o.geometry.dispose();
      if (o.userData.own && o.material) for (const m of [].concat(o.material)) { m.map && m.map.dispose(); m.dispose(); }
    }
  }

  function rebuildScene() {
    if (!glOK || !sim) return;
    clearGroup(trackGroup); clearGroup(boardGroup);
    const tr = buildTrack(cfg({ h: Hbuild })), r = S.d / 2, rT = S.ID / 2 + 0.0007, off = Math.max(0, S.ID / 2 - r);
    const zb = -0.016; // cara del tablero
    for (const [a, b, half] of [[0, tr.s3, false], [tr.s3, tr.s4, true], [tr.s4, tr.s5, false]]) {
      const { g, edges } = tubeGeometry(tr, a, b, rT, off, half);
      const m = new THREE.Mesh(g, mats.hose); m.castShadow = true; trackGroup.add(m);
      if (half) for (const e of edges) { const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(e, 3)); trackGroup.add(new THREE.Line(lg, mats.edge)); }
    }
    // cinchos y tacos separadores
    const tieG = new THREE.TorusGeometry(rT + 0.0012, 0.0011, 6, 20), up = new THREE.Vector3(0, 0, 1);
    const addTie = (s) => { const F = frame3(tr, s); const t = new THREE.Mesh(tieG, mats.tie); t.position.copy(F.p.clone().addScaledVector(F.N, off)); t.quaternion.setFromUnitVectors(up, F.T); t.castShadow = true; trackGroup.add(t); };
    const addBlock = (s) => {
      const F = frame3(tr, s), ax = F.p.clone().addScaledVector(F.N, off), back = ax.z - rT, depth = back - zb;
      if (depth < 0.002) return;
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.014, depth), mats.block); b.position.set(ax.x, ax.y, zb + depth / 2); b.castShadow = true; b.receiveShadow = true; trackGroup.add(b);
    };
    for (let s = 0.03; s < tr.s3 - 0.02; s += 0.08) { addTie(s); addBlock(s); }
    for (let k = 0; k < 8; k++) addBlock(tr.s3 + (k + 0.5) / 8 * TAU * Ref);
    for (let s = tr.s4 + 0.04; s < tr.s5; s += 0.08) { addTie(s); addBlock(s); }
    // tablero cuadriculado
    const xmin = Math.floor((tr.x0 - 0.05) * 10) / 10, xmax = Math.ceil((L2 + 0.04) * 10) / 10, ymin = -0.03, ymax = Math.ceil((Hbuild + 0.05) * 10) / 10;
    const W = xmax - xmin, Hh = ymax - ymin;
    const cv = document.createElement('canvas'); cv.width = 2048; cv.height = Math.min(2048, Math.round(2048 * Hh / W));
    const cx = cv.getContext('2d'), sx = cv.width / W, sy = cv.height / Hh;
    cx.fillStyle = css('--board'); cx.fillRect(0, 0, cv.width, cv.height);
    for (let c = Math.ceil(xmin * 100); c <= xmax * 100; c++) { const major = c % 10 === 0; cx.strokeStyle = css(major ? '--board-major' : '--board-line'); cx.lineWidth = major ? 2.5 : 1; const X = (c / 100 - xmin) * sx; cx.beginPath(); cx.moveTo(X, 0); cx.lineTo(X, cv.height); cx.stroke(); }
    for (let c = Math.ceil(ymin * 100); c <= ymax * 100; c++) { const major = c % 10 === 0; cx.strokeStyle = css(major ? '--board-major' : '--board-line'); cx.lineWidth = major ? 2.5 : 1; const Y = cv.height - (c / 100 - ymin) * sy; cx.beginPath(); cx.moveTo(0, Y); cx.lineTo(cv.width, Y); cx.stroke(); }
    // círculo molde dibujado en el tablero
    cx.strokeStyle = css('--ink-3'); cx.lineWidth = 3; cx.setLineDash([14, 10]); cx.beginPath(); cx.arc((0 - xmin) * sx, cv.height - (Ref - ymin) * sy, (S.R - S.ID / 2) * sx, 0, TAU); cx.stroke(); cx.setLineDash([]);
    const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 8;
    const board = own(new THREE.Mesh(new THREE.BoxGeometry(W, Hh, 0.012), [
      new THREE.MeshStandardMaterial({ color: col('--wood'), roughness: .9 }), new THREE.MeshStandardMaterial({ color: col('--wood'), roughness: .9 }),
      new THREE.MeshStandardMaterial({ color: col('--wood'), roughness: .9 }), new THREE.MeshStandardMaterial({ color: col('--wood'), roughness: .9 }),
      new THREE.MeshStandardMaterial({ map: tex, roughness: .92 }), new THREE.MeshStandardMaterial({ color: col('--wood'), roughness: .9 })]));
    board.position.set(xmin + W / 2, ymin + Hh / 2, zb - 0.006); board.receiveShadow = true; boardGroup.add(board);
    const base = own(new THREE.Mesh(new THREE.BoxGeometry(W + 0.02, 0.014, 0.18), new THREE.MeshStandardMaterial({ color: col('--wood'), roughness: .85 })));
    base.position.set(xmin + W / 2, ymin - 0.007, zb + 0.07); base.receiveShadow = true; boardGroup.add(base);
    // luz y sombra ajustadas al tablero
    const ctr = new THREE.Vector3(xmin + W / 2, ymin + Hh / 2, 0);
    keyLight.position.copy(ctr).add(new THREE.Vector3(0.35, 0.9, 1.1)); keyLight.target.position.copy(ctr);
    const sc = keyLight.shadow.camera, ext = Math.max(W, Hh) * 0.75; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 0.1; sc.far = 4; sc.updateProjectionMatrix();
    // líneas de referencia
    const z = zb + 0.0012;
    const marks = [{ y: 2 * Ref, c: '--ink-3', txt: `2R = ${(2 * Ref * 100).toFixed(1)} cm (cima)`, dash: true }, { y: hTheo, c: '--s-ep', txt: `h mín. teórica ${(hTheo * 100).toFixed(1)} cm`, dash: true }];
    if (hSim) marks.push({ y: hSim, c: '--s-w', txt: `h mín. con pérdidas ${(hSim * 100).toFixed(1)} cm`, dash: true });
    marks.push({ y: S.h, c: '--accent', txt: `soltado h = ${(S.h * 100).toFixed(1)} cm`, dash: false });
    labels = [];
    for (const m of marks) {
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(xmin, m.y, z), new THREE.Vector3(xmax, m.y, z)]);
      const ln = own(new THREE.Line(g, m.dash ? new THREE.LineDashedMaterial({ color: col(m.c), dashSize: 0.01, gapSize: 0.007 }) : new THREE.LineBasicMaterial({ color: col(m.c) })));
      if (m.dash) ln.computeLineDistances(); boardGroup.add(ln);
      labels.push({ p: new THREE.Vector3(xmax - 0.005, m.y, z), html: `<i style="background:${css(m.c)}"></i>${m.txt}`, cls: 'tag', anchor: 'right' });
    }
    labels.push({ p: new THREE.Vector3(0, Ref, z), html: `R − r = ${(Ref * 100).toFixed(2)} cm`, cls: 'tag', anchor: 'center' });
    const rl = own(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, Ref, z), new THREE.Vector3(-Ref * Math.SQRT1_2, Ref + Ref * Math.SQRT1_2, z)]), new THREE.LineBasicMaterial({ color: col('--ink-2') })));
    boardGroup.add(rl);
    for (let c = 0; c <= Math.floor(ymax * 100); c += 10) labels.push({ p: new THREE.Vector3(xmin - 0.004, c / 100, zb), html: c + ' cm', cls: 'tag tick' });
    // balín y compuerta
    if (!ball || ball.userData.r !== r) {
      if (ball) { scene.remove(ball); ball.geometry.dispose(); }
      ball = new THREE.Mesh(new THREE.SphereGeometry(r, 40, 24), mats.ball); ball.userData.r = r; ball.castShadow = true; scene.add(ball);
    }
    const f0 = sim.frames[0];
    gate.userData.base = new THREE.Vector3(f0.x + (r + 0.0012) * Math.cos(S.alpha), f0.y - (r + 0.0012) * Math.sin(S.alpha), f0.z);
    gate.rotation.set(0, 0, -S.alpha); gate.position.copy(gate.userData.base);
    fitInfo = { cx: (xmin + xmax) / 2, cy: (ymin + ymax) / 2, w: W, h: Hh };
    labelsEl.innerHTML = '';
    for (const l of labels) { const el = document.createElement('span'); el.className = l.cls; el.innerHTML = l.html; labelsEl.appendChild(el); l.el = el; }
    ballMark = document.createElement('span'); ballMark.className = 'ballmark'; ballMark.setAttribute('aria-hidden', 'true'); labelsEl.appendChild(ballMark);
    if (!camera.userData.placed) { setView(view); camera.userData.placed = true; }
    placeBall(f0); dirty = true;
  }

  function updateLabels() {
    const w = vp.clientWidth, h = vp.clientHeight, v = new THREE.Vector3(), right = [];
    for (const l of labels) {
      v.copy(l.p).project(camera);
      const x = (v.x + 1) / 2 * w, y = (1 - v.y) / 2 * h, vis = v.z < 1 && x > -60 && x < w + 60 && y > 0 && y < h;
      l.el.style.display = vis ? '' : 'none';
      let tx = x;
      if (l.anchor === 'right') tx = Math.min(x, w - l.el.offsetWidth - 8);
      if (l.anchor === 'center') tx = x - l.el.offsetWidth / 2;
      l.el.style.left = tx + 'px'; l.y = y;
      if (l.anchor === 'right' && vis) right.push(l); else l.el.style.top = y + 'px';
    }
    right.sort((a, b) => b.y - a.y);
    let prev = Infinity;
    for (const l of right) { const y = Math.min(l.y, prev - 22); l.el.style.top = y + 'px'; prev = y; }
    if (ballMark && ball) { v.copy(ball.position).project(camera); ballMark.style.left = ((v.x + 1) / 2 * w) + 'px'; ballMark.style.top = ((1 - v.y) / 2 * h) + 'px'; }
  }
  function viewOffset(v, dist) {
    if (v === 'front') return new THREE.Vector3(0, 0, 1).multiplyScalar(dist);
    if (v === 'side') return new THREE.Vector3(0.95, 0.14, 0.3).normalize().multiplyScalar(dist * 0.85);
    return new THREE.Vector3(0.45, 0.28, 0.85).normalize().multiplyScalar(dist * 1.0);
  }
  function setView(v) {
    view = v; if (follow) toggleFollow(false);
    document.querySelectorAll('.view-btn').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === v ? 'true' : 'false'));
    if (!glOK || !fitInfo) return;
    // con el visor oculto (otra pestaña) no hay tamaño: se encuadra al volver a mostrarse
    pendingFit = !vp.clientWidth || !vp.clientHeight;
    if (pendingFit) return;
    const asp = vp.clientWidth / Math.max(1, vp.clientHeight), fov = camera.fov * Math.PI / 180;
    const dist = Math.max(fitInfo.h, fitInfo.w / asp) / 2 / Math.tan(fov / 2) * 1.2;
    const t = new THREE.Vector3(fitInfo.cx, fitInfo.cy, 0.01);
    camera.position.copy(t).add(viewOffset(v, dist)); controls.target.copy(t); camera.updateProjectionMatrix(); controls.update(); dirty = true;
  }
  function toggleFollow(on) {
    follow = on === undefined ? !follow : on;
    $('btnFollow').setAttribute('aria-pressed', follow ? 'true' : 'false');
    if (follow) document.querySelectorAll('.view-btn').forEach(b => b.setAttribute('aria-pressed', 'false'));
    dirty = true;
  }
  function resize() {
    if (!glOK) return;
    const w = vp.clientWidth, h = vp.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  // ---------- reproducción ----------
  let playing = false, playT = 0, speed = 0.5, lastTs = null;
  function frameAt(t) {
    const fr = sim.frames; let lo = 0, hi = fr.length - 1;
    if (t <= fr[0].t) return fr[0]; if (t >= fr[hi].t) return fr[hi];
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (fr[m].t <= t) lo = m; else hi = m; }
    const a = fr[lo], b = fr[hi], u = (t - a.t) / (b.t - a.t || 1), L = (k) => a[k] + (b[k] - a[k]) * u;
    return { t, s: L('s'), x: L('x'), y: L('y'), z: L('z'), v: L('v'), Nm: L('Nm'), W: L('W'), th: b.th, free: b.free, seg: b.seg };
  }
  function placeBall(f) {
    $('hudT').textContent = f.t.toFixed(3) + ' s';
    $('hudV').textContent = f.v.toFixed(2) + ' m/s';
    $('hudY').textContent = (f.y * 100).toFixed(1) + ' cm';
    $('hudN').textContent = f.free ? 'despegado' : (f.Nm / S.g).toFixed(2);
    updateEnergy(f);
    // posición en el loop
    let psi = null;
    if (!f.free && f.seg === 3 && sim) { const tr = sim.track; psi = deg((f.s - tr.s3) / Ref); lastN = [psi, f.Nm / S.g]; drawN(lastN); }
    else if (f.free) { lastN = null; drawN(null); }
    // paso destacado en la pizarra
    if (f.t === 0) highlight(null);
    else if (f.free) highlight('st4');
    else if (psi !== null && psi > 120 && psi < 240) highlight('st2');
    else if (f.seg === 4) highlight('st5');
    else if (f.seg <= 2) highlight('st3');
    if (!glOK || !ball) return;
    ball.position.set(f.x, f.y, f.z);
    if (S.beta > 0 && !f.free) ball.rotation.z = -f.s / (S.d / 2);
    dirty = true;
  }
  function resetPlayback() {
    playing = false; playT = 0; trailCount = 0; rotFrozen = null; lastN = null;
    if (trail) trail.geometry.setDrawRange(0, 0);
    if (gate && gate.userData.base) gate.position.copy(gate.userData.base);
    $('btnPlay').textContent = 'Soltar balín';
    if (sim) placeBall(sim.frames[0]);
    drawN(null); highlight(null);
    const info = resultInfo(sim);
    setStatus('idle', 'Predicción: ' + info.txt.charAt(0).toLowerCase() + info.txt.slice(1));
  }
  function play() {
    if (!sim) return;
    if (playT >= sim.frames[sim.frames.length - 1].t) { resetPlayback(); }
    playing = true; lastTs = null; $('btnPlay').textContent = 'Pausar';
    setStatus('idle', 'En recorrido…');
  }
  function pause() { playing = false; $('btnPlay').textContent = 'Continuar'; }
  function finish() { playing = false; $('btnPlay').textContent = 'Soltar de nuevo'; const info = resultInfo(sim); setStatus(info.cls, info.txt); }
  function tick(ts) {
    requestAnimationFrame(tick);
    if (!glOK) return;
    if (playing && sim) {
      if (lastTs !== null) playT += Math.min(0.05, (ts - lastTs) / 1000) * speed;
      lastTs = ts;
      const end = sim.frames[sim.frames.length - 1].t;
      if (playT >= end) { playT = end; finish(); }
      const f = frameAt(playT); placeBall(f);
      if (trailCount < 5000) { trailPos.set([f.x, f.y, f.z], trailCount * 3); trailCount++; trail.geometry.attributes.position.needsUpdate = true; trail.geometry.setDrawRange(0, trailCount); }
      // la compuerta se levanta al soltar
      if (gate.userData.base) gate.position.y = gate.userData.base.y + Math.min(0.04, playT * 0.6);
    }
    if (follow && ball) {
      controls.target.lerp(ball.position, 0.12);
      const want = ball.position.clone().add(viewOffset('3d', 0.32));
      camera.position.lerp(want, 0.08); dirty = true;
    }
    if (controls.update()) dirty = true;
    if (dirty && currentView === 'simulador') { renderer.render(scene, camera); updateLabels(); dirty = false; }
  }

  // ---------- eventos ----------
  let deb = null;
  const onInput = () => { readForm(); clearTimeout(deb); deb = setTimeout(recompute, 60); };
  $('form').addEventListener('input', onInput); $('form2').addEventListener('input', onInput); $('form2').addEventListener('change', onInput);
  $('form').addEventListener('submit', (e) => e.preventDefault());
  $('btnPlay').addEventListener('click', () => { playing ? pause() : play(); });
  $('btnReset').addEventListener('click', resetPlayback);
  document.querySelectorAll('.spd').forEach(b => b.addEventListener('click', () => {
    speed = +b.dataset.s; document.querySelectorAll('.spd').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
  }));
  document.querySelectorAll('.view-btn').forEach(b => b.addEventListener('click', () => setView(b.dataset.v)));
  $('btnFollow').addEventListener('click', () => toggleFollow());
  $('btnMore').addEventListener('click', () => {
    const open = $('more').hidden; $('more').hidden = !open; $('btnMore').setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  // pantalla completa de toda la app: la página ya cabe en una pantalla, así se quita la barra del navegador
  function toggleFull() {
    const el = document.documentElement;
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (el.requestFullscreen) el.requestFullscreen().catch(() => { $('btnFull').textContent = 'No disponible aquí'; });
      else $('btnFull').textContent = 'No disponible aquí';
    } catch (e) { $('btnFull').textContent = 'No disponible aquí'; }
  }
  $('btnFull').addEventListener('click', toggleFull);
  document.addEventListener('fullscreenchange', () => { $('btnFull').textContent = document.fullscreenElement ? 'Salir de pantalla completa' : 'Pantalla completa'; setTimeout(() => { resize(); setView(view); }, 80); });
  const setH = (h) => { if (!h) return; $('inH').value = (Math.ceil(h * 1000) / 10).toFixed(1); recompute(); play(); };
  $('qTheo').addEventListener('click', () => setH(hTheo));
  $('qSim').addEventListener('click', () => setH(hSim && hSim + 0.0005));
  $('qLow').addEventListener('click', () => setH(Ref * 2.35));
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  (mq.addEventListener ? mq.addEventListener('change', applyTheme) : mq.addListener(applyTheme));
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // ---------- tema claro / oscuro (el claro se ve mejor en proyector) ----------
  const curTheme = () => document.documentElement.dataset.theme || (mq.matches ? 'dark' : 'light');
  const themeLabel = () => { $('btnTheme').textContent = curTheme() === 'dark' ? 'Modo claro' : 'Modo oscuro'; };
  $('btnTheme').addEventListener('click', () => {
    const t = curTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('loop-theme', t); } catch (e) {}
    themeLabel();
  });
  (mq.addEventListener ? mq.addEventListener('change', themeLabel) : mq.addListener(themeLabel));
  themeLabel();

  // ---------- panel lateral: pizarra / energía ----------
  function selectSide(which) {
    const piz = which === 'pizarra';
    $('tabPizarra').setAttribute('aria-selected', piz ? 'true' : 'false');
    $('tabEnergia').setAttribute('aria-selected', piz ? 'false' : 'true');
    $('sidePizarra').hidden = !piz; $('sideEnergia').hidden = piz;
    $('zOut').parentElement.style.visibility = piz ? '' : 'hidden';
    if (piz && activeStep) scrollToStep($(activeStep));
  }
  $('tabPizarra').addEventListener('click', () => selectSide('pizarra'));
  $('tabEnergia').addEventListener('click', () => selectSide('energia'));
  $('estrip').addEventListener('click', () => selectSide('energia'));
  $('pizarra').addEventListener('click', (e) => {
    const st = e.target.closest('.step'); if (!st || getSelection().toString()) return;
    highlight(st.id === activeStep ? null : st.id);
  });
  let boardZoom = 1;
  try { boardZoom = Math.min(1.6, Math.max(0.8, +localStorage.getItem('loop-zoom') || 1)); } catch (e) {}
  const setZoom = (z) => {
    boardZoom = Math.round(Math.min(1.6, Math.max(0.8, z)) * 10) / 10;
    $('pizarra').style.setProperty('--bz', boardZoom);
    try { localStorage.setItem('loop-zoom', boardZoom); } catch (e) {}
  };
  $('zIn').addEventListener('click', () => setZoom(boardZoom + 0.1));
  $('zOut').addEventListener('click', () => setZoom(boardZoom - 0.1));
  setZoom(boardZoom);

  // ---------- pestañas (Simulador · Ensayos · Maqueta · Fuentes) ----------
  const VIEWS = ['simulador', 'ensayos', 'maqueta', 'fuentes'];
  let currentView = null;
  function showView(name) {
    if (!VIEWS.includes(name)) name = 'simulador';
    if (name === currentView) return;
    currentView = name;
    for (const v of VIEWS) $('view-' + v).hidden = v !== name;
    document.querySelectorAll('.tabs a').forEach(a => a.dataset.view === name ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
    dirty = true;
  }
  window.addEventListener('hashchange', () => showView(location.hash.slice(1)));
  showView(location.hash.slice(1));

  // ---------- teclado: también responde a los punteros de presentación (AvPág / RePág) ----------
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target, tag = t.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || t.isContentEditable) return;
    const k = e.key;
    if (k === 'f' || k === 'F') { toggleFull(); e.preventDefault(); return; }
    if (currentView !== 'simulador') return;
    if (k === ' ' && tag !== 'BUTTON' && tag !== 'A') { playing ? pause() : play(); e.preventDefault(); }
    else if (k === 'r' || k === 'R') resetPlayback();
    else if (k === 'ArrowRight' || k === 'PageDown') { stepBy(1); e.preventDefault(); }
    else if (k === 'ArrowLeft' || k === 'PageUp') { stepBy(-1); e.preventDefault(); }
  });

  // ---------- control externo (capturas para el informe) ----------
  window.__loopDemo = {
    seek(t) { playing = false; playT = t; trailCount = 0; if (!sim) return; for (const f of sim.frames) { if (f.t > t || trailCount >= 5000) break; trailPos.set([f.x, f.y, f.z], trailCount * 3); trailCount++; }
      if (trail) { trail.geometry.attributes.position.needsUpdate = true; trail.geometry.setDrawRange(0, trailCount); }
      const f = frameAt(t); placeBall(f); if (gate && gate.userData.base) gate.position.y = gate.userData.base.y + (t > 0 ? 0.04 : 0);
      const end = sim.frames[sim.frames.length - 1].t; if (t >= end) finish(); else setStatus('idle', 'En recorrido…'); dirty = true; },
    info() { return { frames: sim.frames.map(f => [f.t, f.s, f.y, f.v, f.Nm, f.W, f.free ? 1 : 0, f.seg]), loopN: sim.loopN, s3: sim.track.s3, s4: sim.track.s4, result: sim.result, hTheo, hSim, Ref, mass, detachPsi: sim.detachPsi }; },
    view: (v) => setView(v)
  };

  // ---------- arranque ----------
  initGL();
  recompute();
  if (glOK) { resize(); setView('3d'); requestAnimationFrame(tick); if (currentView === 'simulador' && !reduceMotion()) setTimeout(play, 800); }
})();
