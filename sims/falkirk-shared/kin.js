// The Falkirk Wheel, model only (no three.js). One input poses the whole machine: the wheel angle α. The docking
// sequence (stow pins, U-seal, gates) is a second, scripted input the film keys between turns.
//
// Sources (numbers used here):
//   ASME, "Symbol of the Millennium": two pairs of opposing arms reaching 15 m from a 3.5 m tubular axle, 25 m apart;
//     a pair of 4 m slewing bearings; 180° in 5.5 minutes; 22.5 kW; 1,500 t; each gondola holds ≥ 250,000 L.
//   Wikipedia, Mechanism: each caisson end runs on small wheels on rails inside the 8 m holes at the arm ends. A train
//     of three 8 m ring gears and two smaller idlers, all external teeth: the central gear is fixed over the axle at the
//     machine-room end, an idler rides on each arm, and a ring gear on each caisson; the idlers turn faster than the
//     wheel in the same direction, the caisson rings at the wheel's speed the other way, so the caissons stay level.
//   Wikipedia / Scottish Canals: the wheel lifts boats 24 m. Practical Engineering: docking uses stow pins, a lance, a
//     U-shaped seal and gates opened by hydraulic rams; about 1.5 kWh per half turn.
// Not published, so taken from the photos (marked EST): tooth counts (104 on an 8 m ring, about what the ring-gear
// photo shows), plate thickness, trough section, gate and ram sizes.
//
// Frame: x across, y up, z along the axle. The machine room is at -z. The aqueduct and the basin channel meet the
// caissons at +z. α = 0: caisson A at the bottom (docked in the basin), B at the top (docked on the aqueduct).

export const D = {
  armReach: 15, // ASME: arms reach 15 m from the axle
  plateGap: 25, // ASME: the arm pairs are 25 m apart (centre to centre)
  plateT: 1.6, // EST
  axleR: 1.75, // ASME: 3.5 m axle
  axleL: 28, // 28 m central axle
  bearingR: 2, // ASME: 4 m slewing bearings
  ring: {r: 4, teeth: 104}, // Wikipedia: 8 m ring gears (sun and caisson rings); teeth EST
  idler: {r: 2, teeth: 52}, // the idler fills sun → caisson: 4 + 2·2 + 4 = 12 m (EST teeth, same module)
  gearW: 0.9, // face width EST
  lift: 24, // Wikipedia: 24 m
  hole: 4, // the 8 m holes the caisson ends run in
  trough: {w: 6, floor: -2.1, rim: 0.9, water: -0.35, inner: 24}, // EST section; water depth 1.75 m; 24 m between end walls
  wheelsPerEnd: 4,
  gate: {h: 2.6, w: 5.6},
  dockGap: 0.3, // the U-seal spans this
  minutesPerHalf: 5.5, // ASME
  kWhPerHalf: 1.5, // Practical Engineering
};
D.caissonR = D.ring.r + 2 * D.idler.r + D.ring.r; // 12 m from the axle: the gear train sets it
D.axleY = D.caissonR + -D.trough.water; // the lower caisson's water sits at the basin level, y = 0
D.zPlate = D.plateGap / 2;
D.zGear = -D.zPlate - D.plateT / 2 - D.gearW / 2 - 0.15; // the train runs on the machine-room face
D.zEnd = D.zPlate + D.plateT / 2 + 0.4; // the caisson end frames sit just past the plate faces
D.zDock = D.zEnd + 0.35 + D.dockGap; // the aqueduct and the basin channel end here
D.sweepR = D.caissonR + D.hole + 1.6; // the plates' eyes are the farthest-reaching parts
D.pitHalf = 13; // docking pit half-width
D.pitFloor = -7.4;

const TAU = Math.PI * 2;
const fracMod = (x) => ((x % 1) + 1) % 1;

