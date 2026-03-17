import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  docsSidebar: [
    {
      type: "doc",
      id: "intro",
      label: "Introduction",
    },
    {
      type: "doc",
      id: "getting-started",
      label: "Getting Started",
    },
    {
      type: "category",
      label: "Smart Contracts",
      items: ["contracts/overview", "contracts/carbon-credit"],
    },
  ],
};

export default sidebars;
