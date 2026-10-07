export const POLICY_VERSION = "2026-10-07.1";
export const POLICY_DATE = "7 October 2026";
export const PRIVACY_REQUEST_TYPES = ["Access", "Correction", "Deletion", "Withdraw consent", "Privacy complaint", "Moderation appeal"] as const;
export function validateBrokerAcceptance(b: Record<string, unknown>) {
  const errors: string[] = [];
  if (b.acceptBrokerTerms !== true || b.policyVersion !== POLICY_VERSION)
    errors.push("Read and accept the current Broker Agreement and Terms of use.");
  if (b.consentVerification !== true || b.privacyVersion !== POLICY_VERSION)
    errors.push("Read the Privacy Notice and consent to private document review.");
  return errors;
}
export function validatePrivacyRequest(b: Record<string, unknown>) {
  const errors: string[] = [];
  if (!PRIVACY_REQUEST_TYPES.includes(b.kind as typeof PRIVACY_REQUEST_TYPES[number])) errors.push("Choose a request type.");
  if (typeof b.email !== "string" || b.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email.trim())) errors.push("Enter a valid contact email.");
  if (typeof b.details !== "string" || b.details.trim().length < 10 || b.details.trim().length > 2000) errors.push("Describe your request in 10–2,000 characters.");
  return errors;
}