/** Every moving part's placement at wheel angle a (radians, + turns the wheel about +z). */
export function pose(a, ops = {}) {
  const AX = [0, D.axleY, 0];
  const arm = [Math.sin(a), -Math.cos(a)]; // unit vector from the axle toward caisson A
  const at = (r, sgn) => [AX[0] + sgn * r * arm[0], AX[1] + sgn * r * arm[1]];
  // gear train (absolute spin angles about +z)
  const sun = 0; // fixed
  const idler = a * (1 + D.ring.r / D.idler.r); // rolls on the fixed sun: 3α
  const ringSpin = a - (D.idler.r / D.ring.r) * (idler - a); // rolls on the idler: 0 for equal sun and ring
  const caissons = ['A', 'B'].map((id, k) => {
    const sgn = k === 0 ? 1 : -1;
    const c = at(D.caissonR, sgn);
    return {id, centre: [c[0], c[1], 0], spin: ringSpin, waterY: c[1] + D.trough.water, idler: [...at(D.ring.r + D.idler.r, sgn), D.zGear]};
  });
  // the docked caisson: whichever is at the bottom (basin) or top (aqueduct)
  const dock = ops.dock ?? 0; // 0 sealed and closed .. 1 pins in, seal on, gates open
  return {a, AX, arm, sun, idler, ringSpin, caissons, dock, gates: ops.gates ?? 0, pins: ops.pins ?? 0, seal: ops.seal ?? 0};
}

/** Tooth phase (0..1) of a gear with N teeth and spin φ, at the world direction ψ from its centre. 0 = tooth centre. */
export const toothPhase = (N, phi, psi, offset = 0) => fracMod(((psi - phi) * N) / TAU - offset);

/** Tooth phase offsets: at α = 0 the sun and the caisson rings show a tooth (phase 0) at each contact and the idlers a
 * gap (0.5). Both counts are even, so the opposite side of each gear matches too. */
export const OFFSETS = {sun: 0, idler: 0.5, ring: 0};

