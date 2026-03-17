import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
  title: "TerraQura Documentation",
  tagline: "Institutional-Grade Carbon Asset Platform",

  url: "https://docs.terraqura.io",
  baseUrl: "/",

  organizationName: "terraqura",
  projectName: "terraqura-docs",

  onBrokenLinks: "throw",
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: "warn",
    },
  },

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          editUrl: "https://github.com/terraqura/terraqura/tree/main/apps/docs/",
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    navbar: {
      title: "TerraQura",
      logo: {
        alt: "TerraQura Logo",
        src: "img/logo.svg",
        href: "/docs/",
      },
      items: [
        {
          type: "docSidebar",
          sidebarId: "docsSidebar",
          position: "left",
          label: "Documentation",
        },
        {
          href: "/docs/contracts/overview",
          label: "Smart Contracts",
          position: "left",
        },
        {
          href: "https://github.com/terraqura/terraqura",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Documentation",
          items: [
            { label: "Introduction", to: "/docs/" },
            { label: "Getting Started", to: "/docs/getting-started" },
            { label: "Smart Contracts", to: "/docs/contracts/overview" },
          ],
        },
        {
          title: "Developers",
          items: [
            { label: "Contracts", to: "/docs/contracts/overview" },
            { label: "GitHub", href: "https://github.com/terraqura/terraqura" },
          ],
        },
        {
          title: "Resources",
          items: [
            { label: "Aethelred Network", href: "https://aethelred.network" },
            { label: "OpenZeppelin", href: "https://www.openzeppelin.com" },
            { label: "Hardhat", href: "https://hardhat.org" },
          ],
        },
        {
          title: "Links",
          items: [
            { label: "TerraQura App", href: "https://app.terraqura.io" },
            { label: "GitHub", href: "https://github.com/terraqura" },
            { label: "Aethelred Explorer", href: "https://explorer.aethelred.network" },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} TerraQura Limited. All rights reserved.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ["solidity", "bash", "json"],
    },
    colorMode: {
      defaultMode: "dark",
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
