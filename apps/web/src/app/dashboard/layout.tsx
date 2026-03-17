import type { Metadata } from "next";

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
  return children;
}
