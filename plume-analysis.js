/** Small, independently testable reference calculations. Never a CFD solver. */
export function normalShock(mach, gamma=1.4) {
  if (!Number.isFinite(mach) || mach < 1 || !Number.isFinite(gamma) || gamma <= 1) throw new RangeError('A supersonic upstream Mach number and gamma > 1 are required.');
  const m2=mach*mach;
  const pressure=(2*gamma*m2-(gamma-1))/(gamma+1);
  const density=(gamma+1)*m2/((gamma-1)*m2+2);
  return {mach:Math.sqrt(((gamma-1)*m2+2)/(2*gamma*m2-(gamma-1))),pressure,density,temperature:pressure/density,totalPressure:density**(gamma/(gamma-1))*((gamma+1)/(2*gamma*m2-(gamma-1)))**(1/(gamma-1))};
}
export function chokedMassFlow(throatArea, gamma, gasConstant, totalTemperature, totalPressure) {
  if (![throatArea,gamma,gasConstant,totalTemperature,totalPressure].every(Number.isFinite) || throatArea<=0 || gamma<=1 || gasConstant<=0 || totalTemperature<=0 || totalPressure<=0) throw new RangeError('Invalid choked-flow reference.');
  return throatArea*totalPressure/Math.sqrt(totalTemperature)*Math.sqrt(gamma/gasConstant)*(2/(gamma+1))**((gamma+1)/(2*(gamma-1)));
}
export function visiblePeak(series) {
  return series.reduce((best,p)=>p[1]!==null&&(!best||p[1]>best[1])?p:best,null);
}
/** Differences exist only at matching, visible samples. No gap filling. */
export function differenceSeries(series, baseline) {
  if (series.length!==baseline.length || series.some((p,i)=>p[0]!==baseline[i][0])) throw new RangeError('Aligned sample coordinates are required.');
  return series.map(([x,y],i)=>[x,y===null||baseline[i][1]===null?null:y-baseline[i][1]]);
}
export function firstLayerHeight(totalThickness, layers, stretching) {
  if (totalThickness<=0 || !Number.isInteger(layers) || layers<1 || stretching<1) throw new RangeError('Invalid prism stack.');
  return stretching===1?totalThickness/layers:totalThickness*(stretching-1)/(stretching**layers-1);
}
