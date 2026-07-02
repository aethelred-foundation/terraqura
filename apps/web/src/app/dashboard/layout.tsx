import type { Metadata } from "next";
import { DemoBanner } from "@/components/dashboard/DemoBanner";

export const metadata: Metadata = {
  title: {
    template: "%s | TerraQura",
    default: "Dashboard | TerraQura",
  },
  description:
    "TerraQura carbon credit platform dashboard on the Aethelred Blockchain.",
  robots: { index: false, follow: false },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <DemoBanner />
      {children}
    </>
  );
}
