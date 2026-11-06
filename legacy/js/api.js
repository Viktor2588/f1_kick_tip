// The original Neon client (with a hard-coded owner connection string) was removed in the rebuild.
// This stub only exists so legacy/js/scoring.js and utils.js can be imported by the parity tests.
export async function fetchAllData() {
  throw new Error('Legacy DB client removed: the rebuild never talks to the live database.');
}
