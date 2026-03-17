/**
 * TerraQura Provenance Types
 */

export type ProvenanceEventType =
  | "CAPTURE_STARTED"
  | "CAPTURE_COMPLETED"
  | "VERIFICATION_STARTED"
  | "SOURCE_VERIFIED"
  | "LOGIC_VERIFIED"
  | "MINT_VERIFIED"
  | "MINTED"
  | "TRANSFERRED"
  | "RETIRED";

export interface ProvenanceEvent {
  type: ProvenanceEventType;
  timestamp: Date;
  txHash?: string;
  details: Record<string, string | number | boolean>;
}

export interface CreditProvenance {
  creditId: string;
  events: ProvenanceEvent[];
}
