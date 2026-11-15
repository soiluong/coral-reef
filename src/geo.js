// Procedural geometry: terrain, corals, creatures. Runs once at init.
export function build(seed, SURF) {
  let sd = seed | 0;
  const R = () => { sd = sd + 0x6D2B79F5 | 0; let t = Math.imul(sd ^ sd >>> 15, 1 | sd); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 };
  const rr = (a, b) => a + R() * (b - a), pick = a => a[R() * a.length | 0];
  const sm = (a, b, x) => { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x) };
  const h2 = (x, y) => { let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + seed | 0; n = Math.imul(n ^ n >>> 13, 1274126177); return ((n ^ n >>> 16) >>> 0) / 4294967296 };
  const vn = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y); let fx = x - xi, fy = y - yi; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); const a = h2(xi, yi), b = h2(xi + 1, yi), c = h2(xi, yi + 1), d = h2(xi + 1, yi + 1); return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy };
  const fbm = (x, y, o) => { let s = 0, a = .5; for (let i = 0; i < o; i++) { s += a * vn(x, y); x = x * 2.03 + 17.1; y = y * 2.03 + 9.7; a *= .5 } return s / (1 - a * 2) };
  const mx = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

  // ---- terrain functions
  const BOM = [[-11, -17, 3.6, 3.2], [12, -24, 4.5, 4], [-3, -35, 5, 4.6], [22, -12, 5, 3.5], [-24, -28, 6, 5], [5, -48, 7, 6], [-16, -5, 3, 1.8]];
  const chan = z => Math.sin((z - 7.5) * .11) * 2.4;
  const bom = (x, z, k) => { let s = 0; for (const b of BOM) s += (k ? b[3] : 1) * Math.exp(-((x - b[0]) ** 2 + (z - b[1]) ** 2) / (b[2] * b[2])); return s };
  const reefM = (x, z) => {
    let v = fbm(x * .09 + 3, z * .09 + 7, 3) + .25 * sm(1.2, 6, Math.abs(x - chan(z))) - .08;
    v += .4 * Math.exp(-((x + 3.6) ** 2 + (z - 1.8) ** 2) / 7) + .4 * Math.exp(-((x - 3.4) ** 2 + (z - 2.2) ** 2) / 7) + .5 * bom(x, z, 0);
    return sm(.5, .68, v);
  };
  const H = (x, z) => {
    const m = reefM(x, z);
    return .4 * (fbm(x * .07, z * .07 + 40, 2) - .5) + m * (.3 + 1.3 * fbm(x * .16 + 9, z * .16, 3)) + m * .07 * (fbm(x * .9, z * .9, 1) - .5)
      + .01 * Math.max(0, Math.abs(x) - 8) ** 1.6 + bom(x, z, 1) * (.75 + .5 * fbm(x * .6, z * .6, 2));
  };

  // ---- builders
  const S = { V: new Float32Array(12 * 1.7e6), I: new Uint32Array(8e6), nv: 0, ni: 0 };
  const F = { V: new Float32Array(10 * 6e4), I: new Uint32Array(3e5), nv: 0, ni: 0 };
  let B = S;
  const tri = (a, b, c) => { const I = B.I; I[B.ni++] = a; I[B.ni++] = b; I[B.ni++] = c };
  const quad = (a, b, c, d) => { tri(a, b, c); tri(a, c, d) };
  let TX = 0, TY = 0, TZ = 0, TC = 1, TSn = 0, TS = 1, TSY = 1;
  const setT = (x, y, z, rot, s, sy = 1) => { TX = x; TY = y; TZ = z; TC = Math.cos(rot); TSn = Math.sin(rot); TS = s; TSY = sy };
  const vtx = (x, y, z, nx, ny, nz, c, sw, mt, ao) => {
    const V = S.V, o = S.nv * 12;
    V[o] = TX + (x * TC + z * TSn) * TS; V[o + 1] = TY + y * TS * TSY; V[o + 2] = TZ + (z * TC - x * TSn) * TS;
    V[o + 3] = nx * TC + nz * TSn; V[o + 4] = ny; V[o + 5] = nz * TC - nx * TSn;
    V[o + 6] = c[0]; V[o + 7] = c[1]; V[o + 8] = c[2]; V[o + 9] = sw * TS; V[o + 10] = mt; V[o + 11] = ao;
    return S.nv++;
  };
  const fv = (x, y, z, nx, ny, nz, u, v, pt, fl) => {
    const V = F.V, o = F.nv * 10;
    V[o] = x; V[o + 1] = y; V[o + 2] = z; V[o + 3] = nx; V[o + 4] = ny; V[o + 5] = nz; V[o + 6] = u; V[o + 7] = v; V[o + 8] = pt; V[o + 9] = fl;
    return F.nv++;
  };
  const _o = [0, 0, 0], _a = [0, 0, 0], _b = [0, 0, 0], _c = [0, 0, 0], _d = [0, 0, 0];
  const surf = (nu, nv, f, emit) => {
    const b = [], e = 2e-3;
    for (let j = 0; j <= nv; j++)for (let i = 0; i <= nu; i++) {
      const u = i / nu, v = j / nv, vv = Math.min(Math.max(v, .03), .97);
      f(u, v, _o); f(u + e, vv, _a); f(u - e, vv, _b); f(u, vv + e, _c); f(u, vv - e, _d);
      const ax = _a[0] - _b[0], ay = _a[1] - _b[1], az = _a[2] - _b[2], bx = _c[0] - _d[0], by = _c[1] - _d[1], bz = _c[2] - _d[2];
      const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx, l = Math.hypot(nx, ny, nz) || 1;
      b.push(emit(_o[0], _o[1], _o[2], nx / l, ny / l, nz / l, u, v));
    }
    for (let j = 0; j < nv; j++)for (let i = 0; i < nu; i++) { const p = j * (nu + 1) + i; quad(b[p], b[p + 1], b[p + nu + 2], b[p + nu + 1]) }
  };
  // tube along points P (flat xyz), radii rad[], ns sides. colours c0->c1, sway s0->s1 (quadratic), ao a0->a1
  const tube = (P, rad, ns, c0, c1, s0, s1, mt, a0, a1, cap) => {
    const n = P.length / 3, base = S.nv;
    const dx = P[3 * n - 3] - P[0], dy = P[3 * n - 2] - P[1], dz = P[3 * n - 1] - P[2];
    const ax = Math.abs(dx), ay = Math.abs(dy), az = Math.abs(dz);
    let rx = 0, ry = 0, rz = 0; if (ax <= ay && ax <= az) rx = 1; else if (az <= ay) rz = 1; else ry = 1;
    let tx, ty, tz;
    for (let i = 0; i < n; i++) {
      const i0 = Math.max(i - 1, 0) * 3, i1 = Math.min(i + 1, n - 1) * 3;
      tx = P[i1] - P[i0]; ty = P[i1 + 1] - P[i0 + 1]; tz = P[i1 + 2] - P[i0 + 2];
      let l = Math.hypot(tx, ty, tz) || 1; tx /= l; ty /= l; tz /= l;
      let b1x = ty * rz - tz * ry, b1y = tz * rx - tx * rz, b1z = tx * ry - ty * rx; l = Math.hypot(b1x, b1y, b1z) || 1; b1x /= l; b1y /= l; b1z /= l;
      const b2x = ty * b1z - tz * b1y, b2y = tz * b1x - tx * b1z, b2z = tx * b1y - ty * b1x;
      const f = i / (n - 1), c = mx(c0, c1, f), r = rad[i], sw = s0 + (s1 - s0) * f * f, ao = a0 + (a1 - a0) * f;
      for (let j = 0; j < ns; j++) {
        const a = j / ns * 6.2832, cs = Math.cos(a), sn = Math.sin(a), nx = b1x * cs + b2x * sn, ny = b1y * cs + b2y * sn, nz = b1z * cs + b2z * sn;
        vtx(P[i * 3] + nx * r, P[i * 3 + 1] + ny * r, P[i * 3 + 2] + nz * r, nx, ny, nz, c, sw, mt, ao);
      }
    }
    for (let i = 0; i < n - 1; i++)for (let j = 0; j < ns; j++) { const j1 = (j + 1) % ns, p = base + i * ns; quad(p + j, p + j1, p + ns + j1, p + ns + j) }
    if (cap) {
      const e = 3 * n - 3, r = rad[n - 1] * cap, t = vtx(P[e] + tx * r, P[e + 1] + ty * r, P[e + 2] + tz * r, tx, ty, tz, c1, s1, mt, a1), p = base + (n - 1) * ns;
      for (let j = 0; j < ns; j++)tri(p + j, p + (j + 1) % ns, t);
    }
  };

  // ---- palette
  const PK = [1, .28, .52], MG = [.85, .1, .5], PU = [.5, .2, .85], BL = [.22, .3, .95], OR = [1, .42, .06], YE = [1, .78, .08], LI = [.55, .9, .15], TE = [.08, .75, .62], RD = [.9, .09, .1], CR = [.95, .8, .58], LV = [.7, .55, .95], GN = [.2, .68, .28], RU = [.75, .3, .14], WH = [.85, .82, .76];

  // ---- corals (each returns approximate footprint radius)
  const stag = lod => {
    const [c, ct] = pick([[RU, CR], [BL, LV], [PK, WH], [YE, WH], [PU, PK], [TE, LI], [OR, YE], [RD, OR], [PK, CR], [OR, CR]]);
    const dp = lod > 1 ? 1 : lod ? 2 + (R() < .35) : 3 + (R() < .35), ns = lod > 1 ? 3 : lod ? 4 : 5, L2 = lod > 1 ? 1.7 : 1;
    const br = (x, y, z, dx, dy, dz, r, len, d) => {
      const ex = x + dx * len, ey = y + dy * len, ez = z + dz * len, j = len * .1;
      const f0 = d / dp, f1 = Math.max(0, (d - 1) / dp);
      tube([x, y, z, (x + ex) / 2 + rr(-j, j), (y + ey) / 2 + j, (z + ez) / 2 + rr(-j, j), ex, ey, ez], [r, r * .86, r * .72], ns,
        mx(ct, c, Math.min(1, f0 * 1.3)), mx(ct, c, f1), 0, 0, 2, .45 + .55 * (1 - f0), .45 + .55 * (1 - f1), d ? 0 : 1.3);
      if (d > 0) {
        const k = 2 + (R() < .45);
        for (let i = 0; i < k; i++) { let nx = dx + rr(-1, 1) * .8, ny = dy + rr(-.1, .7) + .1, nz = dz + rr(-1, 1) * .8; const l = Math.hypot(nx, ny, nz); br(ex, ey, ez, nx / l, ny / l, nz / l, r * .72, len * rr(.68, .92), d - 1) }
      }
    };
    const k = 3 + (R() * 3 | 0);
    for (let i = 0; i < k; i++) { const a = i / k * 6.28 + rr(-.4, .4), t = rr(.3, .9), l = Math.hypot(t, 1); br(0, 0, 0, Math.cos(a) * t / l, 1 / l, Math.sin(a) * t / l, .036 * L2, rr(.14, .2) * L2, dp) }
    return .45;
  };
  const table = lod => {
    const [c, ct] = pick([[OR, CR], [[.85, .5, .4], CR], [PU, LV], [PK, CR], [BL, LV], [RU, CR], [PK, WH], [MG, PK], [[.85, .62, .2], CR], [LV, WH]]);
    const n = 1 + (R() < .5) + (R() < .25);
    for (let q = 0; q < n; q++) {
      const R0 = rr(.4, .75) * (1 - q * .2), h = rr(.22, .4) + q * .2, nu = lod > 1 ? 9 : lod ? 16 : 40, nr = lod > 1 ? 2 : lod ? 4 : 8, ph = rr(0, 6), k = 3 + (R() * 3 | 0), ox = q ? rr(-.35, .35) : 0, oz = q ? rr(-.35, .35) : 0, th = .035;
      const rad = a => R0 * (1 + .1 * Math.sin(a * k + ph) + .04 * Math.sin(a * 7 + ph * 2));
      // top, rolled rim, underside in one lathe: v 0..0.6 top, 0.6..0.7 rim, 0.7..1 underside to stalk
      surf(nu, nr + (lod > 1 ? 2 : 6), (u, v, o) => {
        const a = u * 6.2832, Rm = rad(a); let r, y;
        if (v < .6) { const t = v / .6; r = Rm * t; y = h + .14 * R0 * t * t + .012 * R0 * Math.sin(t * 7 + a * 2) * t }
        else if (v < .72) { const t = (v - .6) / .12 * 3.1416; r = Rm + th * Math.sin(t); y = h + .14 * R0 - th * (1 - Math.cos(t)) }
        else { const t = (v - .72) / .28; r = .06 + (Rm - .06) * (1 - t) ** 1.7; y = (h + .14 * R0 - 2 * th) * (1 - t) ** .5 - .05 }
        o[0] = ox * Math.min(1, y / h + .2) + Math.cos(a) * r; o[2] = oz * Math.min(1, y / h + .2) + Math.sin(a) * r; o[1] = y
      }, (x, y, z, nx, ny, nz, u, v) => vtx(x, y, z, nx, ny, nz, v < .6 ? mx(c, ct, (v / .6) ** 3 * .7) : v < .72 ? mx(c, ct, .7) : mul(c, .7 - .25 * (v - .72) / .28), 0, 2, v < .72 ? .75 + .25 * v : .65 - .2 * (v - .72) / .28));
    }
    return .7;
  };
  const brain = lod => {
    const c = pick([[.55, .5, .2], [.7, .55, .25], [.35, .55, .3], [.6, .35, .5], [.75, .45, .2], [.4, .6, .55]]);
    const rx = rr(.22, .55), ry = rx * rr(.55, .85), rz = rx * rr(.8, 1.2), s = R() * 50, nu = lod > 1 ? 7 : lod ? 12 : 30, nv = lod > 1 ? 3 : lod ? 6 : 13;
    surf(nu, nv, (u, v, o) => { const a = u * 6.2832, la = v * 1.5708, cx = Math.cos(a) * Math.cos(la), cy = Math.sin(la), cz = Math.sin(a) * Math.cos(la), k = 1 + .25 * (fbm(cx * 2 + s, cz * 2 + cy * 2.5 + (u > .999 ? 0 : 0), 2) - .5); o[0] = cx * rx * k; o[1] = cy * ry * k - .03; o[2] = cz * rz * k },
      (x, y, z, nx, ny, nz, u, v) => vtx(x, y, z, nx, ny, nz, c, 0, 3, .5 + .5 * v));
    return rx * 1.1;
  };
  const rock = lod => {
    const c = pick([[.4, .36, .32], [.5, .42, .36], [.34, .34, .36]]);
    const r = rr(.2, .5), s = R() * 50;
    surf(lod ? 8 : 24, lod ? 5 : 12, (u, v, o) => { const a = u * 6.2832, la = (v - .35) * 2.4, cx = Math.cos(a) * Math.cos(la), cy = Math.sin(la), cz = Math.sin(a) * Math.cos(la), k = r * (1 + .5 * (fbm(cx * 1.5 + s, cz * 1.5 + cy * 2, 2) - .5)); o[0] = cx * k; o[1] = cy * k * .7; o[2] = cz * k },
      (x, y, z, nx, ny, nz, u, v) => vtx(x, y, z, nx, ny, nz, c, 0, 1, .5 + .5 * v));
    return r;
  };
  const fan = lod => {
    const c = pick([PU, RD, OR, YE, MG, PK, LV]), dp = lod > 1 ? 3 : lod ? 5 : 7, ns = lod ? 3 : 4;
    const br = (x, y, z, a, len, r, d) => {
      const ex = x + Math.sin(a) * len, ey = y + Math.cos(a) * len, ez = z + rr(-.015, .015);
      tube([x, y, z, ex, ey, ez], [r, r * .8], ns, c, d ? c : mx(c, WH, .35), y * y * .05, ey * ey * .05, 2, .6 + .3 * Math.min(y, 1), .6 + .3 * Math.min(ey, 1), 0);
      if (d > 0) { const a1 = Math.max(-1.35, a - rr(.2, .55)), a2 = Math.min(1.35, a + rr(.2, .55)); br(ex, ey, ez, a1, len * rr(.72, .9), r * .78, d - 1); br(ex, ey, ez, a2, len * rr(.72, .9), r * .78, d - 1); if (d > 2 && R() < .35) br(ex, ey, ez, a + rr(-.15, .15), len * .8, r * .78, d - 2) }
    };
    br(0, -.03, 0, rr(-.1, .1), lod > 1 ? .34 : .2, lod > 1 ? .04 : .024, dp);
    return .35;
  };
  const sponge = lod => {
    const c = pick([YE, PU, BL, OR, [.95, .35, .25], LV]), n = 3 + (R() * 4 | 0);
    for (let i = 0; i < n; i++) {
      const h = rr(.22, .6), r0 = rr(.05, .09), a = R() * 6.28, d = rr(0, .14), l = rr(.05, .32), lx = Math.cos(a) * l, lz = Math.sin(a) * l, bx = Math.cos(a) * d, bz = Math.sin(a) * d, rt = r0 * (.6 + .4 * Math.sin(2.2) + .25);
      surf(lod > 1 ? 5 : lod ? 8 : 16, lod > 1 ? 4 : lod ? 6 : 12, (u, v, o) => {
        const th = u * 6.2832; let y, r;
        if (v < .7) { const q = v / .7; y = q * h; r = r0 * (.6 + .4 * Math.sin(q * 2.2) + .25 * q) * (1 + .05 * Math.sin(th * 6 + q * 9)) } else { const q = (v - .7) / .3; y = h * (1 - q * .7); r = rt * (.6 - .25 * q) }
        o[0] = bx + y * lx + Math.cos(th) * r; o[1] = y - .02; o[2] = bz + y * lz + Math.sin(th) * r
      }, (x, y, z, nx, ny, nz, u, v) => vtx(x, y, z, nx, ny, nz, v < .66 ? mul(c, .6 + .4 * v / .7) : v < .72 ? mx(c, WH, .25) : mul(c, .16), 0, 2, v < .74 ? .5 + .5 * v / .7 : .35));
    }
    return .3;
  };
  const anems = [];
  const anem = lod => {
    const [c, tc] = pick([[[.7, .55, .3], [.9, .3, .7]], [[.35, .7, .4], [.7, .8, .5]], [[.65, .35, .7], [.8, .7, .85]], [[.8, .6, .45], [.3, .8, .5]]]), n = lod > 1 ? 12 : lod ? 38 : 140;
    surf(12, 4, (u, v, o) => { const a = u * 6.2832, la = v * 1.5708; o[0] = Math.cos(a) * Math.cos(la) * .2; o[1] = Math.sin(la) * .09 - .02; o[2] = Math.sin(a) * Math.cos(la) * .2 }, (x, y, z, nx, ny, nz) => vtx(x, y, z, nx, ny, nz, mul(c, .5), 0, 2, .5));
    for (let i = 0; i < n; i++) {
      const a = R() * 6.28, q = Math.sqrt(R()) * .19, l = rr(.1, .19), ca = Math.cos(a), sa = Math.sin(a), out = q / .19 * 1.1, bx = ca * q, bz = sa * q, by = .085 * Math.sqrt(1 - (q / .2) ** 2) - .02, P = [];
      for (let k = 0; k < 4; k++) { const t = k / 3, o = out * (t + .5 * t * t) * l; P.push(bx + ca * o + rr(-.01, .01), by + l * t * (1 - .25 * out * t), bz + sa * o + rr(-.01, .01)) }
      tube(P, lod > 1 ? [.02, .018, .017, .022] : lod ? [.014, .013, .012, .016] : [.011, .01, .0095, .013], lod ? 3 : 4, c, tc, 0, .055, 2, .55, 1, 1);
    }
    return .32;
  };
  const whips = lod => {
    const c = pick([RD, OR, YE, PK, MG, OR]), n = (lod > 1 ? 3 : 4) + (R() * (lod > 1 ? 3 : 6) | 0);
    for (let i = 0; i < n; i++) {
      const h = rr(.5, 1.25), a = R() * 6.28, d = rr(0, .12), P = []; let x = Math.cos(a) * d, z = Math.sin(a) * d, vx = Math.cos(a) * rr(0, .25), vz = Math.sin(a) * rr(0, .25);
      for (let k = 0; k < 6; k++) { P.push(x, h * k / 5 - .03, z); x += vx * h / 5; z += vz * h / 5; vx += rr(-.12, .12); vz += rr(-.12, .12) }
      tube(P, [.02, .017, .014, .011, .008, .004], lod ? 3 : 5, mul(c, .75), c, 0, h * h * .1, 2, .6, 1, 1);
    }
    return .25;
  };
  const grass = lod => {
    const n = lod ? 10 : 26;
    for (let i = 0; i < n; i++) {
      const h = rr(.2, .5), x0 = rr(-.3, .3), z0 = rr(-.3, .3), lx = rr(-.2, .2), lz = rr(-.2, .2), c = mx([.15, .5, .15], [.45, .75, .2], R()), P = [];
      for (let k = 0; k < 4; k++) { const t = k / 3; P.push(x0 + lx * t * t * h, h * t - .02, z0 + lz * t * t * h) }
      tube(P, [.008, .0075, .006, .003], 3, mul(c, .6), c, 0, h * .25, 2, .6, 1, 0);
    }
    return .3;
  };
  const fingers = lod => {
    const [c, ct] = pick([[LI, WH], [YE, CR], [LV, WH], [TE, LI], [PK, WH], [OR, YE]]), n = 6 + (R() * 9 | 0);
    for (let i = 0; i < n; i++) {
      const h = rr(.12, .42), r = rr(.028, .05), a = R() * 6.28, d = Math.sqrt(R()) * .25, x = Math.cos(a) * d, z = Math.sin(a) * d, lx = x * rr(.2, .9), lz = z * rr(.2, .9);
      tube([x, -.03, z, x + lx * .3, h * .4, z + lz * .3, x + lx * .7, h * .8, z + lz * .7, x + lx * .9, h * .94, z + lz * .9, x + lx * .97, h + r * .45, z + lz * .97, x + lx, h + r * .75, z + lz], [r, r * rr(1, 1.2), r * rr(.95, 1.15), r * rr(.95, 1.1), r * .82, r * .5], lod > 1 ? 4 : lod ? 6 : 11, mul(c, .7), mx(c, ct, .6), 0, 0, 2, .5, 1, .45);
    }
    return .32;
  };
  const cab = lod => {
    const c = pick([[.55, .85, .2], PK, [1, .5, .25], MG, [.95, .7, .15], OR, LV]), nk = lod > 1 ? 2 : 4;
    for (let k = 0; k < nk; k++) {
      const Rk = .46 * (1 - k / (nk + .6)), y0 = .03 * k, ph = R() * 6, tl = .45 + .35 * k, lb = 4 + (R() * 3 | 0), ox = rr(-.03, .03) * k, oz = rr(-.03, .03) * k;
      surf(lod > 1 ? 9 : lod ? 16 : 44, lod > 1 ? 2 : lod ? 3 : 7, (u, v, o) => { const a = u * 6.2832, r = Rk * (.22 + .78 * v) * (1 + .07 * v * Math.sin(a * lb + ph)) + .018 * v * v * Math.sin(a * 9 + ph * 2); o[0] = ox + Math.cos(a) * r; o[2] = oz + Math.sin(a) * r; o[1] = y0 + v ** 1.3 * Rk * tl * (1 + .15 * Math.sin(a * lb + ph + 1)) + .018 * v * v * Math.cos(a * 9 + ph * 2) - .02 },
        (x, y, z, nx, ny, nz, u, v) => vtx(x, y, z, nx, ny, nz, mx(mul(c, .8), mx(c, WH, .45), v ** 4), 0, 2, .55 + .45 * v));
    }
    return .45;
  };
  const star = () => {
    const c = pick([[.95, .3, .08], [.15, .25, .95], [.9, .1, .15], [.95, .6, .1]]);
    for (let i = 0; i < 5; i++) { const a = i / 5 * 6.2832 + .2, ca = Math.cos(a), sa = Math.sin(a); tube([0, .02, 0, ca * .06, .03, sa * .06, ca * .13, .02, sa * .13], [.04, .03, .012], 6, c, mul(c, 1.15), 0, 0, 2, .8, 1, 1) }
    return .15;
  };
  const urchin = () => {
    const c = [.05, .025, .09];
    surf(8, 5, (u, v, o) => { const a = u * 6.2832, la = (v - .5) * 3.1416; o[0] = Math.cos(a) * Math.cos(la) * .05; o[1] = .04 + Math.sin(la) * .04; o[2] = Math.sin(a) * Math.cos(la) * .05 }, (x, y, z, nx, ny, nz) => vtx(x, y, z, nx, ny, nz, c, 0, 2, .8));
    for (let i = 0; i < 46; i++) { const a = R() * 6.28, e = rr(-.2, 1.5), l = rr(.09, .15), dx = Math.cos(a) * Math.cos(e), dy = Math.sin(e), dz = Math.sin(a) * Math.cos(e); tube([dx * .04, .04 + dy * .03, dz * .04, dx * l, .04 + dy * l, dz * l], [.0045, .0008], 3, c, [.25, .15, .35], 0, 0, 2, .8, 1, 0) }
    return .15;
  };

  // ---- terrain mesh
  const NX = 300, NZ = 300, tb = S.nv;
  {
    const hs = new Float32Array((NX + 1) * (NZ + 1) * 3);
    for (let j = 0; j <= NZ; j++)for (let i = 0; i <= NX; i++) { const s = i / NX * 2 - 1, x = 46 * Math.sign(s) * Math.abs(s) ** 1.7, z = 9.5 - 86 * (j / NZ) ** 1.45, o = (j * (NX + 1) + i) * 3; hs[o] = x; hs[o + 1] = H(x, z); hs[o + 2] = z }
    const SA = [.72, .63, .46], RK = [.52, .43, .3];
    for (let j = 0; j <= NZ; j++)for (let i = 0; i <= NX; i++) {
      const o = (j * (NX + 1) + i) * 3, l = (j * (NX + 1) + Math.max(i - 1, 0)) * 3, r = (j * (NX + 1) + Math.min(i + 1, NX)) * 3, u = (Math.max(j - 1, 0) * (NX + 1) + i) * 3, d = (Math.min(j + 1, NZ) * (NX + 1) + i) * 3;
      const ax = hs[r] - hs[l], ay = hs[r + 1] - hs[l + 1], bz = hs[d + 2] - hs[u + 2], by = hs[d + 1] - hs[u + 1];
      // n = cross((0,by,bz),(ax,ay,0)) -> (-bz*ay... ) use heightfield normal
      let nx = -ay / ax, nz = -by / bz, ny = 1; const ln = Math.hypot(nx, ny, nz); nx /= ln; ny /= ln; nz /= ln;
      const m = reefM(hs[o], hs[o + 2]);
      const V = S.V, p = S.nv * 12; V[p] = hs[o]; V[p + 1] = hs[o + 1]; V[p + 2] = hs[o + 2]; V[p + 3] = nx; V[p + 4] = ny; V[p + 5] = nz;
      const c = mx(SA, RK, m); V[p + 6] = c[0]; V[p + 7] = c[1]; V[p + 8] = c[2]; V[p + 9] = 0; V[p + 10] = m; V[p + 11] = 1 - .3 * m; S.nv++;
    }
    for (let j = 0; j < NZ; j++)for (let i = 0; i < NX; i++) { const p = tb + j * (NX + 1) + i; quad(p, p + NX + 1, p + NX + 2, p + 1) }
  }

  // ---- placement
  const placed = [];
  const stats = {}; const put = (g, x, z, s, lod, sink = .04) => { const y = H(x, z); setT(x, y - sink * s, z, R() * 6.28, s, g == star ? .45 : 1); const n0 = S.ni; const r = g(lod) * s; const k = g.name + lod, e = stats[k] || (stats[k] = [0, 0]); e[0]++; e[1] += (S.ni - n0) / 3; placed.push(x, z, r); if (g == anem && s > .7) anems.push(x, y + .2 * s, z, s); return r };
  const free = (x, z, r) => { for (let i = 0; i < placed.length; i += 3) { const d = Math.hypot(placed[i] - x, placed[i + 1] - z); if (d < (placed[i + 2] + r) * .5) return 0 } return 1 };
  // heroes
  put(table, -2.9, 3.4, 1.35, 0); put(fan, 2.7, 3.9, 1.3, 0); put(anem, 1.55, 2.5, 1.25, 0); put(brain, -1.5, 2.1, .95, 0); put(stag, 3.9, 1.5, 1.4, 0);
  put(sponge, -4.3, 1.2, 1.35, 0); put(fingers, -2.3, .1, 1.2, 0); put(cab, 2.5, .2, 1.25, 0); put(stag, -3.6, 4.9, 1.1, 0); put(whips, 4.4, 3.4, 1.1, 0);
  put(star, -.7, 3.7, 1.2, 0); put(sponge, 3.4, 5.1, 1, 0); put(anem, -5.2, -1.5, 1.1, 0); put(fan, -3.4, -1.8, 1.4, 0); put(table, 4.6, -1.6, 1.5, 0);
  put(fingers, 1.9, 4.9, .8, 0); put(brain, .9, 3.5, .6, 0); put(cab, 2.3, 5.7, .8, 0); put(stag, 4.6, 4.6, 1.1, 0); put(table, 5.6, 2.6, 1.2, 0); put(fan, 5.2, 5.2, 1.1, 0); put(sponge, 3.3, 3, .9, 0); put(anem, 4.1, 5.9, .9, 0); put(brain, 5.9, 4.2, 1, 0); put(stag, -5.2, 3.3, 1.2, 0); put(cab, -4.4, 5.6, 1, 0); put(fingers, -5.9, 5, 1.1, 0);
  put(stag, 1.3, 4.3, .7, 0); put(anem, 2.2, 4.2, .9, 0); put(brain, .6, 4.9, .5, 0); put(star, 1.6, 5.3, 1.2, 0); put(fan, 2.9, 4.4, .8, 0); put(cab, .9, 2.9, .9, 0); put(fingers, 2.5, 3.3, .7, 0); put(urchin, 1.1, 5.6, 1.2, 0);
  put(anem, 1.75, 4.65, 1.1, 0); put(table, 2.45, 5.05, .55, 0); put(fan, 1.15, 3.7, .9, 0); put(sponge, 2.7, 3.9, .8, 0); put(cab, 1.45, 5.3, .7, 0); put(fingers, 2.05, 3.55, .8, 0); put(whips, .85, 4.45, .6, 0); put(cab, 3.1, 5.6, .8, 0); put(stag, 2.9, 4.9, .7, 0); put(brain, 2.1, 5.8, .45, 0); put(anem, 3.6, 4.4, .8, 0);
  const TYPES = [stag, table, brain, fan, sponge, fingers, cab, whips, stag, anem, fan, brain, whips, cab, fingers, sponge];
  for (let i = 0; i < 11400; i++) {
    const nr = i >= 9400, z = nr ? rr(3, 6.7) : i < 2200 || i >= 7200 ? rr(-7, 7) : 7 - R() ** 1.1 * 58, x = nr ? rr(-.5, 6) : rr(-1, 1) * (5.5 + (7.5 - z) * .7), d = Math.hypot(x, z - 7.5);
    if (d < (nr ? 1.1 : i >= 7200 ? 1.6 : 2.3)) continue;
    const m = reefM(x, z), lod = d < 9.5 ? 0 : d < 19 ? 1 : 2;
    let g, s = rr(.55, 1.15) * (1 + d * .012);
    const sml = i >= 7200;
    if (m > .5) { const zn = vn(x * .28 + 50, z * .28); g = R() < .04 ? rock : TYPES[((zn * 2.2 + R() * .45) * TYPES.length | 0) % TYPES.length]; if (g == table && lod > 1 && R() < .7) g = pick([brain, stag, fingers, cab]) }
    else if (m < .15 && R() < .16) { g = pick([star, urchin, grass, grass, rock, whips]); s *= .9 }
    else continue;
    if (sml) { if (m < (nr ? .12 : .3) || d > 12) continue; g = pick(nr ? [brain, fingers, rock, sponge, anem, stag, star, urchin, rock, fan] : [brain, fingers, cab, sponge, anem, stag, star, urchin]); s = nr ? rr(.18, .4) : rr(.28, .5) }
    const r0 = g == star || g == urchin ? .15 : g == brain || g == rock ? .4 : .38;
    if (!free(x, z, r0 * s)) continue;
    put(g, x, z, s, sml ? 1 : lod);
  }

  // ---- creatures (fish vertex format)
  B = F;
  const prof = (u, pa, pb, ped) => { const um = pa / (pa + pb), mxv = um ** pa * (1 - um) ** pb; let r = ped + (1 - ped) * (u ** pa * (1 - u) ** pb) / mxv; const un = .84; if (u > un) { const q = (u - un) / (1 - un); r *= Math.sqrt(Math.max(0, 1 - q * q)) } return r };
  const flat = (pts, tris, hz) => { // pts: [x,a,b,u,v,fl] in-plane (a=y or z)
    const b = pts.map(p => hz ? fv(p[0], p[2] || 0, p[1], 0, 1, 0, p[3], p[4], 1, p[5]) : fv(p[0], p[1], p[2] || 0, 0, 0, 1, p[3], p[4], 1, p[5]));
    for (let i = 0; i < tris.length; i += 3)tri(b[tris[i]], b[tris[i + 1]], b[tris[i + 2]]);
  };
  const mkFish = o => {
    const i0 = F.ni, NR = o.nr || 12, NS = 8, bl = o.bl || 1;
    const hh = u => o.H * prof(u, o.pa, o.pb, o.ped), ww = u => o.W * prof(u, o.pa, o.pb, o.ped * .45);
    const b0 = F.nv;
    for (let i = 0; i <= NR; i++) {
      const u = 1 - (1 - i / NR) ** 1.25, uc = Math.min(Math.max(u, .004), .993), e = .003, h = hh(uc), w = ww(uc), dh = (hh(uc + e) - hh(uc - e)) / (2 * e), dw = (ww(uc + e) - ww(uc - e)) / (2 * e);
      for (let j = 0; j < NS; j++) {
        const a = j / NS * 6.2832, s = Math.sin(a), c = Math.cos(a); let nx = -(dh * w * s * s + dw * h * c * c), ny = w * s, nz = h * c; const l = Math.hypot(nx, ny, nz) || 1;
        fv(u - .5, hh(u) * s * (s < 0 ? bl : 1), ww(u) * c, nx / l, ny / l, nz / l, u, s, 0, 1 - u);
      }
    }
    for (let i = 0; i < NR; i++)for (let j = 0; j < NS; j++) { const j1 = (j + 1) % NS, p = b0 + i * NS; quad(p + j, p + j1, p + NS + j1, p + NS + j) }
    const pH = o.ped * o.H, tl = o.tl, tt = o.th, tb = o.thb || o.th, fk = o.fk, hz = o.hz, fd = o.fd || 0;
    // tail
    if (!o.nt) flat([[-.47, 0, 0, .03, 0, 1], [-.46, pH * (hz ? .5 : 1), 0, .04, 1, 1], [-.5 - tl * (hz ? 1.35 : 1), tt, fd, -tl, 1 + tt / o.H, 1.45], [-.5 - tl * fk, 0, fd * .3, -tl * fk, 0, 1.3], [-.5 - tl * (tb < tt ? .8 : hz ? 1.35 : 1), -tb, fd, -tl, -1 - tb / o.H, 1.45], [-.46, -pH * (hz ? .5 : 1), 0, .04, -1, 1],
    [-.5 - tl * .55, tt * .62, fd * .5, -tl * .5, 1.3, 1.25], [-.5 - tl * .5, -tb * .62, fd * .5, -tl * .5, -1.3, 1.25]], [0, 1, 6, 0, 6, 3, 6, 2, 3, 0, 3, 7, 7, 3, 4, 0, 7, 5], hz);
    // dorsal / anal fins
    const strip = (u0, u1, dh, sgn, pk, swp) => {
      const n = 12, pts = [], tr = [];
      for (let i = 0; i <= n; i++) { const s = i / n, u = u1 + (u0 - u1) * s, sh = pk ? (s < pk ? s / pk : (1 - s) / (1 - pk)) ** .8 : Math.sin(Math.PI * s) ** .55, yb = hh(u) * .92 * (sgn < 0 ? bl : 1); pts.push([u - .5, sgn * yb, 0, u, sgn, 1 - u], [u - .5 - swp * dh * sh * (1 + .25 * s), sgn * (yb + dh * sh), 0, u, sgn * (1 + sh), 1 - u + swp * dh * sh]); if (i < n) tr.push(i * 2, i * 2 + 1, i * 2 + 3, i * 2, i * 2 + 3, i * 2 + 2) }
      flat(pts, tr);
    };
    for (const d of o.fins || []) strip(d[0], d[1], d[2], d[3], d[4], d[5] || .5);
    // pectorals
    const pl = o.pl || .12, up = o.pu || .68, py = -hh(up) * .35 * bl, pz = ww(up) * .9;
    if (!o.nt) for (const sg of [-1, 1]) {
      const b = F.nv, n = 4, pd = o.pd || .4, po = o.po || .6;
      for (let i = 0; i <= n; i++) { const t = i / n, cx = up - .5 - pl * (.5 * t + .4 * t * t), cy = py - pl * pd * t, cz = sg * (pz + pl * po * t), hw = pl * (.17 * (1 - t) ** .7 + .012); fv(cx + hw, cy, cz, 0, .7, sg * .7, up, -1.25 - .55 * t, 1, 1 - up + pl * t); fv(cx - hw, cy - pl * .03, cz, 0, .7, sg * .7, up, -1.25 - .55 * t, 1, 1 - up + pl * t); if (i) quad(b + i * 2 - 2, b + i * 2 - 1, b + i * 2 + 1, b + i * 2) }
    }
    // eyes
    const ue = o.ue || .87, er = o.er || .022, ey = hh(ue) * (o.ey || .3), ez = ww(ue) * Math.sqrt(1 - (o.ey || .3) ** 2) * .96;
    for (const sg of [-1, 1]) { const c = fv(ue - .5, ey, sg * (ez + er * .55), 0, 0, sg, ue, 0, 2, 0), b = F.nv; for (let j = 0; j < 8; j++) { const a = j / 8 * 6.2832; fv(ue - .5 + Math.cos(a) * er, ey + Math.sin(a) * er, sg * (ez - er * .15), Math.cos(a) * .6, Math.sin(a) * .6, sg * .5, ue, 1, 2, 0) } for (let j = 0; j < 8; j++)tri(c, b + j, b + (j + 1) % 8) }
    return [i0, F.ni - i0];
  };
  const ME = [];
  ME[0] = mkFish({ H: .19, W: .075, pa: 1.1, pb: .75, ped: .2, tl: .2, th: .19, fk: .5, fins: [[.3, .78, .09, 1], [.22, .5, .07, -1]], er: .028 });
  ME[1] = mkFish({ H: .33, W: .06, pa: 1, pb: .8, ped: .13, tl: .16, th: .17, fk: .8, fins: [[.08, .8, .1, 1], [.1, .62, .09, -1]], pl: .14 });
  ME[2] = mkFish({ H: .34, W: .06, pa: 1, pb: .85, ped: .13, tl: .15, th: .16, fk: .8, fins: [[.3, .72, .62, 1, .78, 1.15], [.08, .34, .09, 1], [.1, .6, .16, -1, .6, .4]], pl: .12, ue: .86 });
  ME[3] = mkFish({ H: .085, W: .055, pa: 1.3, pb: 1, ped: .25, tl: .15, th: .14, fk: .35, fins: [[.38, .52, .07, 1, .7], [.2, .3, .05, 1, .7], [.2, .32, .05, -1, .7]], pl: .08, er: .016 });
  ME[4] = mkFish({ H: .2, W: .11, pa: .9, pb: .5, ped: .3, tl: .15, th: .17, fk: .88, fins: [[.15, .8, .055, 1], [.15, .45, .05, -1]], pl: .16, er: .02, ue: .85 });
  ME[5] = mkFish({ nr: 22, H: .085, W: .075, pa: 1.3, pb: .8, ped: .16, bl: .8, tl: .2, th: .21, thb: .1, fk: .3, fins: [[.5, .68, .15, 1, .72, .7], [.16, .23, .04, 1, .7, .6], [.18, .25, .035, -1, .7, .6], [.34, .42, .05, -1, .7, .6]], pl: .22, pd: .55, po: .75, pu: .66, er: .009, ue: .9 });
  // cetacean flukes + flippers (solid, curved)
  const cet = (m, py, pz, L, fw, fl, pu, beak) => {
    for (const sg of [-1, 1]) {
      surf(10, 8, (u, v, o) => { const a = u * 6.2832, c = fw * .42 * (1 - v) ** .75 + .01 * fw / .31; o[0] = -.5 - .02 - fl * v ** 1.4 + Math.cos(a) * c * .5 - .02 * Math.sin(v * 3.14); o[1] = Math.sin(a) * (.014 * (1 - v) + .003) * fw / .31; o[2] = sg * (.01 + fw * v) }, (x, y, z, nx, ny, nz, u, v) => fv(x, y, z, nx, ny, nz, x + .5, 1 + v, 1, 1 + v * .45));
      surf(10, 8, (u, v, o) => { const a = u * 6.2832, c = L * .42 * Math.sin(3.1416 * Math.min(1, v * .9 + .1)) ** .8 * (1 - v) ** .3 + .001; o[0] = pu - .5 - L * (.2 * v + .75 * v * v) + Math.cos(a) * c * .5; o[1] = py - L * (sg > 0 ? .55 : .15) * v + Math.sin(a) * L * .012 * (1 - v); o[2] = sg * (pz + L * .75 * v) }, (x, y, z, nx, ny, nz, u, v) => fv(x, y, z, nx, ny, nz, pu, -1.3 - .5 * v, 1, 1 - pu + v * .2));
    }
    if (beak) surf(8, 4, (u, v, o) => { const a = u * 6.2832, r = .024 * (1 - v * .6) * Math.sqrt(1 - v * v * .9); o[0] = .45 + .11 * v; o[1] = -.018 + Math.sin(a) * r * .8; o[2] = Math.cos(a) * r }, (x, y, z, nx, ny, nz, u, v) => fv(x, y, z, nx, ny, nz, .97, Math.sin(u * 6.2832) - .2, 0, 0));
    ME[m][1] = F.ni - ME[m][0];
  };
  ME[6] = mkFish({ nr: 18, H: .1, W: .085, pa: 1.2, pb: .5, ped: .13, tl: .1, th: .15, fk: .55, hz: 1, fins: [[.42, .58, .11, 1, .75, 1.1]], pl: .14, pd: .5, er: .008, ue: .86, ey: .05, nt: 1 });
  cet(6, -.1 * prof(.68, 1.2, .5, .13) * .4, .085 * prof(.68, 1.2, .5, .06) * .85, .15, .17, .13, .68, 1);
  ME[7] = mkFish({ nr: 30, H: .1, W: .1, pa: .95, pb: .42, ped: .24, bl: 1.25, tl: .19, th: .3, fk: .5, hz: 1, fins: [[.28, .35, .022, 1, .6, .8]], pl: .27, pd: .75, po: .45, pu: .66, er: .0055, ue: .8, ey: -.32, nt: 1 });
  cet(7, -.1 * prof(.66, .95, .42, .1) * .44, .1 * prof(.66, .95, .42, .108) * .85, .21, .31, .22, .66);
  ME[11] = mkFish({ nr: 24, H: .075, W: .1, pa: 1.05, pb: .36, ped: .14, bl: .9, tl: .2, th: .2, thb: .12, fk: .35, fins: [[.42, .58, .1, 1, .7, .8], [.2, .27, .04, 1, .7, .6], [.2, .27, .035, -1, .7, .6]], pl: .2, pd: .5, po: .8, pu: .68, er: .006, ue: .93, ey: .1 });
  // manta
  {
    const i0 = F.ni;
    for (const sg of [1, -1]) surf(36, 12, (u, v, o) => { const s = u * 2 - 1, as = Math.min(1, Math.abs(s)), ch = .46 * (1 - as ** 1.1) + .008, le = .24 - .34 * as ** 1.25; o[0] = le - v * ch; o[1] = sg * ((sg > 0 ? .11 : .05) * Math.exp(-as * as * 6) + .025 * (1 - as) ** 1.5 + .003) * Math.sin(Math.PI * v ** .65) ** .8 + .02 * as * as; o[2] = s * .62 },
      (x, y, z, nx, ny, nz, u, v) => fv(x, y, z, nx, ny, nz, v, sg, 0, Math.abs(u * 2 - 1) ** 1.5));
    // tail (thin tapered) + cephalic lobes
    surf(4, 5, (u, v, o) => { const a = u * 6.2832, r = .006 * (1 - v) + .0008; o[0] = -.2 - .26 * v; o[1] = .012 + Math.sin(a) * r - .03 * v * v; o[2] = Math.cos(a) * r + .02 * Math.sin(v * 3) }, (x, y, z, nx, ny, nz) => fv(x, y, z, nx, ny, nz, 1, 1, 3, 0));
    for (const sg of [-1, 1]) surf(6, 3, (u, v, o) => { const a = u * 6.2832; o[0] = .2 + .1 * v; o[1] = -.005 - .035 * v * v + Math.sin(a) * .02 * (1 - v * .75); o[2] = sg * (.07 - .045 * v * v) + Math.cos(a) * .006 * (1 - v * .5) }, (x, y, z, nx, ny, nz) => fv(x, y, z, nx, ny, nz, .93, -1, 0, 0));
    ME[8] = [i0, F.ni - i0];
  }
  // turtle
  {
    const i0 = F.ni;
    surf(16, 9, (u, v, o) => { const a = u * 6.2832, la = (v - .5) * 3.1416, sl = Math.sin(la); o[0] = .5 * Math.cos(la) * Math.cos(a) * (1 + .1 * Math.cos(a)); o[2] = .4 * Math.cos(la) * Math.sin(a); o[1] = sl * (sl > 0 ? .21 : .11) },
      (x, y, z, nx, ny, nz, u, v) => fv(x, y, z, nx, ny, nz, x + .5, z * 2.2, 0, v < .47 ? -1 : 0));
    surf(10, 6, (u, v, o) => { const a = u * 6.2832, la = (v - .5) * 3.1416; o[0] = .62 + .17 * Math.cos(la) * Math.cos(a); o[2] = .095 * Math.cos(la) * Math.sin(a); o[1] = .03 + .085 * Math.sin(la) },
      (x, y, z, nx, ny, nz, u, v) => fv(x, y, z, nx, ny, nz, u * 1.6, v * 1.6, 3, 0));
    for (const sg of [-1, 1]) {
      const c = fv(.7, .06, sg * .088, 0, 0, sg, 0, 0, 2, 0), b = F.nv; for (let j = 0; j < 8; j++) { const a = j / 8 * 6.2832; fv(.7 + Math.cos(a) * .013, .06 + Math.sin(a) * .013, sg * .082, Math.cos(a) * .6, Math.sin(a) * .6, sg * .5, 0, 1, 2, 0) } for (let j = 0; j < 8; j++)tri(c, b + j, b + (j + 1) % 8);
      const fl = (sx, sz, dx, dz, w, amp, sw) => surf(8, 6, (u, v, o) => { const a = u * 6.2832, wd = w * Math.sin(3.1416 * (v * .9 + .1)) ** .8; o[0] = sx + dx * v - sw * v * v + Math.cos(a) * wd * .5; o[1] = -.02 + Math.sin(a) * .016; o[2] = sg * (sz + dz * v) },
        (x, y, z, nx, ny, nz, u, v) => fv(x, y, z, nx, ny, nz, v * 1.6, Math.cos(u * 6.2832) * .5, 3, amp * v ** 1.3));
      fl(.3, .3, -.1, .62, .24, .55, .34); fl(-.34, .2, -.2, .14, .2, .15, .05);
    }
    ME[9] = [i0, F.ni - i0];
  }
  // jellyfish (axis +x)
  {
    const i0 = F.ni;
    surf(26, 8, (u, v, o) => { const a = v * 1.6, t = u * 6.2832, r = .4 * Math.sin(a) * (1 + .03 * Math.sin(t * 8) * v); o[0] = .3 * Math.cos(a); o[1] = r * Math.cos(t); o[2] = r * Math.sin(t) },
      (x, y, z, nx, ny, nz, u, v) => fv(x, y, z, nx, ny, nz, u, v, 0, v));
    const rib = (y0, z0, len, w, wav) => { const n = 9, a = Math.atan2(z0, y0), b = []; for (let i = 0; i <= n; i++) { const t = i / n, x = .02 - len * t, k = 1 - .35 * t + wav * Math.sin(t * 9 + a * 3), y = y0 * k, z = z0 * k, wx = -Math.sin(a) * w, wz = Math.cos(a) * w; b.push(fv(x, y + wx, z + wz, Math.cos(a), 0, Math.sin(a), t, 1, 1, 1 + t * 1.2), fv(x, y - wx, z - wz, Math.cos(a), 0, Math.sin(a), t, 1, 1, 1 + t * 1.2)) } for (let i = 0; i < n; i++)quad(b[i * 2], b[i * 2 + 1], b[i * 2 + 3], b[i * 2 + 2]) };
    for (let i = 0; i < 14; i++) { const a = i / 14 * 6.2832; rib(Math.cos(a) * .39, Math.sin(a) * .39, rr(.8, 1.6), .006, .13) }
    for (let i = 0; i < 4; i++) { const a = i / 4 * 6.2832 + .4; rib(Math.cos(a) * .09, Math.sin(a) * .09, rr(.7, 1), .035, .3) }
    ME[10] = [i0, F.ni - i0];
  }

  // ---- instances
  sd = Math.imul(seed, 2654435761) | 0;
  const FR = ME.map(() => []);
  const inst = (m, cx, cy, cz, yaw, Rx, Rz, kz, phz, yA, ky, phy, th, w, sc, pat, mode) => FR[m].push(cx, cy, cz, yaw, Rx, Rz, kz, phz, yA, ky, phy, th, w, sc, pat + R() * .98, mode + R() * .98);
  const clr = (cx, cz, yaw, Rx, Rz, kz, phz) => { let g = -9; for (let i = 0; i < 16; i++) { const th = i / 16 * 6.2832, lx = Rx * Math.cos(th), lz = Rz * Math.sin(th * kz + phz), x = cx + lx * Math.cos(yaw) - lz * Math.sin(yaw), z = cz + lx * Math.sin(yaw) + lz * Math.cos(yaw); g = Math.max(g, H(x, z) + reefM(x, z) * 1.1 + .3) } return g };
  const gs = () => (R() + R() + R() - 1.5) * .8;
  const spot = (z0, z1, mm = .6) => { for (let i = 0; i < 200; i++) { const z = rr(z0, z1), x = rr(-1, 1) * (2 + (7.5 - z) * .55); if (reefM(x, z) > mm || i > 190) return [x, z] } };
  const cloud = (m, pat, n, cx, cz, rad, hgt, v, s0, s1) => {
    for (let i = 0; i < n; i++) {
      const ox = cx + gs() * rad * .6, oz = cz + gs() * rad * .6, Rx = rr(.25, 1) * rad, Rz = rr(.25, 1) * rad, yaw = R() * 6.28, kz = R() < .3 ? 2 : 1, phz = R() * 6.28, yA = rr(.05, .3) * hgt;
      const cy = clr(ox, oz, yaw, Rx, Rz, kz, phz) + yA + R() ** 1.5 * hgt, w = (R() < .5 ? -1 : 1) * v * rr(.6, 1.3) / ((Rx + Rz) * .5 + .3);
      inst(m, ox, cy, oz, yaw, Rx, Rz, kz, phz, yA, 1 + (R() * 3 | 0), R() * 6.28, R() * 6.28, w, rr(s0, s1), pat, 0);
    }
  };
  const stream = (m, pat, n, cx, cy, cz, Rx, Rz, v, s0, s1, spread, mode = 0, th0 = R() * 6.28, yaw = rr(-.5, .5)) => {
    const yA = rr(.2, .6) * Math.min(1, Rx / 8), phy = R() * 6.28, w = (R() < .5 ? -1 : 1) * v / ((Rx + Rz) * .5);
    cy = Math.max(cy, clr(cx, cz, yaw, Rx, Rz, 1, 0) + yA + .5);
    for (let i = 0; i < n; i++) { const k = 1 + rr(-.05, .05) * Math.min(1, 12 / Rx); inst(m, cx + rr(-.5, .5), cy + gs() * .6, cz + rr(-.5, .5), yaw + rr(-.03, .03), Rx * k, Rz * k, 1, 0, yA * rr(.5, 1.5), 2, phy + rr(-.5, .5), th0 + gs() * spread, w, rr(s0, s1), pat, mode) }
  };
  // big ones: wide orbits so they pass through the view only occasionally
  const big = (m, pat, mode, sc, y, zc, Rz, v, n = 1, Rx = rr(62, 85)) => { const th = R() * 6.28, yaw = rr(-.12, .12), w = (R() < .5 ? -1 : 1) * v / Rx; for (let i = 0; i < n; i++)FR[m].push(rr(-4, 4) + (i ? rr(-2, 2) : 0), y + (i ? rr(-.8, .8) : 0), zc + (i ? rr(-2, 2) : 0), yaw, Rx, Rz, 1, 0, rr(.3, .8) * (n > 1 ? 1.8 : 1), n > 1 ? 9 : 2, R() * 6, th + i * rr(.035, .07), w, sc * (i ? rr(.8, 1) : 1), pat + .5, mode + R() * .98) };
  big(5, 20, 0, 2.5, 4.3, -5, 3.5, 1.4);
  big(8, 21, 2, 4.6, 4.4, -7, 3.5, 1.7);
  big(9, 22, 2, 1.25, 3.4, -2.5, 3, .7, 1, rr(34, 46));
  big(7, 23, 1, 13, 6.3, -18, 2.5, 2.2);
  big(6, 24, 1, 2.6, 7, -9, 3, 4.2, 5);
  big(11, 25, 0, 8.5, 5.2, -13, 3.5, 1.5);
  big(9, 22, 2, 1, 4.6, -6, 4, .6, 1, rr(36, 50));
  sd = Math.imul(seed, 40503) | 0;
  let p;
  for (let i = 0; i < 7; i++) { p = spot(-16, 3); cloud(0, 0, 50, p[0], p[1], rr(.8, 1.5), 1.1, .22, .07, .11) }
  for (let i = 0; i < 6; i++) { p = spot(-18, 2); cloud(0, 1, 38, p[0], p[1], rr(.8, 1.6), .9, .25, .08, .12) }
  for (let i = 0; i < 3; i++) { p = spot(-14, 0); cloud(0, 8, 22, p[0], p[1], rr(1.5, 2.5), 2.5, .3, .13, .17) }
  for (let i = 0; i < 3; i++)stream(0, 9, 70, rr(-6, 6), rr(3.5, 6.5), rr(-16, -6), rr(9, 16), rr(5, 9), 1.1, .2, .26, .22);
  for (let i = 0; i < 3; i++) { p = spot(-15, -4); stream(1, 7, 11, p[0], 1.5, p[1], rr(3, 5), rr(2, 4), .45, .17, .21, .3) }
  for (let i = 0; i < 9; i++) { p = spot(-14, 0); cloud(1, 3, 1 + (R() < .4), p[0], p[1], rr(1.5, 3), .6, .35, .2, .27) }
  for (let i = 0; i < 9; i++) { p = spot(-12, 4); const r = rr(1.2, 2.6); stream(1, 4, 2, p[0], 1, p[1], r, r * rr(.5, 1), .3, .13, .16, .12) }
  for (let i = 0; i < 4; i++) { p = spot(-13, -2); const r = rr(1.5, 3); stream(2, 5, 2 + (R() * 2 | 0), p[0], 1.2, p[1], r, r * rr(.5, 1), .3, .17, .21, .15) }
  for (let i = 0; i < 7; i++) { p = spot(-14, 0); cloud(4, 6, 1, p[0], p[1], rr(1.5, 3), .3, .35, .2, .3) }
  for (let i = 0; i < 5; i++) { p = spot(-12, 0); cloud(1, 11, 1, p[0], p[1], rr(1.5, 3), .5, .3, .26, .36) }
  for (let i = 0; i < anems.length; i += 4) for (let k = 0; k < 3; k++) { const s = anems[i + 3], r = rr(.08, .3) * s; inst(0, anems[i] + rr(-.1, .1), anems[i + 1] + rr(.08, .3) * s, anems[i + 2] + rr(-.1, .1), R() * 6.28, r, r * rr(.4, 1), 2, R() * 6, .05, 3, R() * 6, R() * 6, rr(.3, .6) * (R() < .5 ? -1 : 1), rr(.075, .11), 2, 0) }
  stream(3, 10, 34, 2, 3.6, -20, 14, 5, .5, .7, 1, .35);
  stream(0, 10, 90, 2, 8, -6, 11, 3, 1.3, .13, .18, .3); stream(0, 9, 60, -1, 8.3, -7, 13, 3, 1, .16, .22, .3); stream(0, 10, 70, 4, 8.6, -5, 8, 3, 1.2, .12, .16, .4);
  stream(3, 10, 46, -3, 3.4, -12, 17, 9, 1.6, .35, .5, .25);
  // jellies
  for (let i = 0; i < 11; i++) { const r = rr(2, 4.5); inst(10, rr(-10, 10), rr(2.6, 4), rr(-20, -5), R() * 6.28, r, r * rr(.5, 1), 1, 0, rr(.3, .6), 1 + (R() * 2 | 0), R() * 6, R() * 6, rr(.03, .05) * (R() < .5 ? -1 : 1), rr(.22, .5), 30, 3) }

  for (const r of FR) for (let i = 12; i < r.length; i += 16) r[i] = (Math.round(r[i] * 651.8986469) || Math.sign(r[i])) / 651.8986469; // whole turns per 4096 s so time can wrap
  const draws = []; let fi = 0; const rows = [];
  FR.forEach((r, m) => { if (r.length) draws.push([ME[m][1], r.length / 16, ME[m][0], fi, m]); fi += r.length / 16; for (const x of r) rows.push(x) });
  return { sv: S.V.subarray(0, S.nv * 12), si: S.I.subarray(0, S.ni), fvv: F.V.subarray(0, F.nv * 10), fii: F.I.subarray(0, F.ni), inst: new Float32Array(rows), draws, FR, stats };
}

