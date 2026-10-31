import type { StaffRole } from "@kurotrace/db";

/**
 * What each role may do. Investigators (the external firm) only ever see reports
 * assigned to them, never reporters' contact details, and don't message users.
 */
export const CAN = {
  viewDashboard: ["OWNER", "REVIEWER", "INVESTIGATOR", "VIEWER"],
  viewQueue: ["OWNER", "REVIEWER", "VIEWER"],
  viewAnyReport: ["OWNER", "REVIEWER"],
  messageUser: ["OWNER", "REVIEWER"],
  changeStatus: ["OWNER", "REVIEWER"],
  assign: ["OWNER", "REVIEWER"],
  analyse: ["OWNER", "REVIEWER", "INVESTIGATOR"], // notes, scam pattern, confirm indicators
  viewReporterEmail: ["OWNER", "REVIEWER"],
  viewIndicators: ["OWNER", "REVIEWER"],
  viewLeads: ["OWNER", "REVIEWER"],
  exportLeads: ["OWNER"],
  handleIssues: ["OWNER", "REVIEWER"],
  manageStaff: ["OWNER"],
  viewAudit: ["OWNER"],
} as const satisfies Record<string, readonly StaffRole[]>;

export type Capability = keyof typeof CAN;

export function can(role: StaffRole, capability: Capability): boolean {
  return (CAN[capability] as readonly StaffRole[]).includes(role);
}

export const ROLE_LABEL: Record<StaffRole, string> = {
  OWNER: "Owner",
  REVIEWER: "Reviewer",
  INVESTIGATOR: "Investigator",
  VIEWER: "Viewer",
};

export class Forbidden extends Error {
  constructor(message = "You don't have access to this.") {
    super(message);
  }
}
