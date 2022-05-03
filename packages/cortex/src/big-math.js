//
// Functions for dealing with float -> bigint multiplication
//
export function bigMultiply(x, y) {
  let [a_int, a_dec] = parseDecimals(x)
  let [b_int, b_dec] = parseDecimals(y)
  let a_int_str = a_int.toString()
  let b_int_str = b_int.toString()
  let multiplier = getMultiplier(a_dec) * getMultiplier(b_dec)
  let multiplier_str = multiplier.toString()
  let ab;
  if (a_int > b_int && a_int_str.length > multiplier_str.length) {
    ab = a_int / multiplier * b_int
  } else if (b_int > a_int && b_int_str.length > multiplier_str.length) {
    ab = b_int / multiplier * a_int
  } else if (b_int_str.length + a_int_str.length > multiplier_str.length) {
    ab = a_int * b_int / multiplier
  } else {
    let missing = multiplier_str.length - (b_int_str.length + a_int_str.length) + 1
    ab = a_int * b_int * getMultiplier(missing) / multiplier
    /* This number can't be Integer anymore, so we transform the bigint into number */
    ab = Number(ab) / Number(getMultiplier(missing))
  }
  return ab
}

function parseDecimals(e) {
    let eArray = e.toString().split(".")
    return [
      BigInt(eArray[0] + (eArray[1] ? eArray[1] : "")),
      (eArray[1] ? eArray[1].length : 0),
    ]
}

function getMultiplier(e) {
  return 10n ** BigInt(e)
}
