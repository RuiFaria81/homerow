import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import mermaid from "astro-mermaid";

export default defineConfig({
  site: "https://docs.homerow.email",
  integrations: [
    mermaid(),
    starlight({
      title: "Homerow Email",
      favicon: "/favicon.svg",
      components: {
        SiteTitle: "./src/components/AppLikeSiteTitle.astro",
      },
      customCss: ["./src/styles/custom.css"],
      social: {
        github: "https://github.com/guilhermeprokisch/homerow",
      },
      sidebar: [
        {
          label: "Getting Started",
          items: [
            { label: "Quick Start", slug: "getting-started/quick-start" },
            { label: "Configuration", slug: "getting-started/configuration" },
          ],
        },
        {
          label: "Architecture",
          items: [
            { label: "Overview", slug: "architecture/overview" },
            { label: "Sync Engine", slug: "architecture/sync-engine" },
          ],
        },
        {
          label: "Deploy",
          items: [
            { label: "GitHub Actions", slug: "deploy/github-actions" },
            { label: "Local", slug: "deploy/local" },
          ],
        },
        {
          label: "Infrastructure",
          items: [
            { label: "Overview", slug: "infrastructure/overview" },
            { label: "Providers", slug: "infrastructure/providers" },
            { label: "Terraform State", slug: "infrastructure/terraform-state" },
          ],
        },
        {
          label: "Guides",
          items: [
            { label: "After Deploy", slug: "guides/after-deploy" },
            { label: "Gmail Migration", slug: "guides/gmail-migration" },
            {
              label: "Hetzner Post-Install",
              slug: "guides/hetzner-post-install",
            },
          ],
        },
        {
          label: "Operations",
          items: [
            { label: "Updates", slug: "operations/updates" },
            { label: "Backups and Restore", slug: "operations/backups-restore" },
            { label: "Resource Sizing", slug: "operations/resource-sizing" },
            { label: "Destroy", slug: "operations/destroy" },
            { label: "Security", slug: "operations/security" },
          ],
        },
        {
          label: "Contributing",
          items: [
            {
              label: "Adding Providers",
              slug: "contributing/adding-providers",
            },
          ],
        },
      ],
    }),
  ],
});