export function checks(a) {
  const P = pose(a);
  const out = [];
  // caissons level: their absolute spin is zero for any wheel angle
  out.push({name: 'caissons stay level', ok: Math.abs(P.ringSpin) < 1e-9, value: `${((P.ringSpin * 180) / Math.PI).toExponential(1)}°`});
  // idler turns 3× the wheel, same direction (Wikipedia: faster, same direction)
  out.push({name: 'idlers turn faster than the wheel, same way', ok: Math.abs(P.idler - 3 * a) < 1e-9 && (a === 0 || Math.sign(P.idler) === Math.sign(a)), value: (P.idler / (a || 1)).toFixed(3)});
  // the caisson rings turn at the wheel's speed the other way relative to the arm
  out.push({name: 'rings counter-turn at wheel speed (relative to the arm)', ok: Math.abs(P.ringSpin - a + a) < 1e-9, value: ((P.ringSpin - a) / (a || 1)).toFixed(3)});
  // centres: sun to idler is r_s + r_i, idler to ring is r_i + r_r: the gears touch at the pitch circles
  for (const C of P.caissons) {
    const di = Math.hypot(C.idler[0] - P.AX[0], C.idler[1] - P.AX[1]);
    const dr = Math.hypot(C.centre[0] - C.idler[0], C.centre[1] - C.idler[1]);
    out.push({name: 'sun and idler pitch circles touch', ok: Math.abs(di - D.ring.r - D.idler.r) < 1e-9, value: di.toFixed(4)});
    out.push({name: 'idler and ring pitch circles touch', ok: Math.abs(dr - D.idler.r - D.ring.r) < 1e-9, value: dr.toFixed(4)});
  }
  // teeth stay in mesh: at each contact the two phases move opposite ways, so their sum holds at 0.5 (tooth into gap)
  for (const C of P.caissons) {
    const psi = Math.atan2(C.idler[1] - P.AX[1], C.idler[0] - P.AX[0]); // sun → idler → ring, along the arm
    const pairs = [
      ['sun and idler teeth stay in mesh', toothPhase(D.ring.teeth, P.sun, psi, OFFSETS.sun), toothPhase(D.idler.teeth, P.idler, psi + Math.PI, OFFSETS.idler)],
      ['idler and ring teeth stay in mesh', toothPhase(D.idler.teeth, P.idler, psi, OFFSETS.idler), toothPhase(D.ring.teeth, C.spin, psi + Math.PI, OFFSETS.ring)],
    ];
    for (const [name, pa, pb] of pairs) {
      const e = fracMod(pa + pb - 0.5);
      const err = Math.min(e, 1 - e);
      out.push({name, ok: err < 1e-6, value: err.toExponential(1)});
    }
  }
  // the trough fits inside the rail circle with room for the wheels (0.25 m)
  const T = D.trough;
  const corner = Math.max(Math.hypot(T.w / 2, T.floor), Math.hypot(T.w / 2, T.rim));
  out.push({name: 'trough corners clear the rail (wheels 0.25 m)', ok: corner <= D.hole - 0.25, value: corner.toFixed(3)});
  // the water it carries: ≥ 250,000 L (ASME)
  const litres = T.inner * T.w * (T.water - T.floor) * 1000;
  out.push({name: 'each caisson holds ≥ 250,000 L', ok: litres >= 250000, value: Math.round(litres)});
  // levels: the lower caisson meets the basin at α = 0 and the aqueduct at α = π, both 24 m apart
  const low = P.caissons.reduce((m, C) => (C.waterY < m.waterY ? C : m));
  const high = P.caissons.reduce((m, C) => (C.waterY > m.waterY ? C : m));
  if (Math.abs(Math.sin(a)) < 1e-9) {
    out.push({name: 'lower caisson water meets the basin (0 m)', ok: Math.abs(low.waterY) < 1e-6, value: low.waterY.toFixed(4)});
    out.push({name: 'upper caisson water meets the aqueduct (24 m)', ok: Math.abs(high.waterY - D.lift) < 1e-6, value: high.waterY.toFixed(4)});
  }
  // the arms reach past the caisson eyes: 15 m reach covers the 12 m centre plus most of the eye
  out.push({name: 'arm reach covers the caisson eye', ok: D.armReach >= D.caissonR + D.hole * 0.6, value: (D.armReach - D.caissonR).toFixed(2)});
  // nothing that turns crosses the fixed dock ends at +z
  out.push({name: 'dock ends clear of everything that turns', ok: D.zDock - (D.zEnd + 0.35) >= D.dockGap - 1e-9, value: (D.zDock - D.zEnd - 0.35).toFixed(3)});
  // the docking pit is wide and deep enough for the swept plates
  const atWater = Math.sqrt(Math.max(0, D.sweepR ** 2 - D.axleY ** 2));
  out.push({name: 'pit walls clear the swept plates at the waterline', ok: D.pitHalf >= atWater + 0.3, value: (D.pitHalf - atWater).toFixed(2)});
  out.push({name: 'pit floor clears the lowest eye', ok: D.axleY - D.sweepR - D.pitFloor >= 1, value: (D.axleY - D.sweepR - D.pitFloor).toFixed(2)});
  // the axle spans the plates and both bearings
  out.push({name: 'the axle spans both plates', ok: D.axleL >= D.plateGap + D.plateT, value: D.axleL});
  return out;
}

/** Real-time readouts for the panels, all from the same pose. */
export function readouts(a, aRate) {
  const half = Math.min(1, Math.abs(a) / Math.PI);
  const P = pose(a);
  const rpmWheel = (aRate / TAU) * 60;
  return {
    angleDeg: (a * 180) / Math.PI,
    rpmWheel,
    rpmIdler: rpmWheel * 3,
    levelDeg: (P.ringSpin * 180) / Math.PI,
    lifted: half * D.lift,
    minutes: half * D.minutesPerHalf,
    kWh: half * D.kWhPerHalf,
    caissons: P.caissons.map((C) => C.waterY),
  };
}
