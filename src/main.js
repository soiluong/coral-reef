import { SURF, NB, NP, COMMON, SCENE, CAUS, POST } from './shaders.js';
import { build, noiseTex } from './geo.js';
(async () => {
  const Q = new URLSearchParams(location.search), dev = Q.has('dev'), perf = Q.has('perf');
  const hud = document.getElementById('h'), cv = document.getElementById('c');
  // fullscreen: button (shown while the pointer is active), double-click, or F
  {
    const fb = document.getElementById('f'), de = document.documentElement, rq = de.requestFullscreen || de.webkitRequestFullscreen, ex = document.exitFullscreen || document.webkitExitFullscreen;
    if (rq) {
      const tog = () => { const p = document.fullscreenElement || document.webkitFullscreenElement ? ex.call(document) : rq.call(de); p && p.catch && p.catch(() => { }) };
      let h; const wake = () => { document.body.className = 'a'; clearTimeout(h); h = setTimeout(() => document.body.className = '', 2500) };
      fb.onclick = tog; addEventListener('dblclick', e => e.target != fb && tog()); addEventListener('keydown', e => (e.key == 'f' || e.key == 'F') && tog());
      addEventListener('pointermove', wake); addEventListener('pointerdown', wake); wake();
    } else fb.remove();
  }
  const dbg = m => { if (dev) fetch('/log', { method: 'POST', body: String(m) }).catch(() => { }) };
  const fail = m => { hud.textContent = m; dbg(m) };
  if (dev) { addEventListener('error', e => dbg('ERR ' + e.message + ' @' + e.lineno)); addEventListener('unhandledrejection', e => dbg('REJ ' + (e.reason && (e.reason.stack || e.reason.message) || e.reason))) }
  const ad = navigator.gpu && await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!ad) return fail('This reef needs WebGPU (Safari 26+, Chrome 113+).');
  const tsq = perf && ad.features.has('timestamp-query');
  const dv = await ad.requestDevice({ requiredFeatures: tsq ? ['timestamp-query'] : [] });
  dv.addEventListener('uncapturederror', e => dbg('GPU ' + e.error.message));
  const ctx = cv.getContext('webgpu'), fmt = navigator.gpu.getPreferredCanvasFormat();
  ctx.configure({ device: dv, format: fmt, alphaMode: 'opaque' });
  const HDR = 'rgba16float', U = GPUBufferUsage, TU = GPUTextureUsage;

  // ---------- data
  const seed = +Q.get('seed') || (Math.random() * 1e9 | 0) + 1;
  const T0 = performance.now();
  const geo = build(seed, SURF);
  dbg(`geo ${(performance.now() - T0) | 0}ms verts ${geo.sv.length / 12} tris ${geo.si.length / 3} fishv ${geo.fvv.length / 10} inst ${geo.inst.length / 16} seed ${seed}`);
  dbg('STAT ' + Object.entries(geo.stats).map(([k, v]) => `${k}:${v[0]}x${v[1] / v[0] | 0}=${v[1] / 1000 | 0}k`).join(' '));
  const buf = (d, u) => { const b = dv.createBuffer({ size: d.byteLength + 3 & ~3, usage: u | U.COPY_DST }); dv.queue.writeBuffer(b, 0, d); return b };
  const svb = buf(geo.sv, U.VERTEX), sib = buf(geo.si, U.INDEX), fvb = buf(geo.fvv, U.VERTEX), fib = buf(geo.fii, U.INDEX), fin = buf(geo.inst, U.VERTEX);
  const sni = geo.si.length, draws = geo.draws, nd = draws.length;
  const UB = new Float32Array(56), ubo = dv.createBuffer({ size: 224, usage: U.UNIFORM | U.COPY_DST });

  const mips = noiseTex(256);
  const nzT = dv.createTexture({ size: [256, 256], format: 'rgba8unorm', mipLevelCount: mips.length, usage: TU.TEXTURE_BINDING | TU.COPY_DST });
  mips.forEach((m, i) => dv.queue.writeTexture({ texture: nzT, mipLevel: i }, m, { bytesPerRow: (256 >> i) * 4 }, [256 >> i, 256 >> i]));
  const caT = dv.createTexture({ size: [256, 256], format: HDR, usage: TU.TEXTURE_BINDING | TU.RENDER_ATTACHMENT });
  const shD = { size: [2048, 2048], format: 'depth32float', usage: TU.TEXTURE_BINDING | TU.RENDER_ATTACHMENT | TU.COPY_SRC | TU.COPY_DST }, shT = dv.createTexture(shD), sh0 = dv.createTexture(shD);
  const smp = dv.createSampler({ addressModeU: 'repeat', addressModeV: 'repeat', magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear', maxAnisotropy: 4 });
  const shS = dv.createSampler({ compare: 'less', magFilter: 'linear', minFilter: 'linear' });
  const lin = dv.createSampler({ magFilter: 'linear', minFilter: 'linear' });

  // ---------- layouts / pipelines
  const VF = GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, FS = GPUShaderStage.FRAGMENT;
  const l0 = dv.createBindGroupLayout({ entries: [{ binding: 0, visibility: VF, buffer: {} }] });
  const l1 = dv.createBindGroupLayout({ entries: [{ binding: 0, visibility: VF, buffer: {} }, { binding: 1, visibility: FS, sampler: {} }, { binding: 2, visibility: FS, texture: {} }, { binding: 3, visibility: FS, texture: {} }, { binding: 4, visibility: FS, texture: { sampleType: 'depth' } }, { binding: 5, visibility: FS, sampler: { type: 'comparison' } }] });
  const l2 = dv.createBindGroupLayout({ entries: [{ binding: 0, visibility: FS, sampler: {} }, { binding: 1, visibility: FS, texture: {} }, { binding: 2, visibility: FS, texture: {} }] });
  const pl0 = dv.createPipelineLayout({ bindGroupLayouts: [l0] }), pl1 = dv.createPipelineLayout({ bindGroupLayouts: [l1] }), pl2 = dv.createPipelineLayout({ bindGroupLayouts: [l2] });
  const mod = (code, n) => { const m = dv.createShaderModule({ code }); if (dev) m.getCompilationInfo().then(i => i.messages.forEach(x => dbg(`WGSL ${n} ${x.type} L${x.lineNum}:${x.linePos} ${x.message} :: ${code.split('\n')[x.lineNum - 1].substr(Math.max(0, x.linePos - 80), 160)}`))); return m };
  const mS = mod(COMMON + SCENE, 'scene'), mC = mod(CAUS, 'caus'), mP = mod(POST, 'post');
  const sBuf = [{ arrayStride: 48, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'float32x3' }, { shaderLocation: 2, offset: 24, format: 'float32x4' }, { shaderLocation: 3, offset: 40, format: 'float32x2' }] }];
  const fBuf = [{ arrayStride: 40, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'float32x3' }, { shaderLocation: 2, offset: 24, format: 'float32x4' }] },
  { arrayStride: 64, stepMode: 'instance', attributes: [4, 5, 6, 7].map((l, i) => ({ shaderLocation: l, offset: i * 16, format: 'float32x4' })) }];
  const MS = 4, DF = 'depth24plus';
  const pipe = (layout, module, vs, fs, buffers, o = {}) => dv.createRenderPipeline({
    layout, vertex: { module, entryPoint: vs, buffers },
    fragment: fs ? { module, entryPoint: fs, targets: [{ format: o.fmt || HDR, blend: o.blend }] } : undefined,
    primitive: { topology: o.topo || 'triangle-list', cullMode: 'none' },
    depthStencil: o.depth === 0 ? undefined : { format: o.df || DF, depthWriteEnabled: o.dw !== 0, depthCompare: o.dc || 'less' },
    multisample: { count: o.ms || 1 }
  });
  const pCa = pipe(pl0, mC, 'v', 'f', [], { depth: 0 });
  const pSS = pipe(pl0, mS, 'vsS', 0, sBuf, { df: 'depth32float' }), pFS = pipe(pl0, mS, 'vfS', 0, fBuf, { df: 'depth32float' });
  const pSt = pipe(pl1, mS, 'vs', 'fs', sBuf, { ms: MS }), pFi = pipe(pl1, mS, 'vf', 'ff', fBuf, { ms: MS });
  const pBg = pipe(pl1, mS, 'vb', 'fb', [], { ms: MS, dw: 0, dc: 'less-equal' });
  const pJe = pipe(pl1, mS, 'vf', 'fj', fBuf, { ms: MS, dw: 0, blend: { color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'one', dstFactor: 'one' } } });
  const add = { color: { srcFactor: 'one', dstFactor: 'one' }, alpha: { srcFactor: 'one', dstFactor: 'one' } };
  const pPa = pipe(pl1, mS, 'vp', 'fp', [], { ms: MS, dw: 0, topo: 'triangle-strip', blend: add });
  const pD0 = pipe(pl2, mP, 'v', 'd0', [], { depth: 0 }), pDn = pipe(pl2, mP, 'v', 'dn', [], { depth: 0 }), pUp = pipe(pl2, mP, 'v', 'up', [], { depth: 0, blend: add }), pCm = pipe(pl2, mP, 'v', 'cm', [], { depth: 0, fmt });
  const bg0 = dv.createBindGroup({ layout: l0, entries: [{ binding: 0, resource: { buffer: ubo } }] });
  const bg1 = dv.createBindGroup({ layout: l1, entries: [{ binding: 0, resource: { buffer: ubo } }, { binding: 1, resource: smp }, { binding: 2, resource: nzT.createView() }, { binding: 3, resource: caT.createView() }, { binding: 4, resource: shT.createView() }, { binding: 5, resource: shS }] });

  // ---------- pass descriptors (reused every frame)
  const col = (view, load) => ({ view, loadOp: load ? 'load' : 'clear', storeOp: 'store', clearValue: [0, 0, 0, 1] });
  const caP = { colorAttachments: [col(caT.createView())] };
  const shP = { colorAttachments: [], depthStencilAttachment: { view: shT.createView(), depthLoadOp: 'load', depthStoreOp: 'store' } };
  const sh0P = { colorAttachments: [], depthStencilAttachment: { view: sh0.createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' } }, cpS = { texture: sh0 }, cpD = { texture: shT }, cpZ = [2048, 2048];
  let shInit = 0;
  const mainP = { colorAttachments: [{ view: null, resolveTarget: null, loadOp: 'clear', storeOp: 'discard', clearValue: [0, 0, 0, 1] }], depthStencilAttachment: { view: null, depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'discard' } };
  const NBL = 4, blP = [], blB = [], upP = [], upB = [];
  const cmP = { colorAttachments: [col(null)] };
  let cmB, W = 0, H = 0, tex = [];
  const resize = (w, h) => {
    W = cv.width = w; H = cv.height = h;
    for (const t of tex) t.destroy(); tex = [];
    const mk = (w, h, format, sampleCount, usage) => { const t = dv.createTexture({ size: [w, h], format, sampleCount, usage }); tex.push(t); return t.createView() };
    mainP.colorAttachments[0].view = mk(W, H, HDR, MS, TU.RENDER_ATTACHMENT);
    mainP.depthStencilAttachment.view = mk(W, H, DF, MS, TU.RENDER_ATTACHMENT);
    const hv = mainP.colorAttachments[0].resolveTarget = mk(W, H, HDR, 1, TU.RENDER_ATTACHMENT | TU.TEXTURE_BINDING);
    const bv = []; let bw = W, bh = H;
    for (let i = 0; i < NBL; i++) { bw = Math.max(1, bw >> (i ? 1 : 2)); bh = Math.max(1, bh >> (i ? 1 : 2)); bv[i] = mk(bw, bh, HDR, 1, TU.RENDER_ATTACHMENT | TU.TEXTURE_BINDING) }
    const bg = (a, b) => dv.createBindGroup({ layout: l2, entries: [{ binding: 0, resource: lin }, { binding: 1, resource: a }, { binding: 2, resource: b }] });
    for (let i = 0; i < NBL; i++) { blP[i] = { colorAttachments: [col(bv[i])] }; blB[i] = bg(i ? bv[i - 1] : hv, hv) }
    for (let i = 0; i < NBL - 1; i++) { upP[i] = { colorAttachments: [col(bv[NBL - 2 - i], 1)] }; upB[i] = bg(bv[NBL - 1 - i], hv) }
    cmB = bg(hv, bv[0]);
  };

  // ---------- static uniforms: sun + shadow matrix
  const nrm = (x, y, z) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l] };
  const SUN = nrm(.2, 1, -.1);
  {
    const C = [0, 3, -12], E = [C[0] + SUN[0] * 22, C[1] + SUN[1] * 22, C[2] + SUN[2] * 22], f = [-SUN[0], -SUN[1], -SUN[2]];
    const r = nrm(f[1] * -1 - f[2] * 0, f[2] * 0 - f[0] * -1, 0), u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    const hw = 25, rg = 44, d = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    UB.set([r[0] / hw, u[0] / hw, f[0] / rg, 0, r[1] / hw, u[1] / hw, f[1] / rg, 0, r[2] / hw, u[2] / hw, f[2] / rg, 0, -d(r, E) / hw, -d(u, E) / hw, -d(f, E) / rg, 1], 16);
    UB[36] = SUN[0]; UB[37] = SUN[1]; UB[38] = SUN[2];
  }

  // ---------- perf instrumentation
  const NF = +Q.get('n') || 1800, ft = new Float32Array(NF), gt = new Float32Array(NF), jt = new Float32Array(NF), sc = new Float32Array(NF);
  let fi = -90, gi = 0, last = 0, qs, qb, rb, rbFree = 1, rbPend = 0;
  if (tsq) {
    qs = dv.createQuerySet({ type: 'timestamp', count: 2 }); qb = dv.createBuffer({ size: 16, usage: U.QUERY_RESOLVE | U.COPY_SRC }); rb = dv.createBuffer({ size: 16, usage: U.COPY_DST | U.MAP_READ });
    caP.timestampWrites = { querySet: qs, beginningOfPassWriteIndex: 0 }; cmP.timestampWrites = { querySet: qs, endOfPassWriteIndex: 1 };
  }
  const onMap = () => { const a = new BigUint64Array(rb.getMappedRange()), d = Number(a[1] - a[0]) / 1e6; rb.unmap(); rbFree = 1; if (d > 0 && d < 1e3 && fi >= 0 && gi < NF) gt[gi++] = d };
  const stat = (a, n) => { if (!n) return 'n/a'; sc.set(a); const s = sc.subarray(0, n).sort(); let m = 0; for (let i = 0; i < n; i++)m += s[i]; return `avg ${(m / n).toFixed(2)}  p50 ${s[n >> 1].toFixed(2)}  p95 ${s[n * .95 | 0].toFixed(2)}  p99 ${s[Math.min(n - 1, n * .99 | 0)].toFixed(2)}  max ${s[n - 1].toFixed(2)} ms  (n=${n})` };
  const report = () => {
    let med; sc.set(ft); med = sc.slice().sort()[NF >> 1]; let late = 0; for (let i = 0; i < NF; i++)if (ft[i] > med * 1.5) late++;
    const r = `${W}x${H} msaa${MS}  ${bench ? 'BENCH (no vsync; interval = submit->GPU done)' : (1000 / med).toFixed(1) + ' Hz'}\nframe interval: ${stat(ft, NF)}\nlate frames (>1.5x median): ${late}\nJS per frame:   ${stat(jt, NF)}\nGPU (timestamp-query): ${tsq ? stat(gt, gi) : 'unsupported in this browser'}`;
    hud.textContent = r; fetch('/perf', { method: 'POST', body: r + '\n' + navigator.userAgent + '\n' }).catch(() => { });
  };

  // ---------- frame
  const tFix = Q.has('t') ? +Q.get('t') : -1, t0 = (seed % 997) * 3.1, fw = +Q.get('w'), fh = +Q.get('h'), CAP = 3456 * 2234, sub = [null];
  const bench = Q.get('perf') == 'bench'; let bsim = 0;
  let shots = Q.get('shots') ? Q.get('shots').split(',').map(Number) : null, si = 0, tNow = 0;
  const frame = now => {
    const js0 = perf ? performance.now() : 0;
    // size
    let w = fw || Math.round(cv.clientWidth * devicePixelRatio), h = fh || Math.round(cv.clientHeight * devicePixelRatio);
    if (w * h > CAP) { const k = Math.sqrt(CAP / (w * h)); w = Math.round(w * k); h = Math.round(h * k) }
    if (w < 1 || h < 1) return requestAnimationFrame(frame);
    if (w != W || h != H) resize(w, h);
    const t = tNow = shots ? shots[si] : tFix >= 0 ? tFix : t0 + now * .001;
    // camera
    const asp = W / H, th = Math.min(1.05, Math.max(.466, .34 / asp)), port = asp < 1 ? 1 : 0;
    const ex = Math.sin(t * .05) * .35 + port * .9, ey = 1.95 + Math.sin(t * .071) * .1 + port * .1, ez = 7.5 - port * .6;
    let fx = Math.sin(t * .037) * .5 + port * 5.5 - ex, fy = 1.5 + port * .45 - ey, fz = -10 - ez, l = Math.hypot(fx, fy, fz); fx /= l; fy /= l; fz /= l;
    let rx = -fz, rz = fx; l = Math.hypot(rx, rz); rx /= l; rz /= l;            // r = f x up
    const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;                    // u = r x f
    const P0 = 1 / (th * asp), P1 = 1 / th, nr = .15, fr = 160, A = fr / (nr - fr), Bz = nr * fr / (nr - fr);
    const re = rx * ex + rz * ez, ue = ux * ex + uy * ey + uz * ez, fe = fx * ex + fy * ey + fz * ez;
    UB[0] = P0 * rx; UB[4] = 0; UB[8] = P0 * rz; UB[12] = -P0 * re;
    UB[1] = P1 * ux; UB[5] = P1 * uy; UB[9] = P1 * uz; UB[13] = -P1 * ue;
    UB[2] = -A * fx; UB[6] = -A * fy; UB[10] = -A * fz; UB[14] = A * fe + Bz;
    UB[3] = fx; UB[7] = fy; UB[11] = fz; UB[15] = -fe;
    UB[32] = ex; UB[33] = ey; UB[34] = ez; UB[35] = t % 4096;
    UB[40] = W; UB[41] = H; UB[42] = th; UB[43] = asp;
    UB[44] = rx; UB[45] = 0; UB[46] = rz; UB[48] = ux; UB[49] = uy; UB[50] = uz; UB[52] = fx; UB[53] = fy; UB[54] = fz;
    dv.queue.writeBuffer(ubo, 0, UB);
    const enc = dv.createCommandEncoder();
    let p = enc.beginRenderPass(caP); p.setPipeline(pCa); p.setBindGroup(0, bg0); p.draw(3); p.end();
    if (!shInit) { shInit = 1; p = enc.beginRenderPass(sh0P); p.setBindGroup(0, bg0); p.setPipeline(pSS); p.setVertexBuffer(0, svb); p.setIndexBuffer(sib, 'uint32'); p.drawIndexed(sni); p.end() }
    enc.copyTextureToTexture(cpS, cpD, cpZ);
    p = enc.beginRenderPass(shP); p.setBindGroup(0, bg0);
    p.setPipeline(pFS); p.setVertexBuffer(0, fvb); p.setVertexBuffer(1, fin); p.setIndexBuffer(fib, 'uint32');
    for (let i = 0; i < nd; i++) { const d = draws[i]; if (d[4] != 10) p.drawIndexed(d[0], d[1], d[2], 0, d[3]) }
    p.end();
    p = enc.beginRenderPass(mainP); p.setBindGroup(0, bg1);
    p.setPipeline(pSt); p.setVertexBuffer(0, svb); p.setIndexBuffer(sib, 'uint32'); p.drawIndexed(sni);
    p.setPipeline(pFi); p.setVertexBuffer(0, fvb); p.setVertexBuffer(1, fin); p.setIndexBuffer(fib, 'uint32');
    for (let i = 0; i < nd; i++) { const d = draws[i]; if (d[4] != 10) p.drawIndexed(d[0], d[1], d[2], 0, d[3]) }
    p.setPipeline(pBg); p.draw(3);
    p.setPipeline(pJe);
    for (let i = 0; i < nd; i++) { const d = draws[i]; if (d[4] == 10) p.drawIndexed(d[0], d[1], d[2], 0, d[3]) }
    p.setPipeline(pPa); p.draw(4, NB + NP);
    p.end();
    for (let i = 0; i < NBL; i++) { p = enc.beginRenderPass(blP[i]); p.setPipeline(i ? pDn : pD0); p.setBindGroup(0, blB[i]); p.draw(3); p.end() }
    for (let i = 0; i < NBL - 1; i++) { p = enc.beginRenderPass(upP[i]); p.setPipeline(pUp); p.setBindGroup(0, upB[i]); p.draw(3); p.end() }
    cmP.colorAttachments[0].view = ctx.getCurrentTexture().createView();
    p = enc.beginRenderPass(cmP); p.setPipeline(pCm); p.setBindGroup(0, cmB); p.draw(3); p.end();
    if (tsq) { enc.resolveQuerySet(qs, 0, 2, qb, 0); if (rbFree) { enc.copyBufferToBuffer(qb, 0, rb, 0, 16); rbPend = 1 } }
    sub[0] = enc.finish(); dv.queue.submit(sub);
    if (rbPend) { rbPend = 0; rbFree = 0; rb.mapAsync(GPUMapMode.READ).then(onMap) }
    if (perf) {
      if (fi >= 0 && fi < NF) jt[fi] = performance.now() - js0;
      if (bench) return dv.queue.onSubmittedWorkDone().then(bnext);
      if (fi >= 0 && fi < NF) ft[fi] = now - last;
      last = now; if (++fi == NF) report();
    }
    if (shots) return shoot();
    requestAnimationFrame(frame);
  };
  const bnext = () => { const n = performance.now(); if (fi >= 0 && fi < NF) ft[fi] = n - last; last = n; if (++fi == NF) report(); if (fi <= NF) frame(bsim += 1000 / 120) };
  const shoot = () => cv.toBlob(async b => {
    await fetch(`/shot?n=${Q.get('name') || 's'}_${shots[si]}`, { method: 'POST', body: b }).catch(() => { });
    if (++si < shots.length) setTimeout(frame, 30, 0); else dbg('shots done ' + (Q.get('name') || 's'));
  });
  if (dev) { // when is each big animal in view?
    const I = geo.inst, s = [];
    for (const d of draws) if (d[4] >= 5 && d[4] <= 9) for (let i = 0; i < d[1]; i++) {
      const o = (d[3] + i) * 16; let on = 0, r = `m${d[4]}p${I[o + 14] | 0}:`;
      for (let t = 0; t < 700; t++) { const th = I[o + 11] + I[o + 12] * t, lx = I[o + 4] * Math.cos(th), lz = I[o + 5] * Math.sin(th), x = I[o] + lx * Math.cos(I[o + 3]) - lz * Math.sin(I[o + 3]), z = I[o + 2] + lx * Math.sin(I[o + 3]) + lz * Math.cos(I[o + 3]), v = Math.abs(x) < (7.5 - z) * .6 ? 1 : 0; if (v != on) { r += (v ? ' ' + t : '-' + t + '(z' + (z | 0) + ')'); on = v } }
      s.push(r);
    }
    dbg('BIG ' + s.join(' | '));
  }
  if (shots || bench) setTimeout(frame, 300, 0); else requestAnimationFrame(frame);
})();
