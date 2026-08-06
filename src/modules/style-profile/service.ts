import { compileStyleContract } from "./compiler";
import { getConfirmedStyleProfile } from "./repository";

export async function getActiveStyleContract(
  options: { temporaryInstructions?: string[] } = {},
) {
  const profile = await getConfirmedStyleProfile();
  return profile ? compileStyleContract(profile, options) : null;
}
