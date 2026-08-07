import { compileStyleContract } from "./compiler";
import { getConfirmedStyleProfile } from "./repository";

export async function getActiveStyleContract() {
  const profile = await getConfirmedStyleProfile();
  return profile ? compileStyleContract(profile) : null;
}
