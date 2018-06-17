export function makeFee(f) {
  return f;
}

export function makeFees(fees) {
  return fees.map(makeFee);
}