// tileable RGBA noise with mips
export function noiseTex(N) {
  const hash = (x, y, s) => { let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041) | 0; n = Math.imul(n ^ n >>> 13, 1274126177); return ((n ^ n >>> 16) >>> 0) / 4294967296 };
  const vn = (x, y, p, s) => { const xi = Math.floor(x), yi = Math.floor(y); let fx = x - xi, fy = y - yi; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); const x0 = xi % p, x1 = (xi + 1) % p, y0 = yi % p, y1 = (yi + 1) % p, a = hash(x0, y0, s), b = hash(x1, y0, s), c = hash(x0, y1, s), d = hash(x1, y1, s); return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy };
  const P = [8, 4, 16, 32], O = [4, 3, 3, 2], d = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++)for (let x = 0; x < N; x++)for (let c = 0; c < 4; c++) { let s = 0, a = .5, p = P[c], t = 0; for (let o = 0; o < O[c]; o++) { s += a * vn(x / N * p, y / N * p, p, c * 7 + o); t += a; a *= .5; p *= 2 } s = (s / t - .5) * 1.7 + .5; d[(y * N + x) * 4 + c] = Math.max(0, Math.min(255, s * 255)) }
  const mips = [d]; let n = N, src = d;
  while (n > 1) { const h = n >> 1, m = new Uint8Array(h * h * 4); for (let y = 0; y < h; y++)for (let x = 0; x < h; x++)for (let c = 0; c < 4; c++) { const o = (y * 2 * n + x * 2) * 4 + c; m[(y * h + x) * 4 + c] = (src[o] + src[o + 4] + src[o + n * 4] + src[o + n * 4 + 4]) >> 2 } mips.push(m); src = m; n = h }
  return mips;
}
