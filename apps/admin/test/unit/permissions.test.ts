import { describe, expect, it } from "vitest";
import { can } from "@/lib/permissions";

describe("role permissions", () => {
  it("keeps investigators and viewers away from contact details, leads and staff", () => {
    for (const cap of ["viewReporterEmail", "viewLeads", "exportLeads", "manageStaff", "viewAudit", "messageUser", "viewAnyReport"] as const) {
      expect(can("INVESTIGATOR", cap)).toBe(false);
      expect(can("VIEWER", cap)).toBe(false);
    }
    expect(can("INVESTIGATOR", "analyse")).toBe(true);
    expect(can("VIEWER", "analyse")).toBe(false);
  });

  it("reserves exports, staff management and the audit log for the owner", () => {
    for (const cap of ["exportLeads", "manageStaff", "viewAudit"] as const) {
      expect(can("OWNER", cap)).toBe(true);
      expect(can("REVIEWER", cap)).toBe(false);
    }
  });
});
