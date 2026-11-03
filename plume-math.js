/** Ideal-gas reference calculations, independent of the archived CFD fields.
 * All geometric lengths passed to this module are in metres; pressures in Pa.
 * Source relation: NASA Glenn, Isentropic Flow Equations. */
export function areaRatio(mach, gamma = 1.4) {
  if (!(mach > 0 && gamma > 1)) throw new RangeError('Positive Mach and gamma > 1 are required.');
  return Math.pow(2 / (gamma + 1) * (1 + (gamma - 1) * mach * mach / 2), (gamma + 1) / (2 * (gamma - 1))) / mach;
}
export function machFromArea(ratio, gamma = 1.4, branch = 'supersonic') {
  if (!(Number.isFinite(ratio) && ratio >= 1 - 1e-10 && gamma > 1)) throw new RangeError('Area ratio must be at least one.');
  if (Math.abs(ratio - 1) < 1e-10) return 1;
  const supersonic = branch === 'supersonic';
  let lower = supersonic ? 1 : 1e-9, upper = supersonic ? 100 : 1;
  for (let step = 0; step < 100; step++) {
    const middle = (lower + upper) / 2;
    if ((areaRatio(middle, gamma) < ratio) === supersonic) lower = middle;
    else upper = middle;
  }
  return (lower + upper) / 2;
}
export function staticState(mach, gamma, gasConstant, totalTemperature, totalPressure) {
  if (![mach,gamma,gasConstant,totalTemperature,totalPressure].every(Number.isFinite) || mach < 0 || gamma <= 1 || gasConstant <= 0 || totalTemperature <= 0 || totalPressure <= 0) throw new RangeError('Invalid thermodynamic reference.');
  const factor = 1 + (gamma - 1) * mach * mach / 2;
  const temperature = totalTemperature / factor;
  return {mach,temperature,pressure:totalPressure / Math.pow(factor,gamma/(gamma-1)),velocity:mach * Math.sqrt(gamma * gasConstant * temperature)};
}
export function radiusAt(points, position) {
  if (!points.length) throw new RangeError('A nonempty geometry is required.');
  if (position <= points[0][0]) return points[0][1];
  if (position >= points.at(-1)[0]) return points.at(-1)[1];
  const index = points.findIndex(p => p[0] >= position);
  const [a,b] = [points[index-1], points[index]];
  const fraction = (position-a[0])/(b[0]-a[0]);
  return a[1]+fraction*(b[1]-a[1]);
}
export function nozzleReference(points, position, gamma, gasConstant, totalTemperature, totalPressure) {
  const throat = points.reduce((best,p) => p[1] < best[1] ? p : best,points[0]);
  const radius = radiusAt(points,position), ratio = Math.max(1,(radius/throat[1])**2);
  return {...staticState(machFromArea(ratio,gamma,position < throat[0] ? 'subsonic' : 'supersonic'),gamma,gasConstant,totalTemperature,totalPressure),radius,ratio,throat};
}
export function hotNozzle(scale = .25) {
  // Matches Nozzle2QuarterScale.m: 0.0833 * 600 mm throat radius;
  // 0.167 * 600 mm linear section; total scripted length 1500 mm.
  const exit = .6 * scale, inlet = .2 * scale, throat = .0833 * .6 * scale;
  const linearLength = .167 * .6 * scale, totalLength = 1.5 * scale;
  const points = [];
  for(let i=0;i<100;i++){const f=i/99;points.push([f*linearLength,inlet+(throat-inlet)*f]);}
  for(let i=1;i<=200;i++){const f=i/200;points.push([linearLength+f*(totalLength-linearLength),throat+(exit-throat)*f*f]);}
  return points;
}
export function mslApproximation(scale = 1) {
  // Reported quarter-scale throat/exit areas; an explicitly approximate
  // diverging-section construction using the report's 80%-length/15° rule.
  const throat = Math.sqrt(6.9e-5/Math.PI)*scale;
  const exit = Math.sqrt(.00193/Math.PI)*scale;
  const length = .8*(exit-throat)/Math.tan(15*Math.PI/180);
  return Array.from({length:121},(_,i)=>[length*i/120,throat+(exit-throat)*i/120]);
}
export function nearestVisible(series, radius, tolerance = .006) {
  let closest = null;
  for (const p of series) if (p[1] !== null && (!closest || Math.abs(p[0]-radius)<Math.abs(closest[0]-radius))) closest=p;
  return closest && Math.abs(closest[0]-radius)<=tolerance ? closest : null;
}
