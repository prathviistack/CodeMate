import { BaseAnalyzer } from "./baseAnalyzer.js";

/**
 * Analyzes JavaScript/TypeScript projects by inspecting package.json.
 * Detects frameworks, libraries, and runtime targets.
 */
export class JavaScriptAnalyzer extends BaseAnalyzer {
  async analyze(path, content) {
    if (path !== "package.json") return null;

    const pkg = this.parseJson(content);
    if (!pkg) return null;

    const frameworks = [];
    const libs = { ...pkg.dependencies, ...pkg.devDependencies };

    // Web frameworks
    if (libs["react"]) frameworks.push("React");
    if (libs["vue"]) frameworks.push("Vue");
    if (libs["angular"]) frameworks.push("Angular");
    if (libs["svelte"]) frameworks.push("Svelte");
    if (libs["next"]) frameworks.push("Next.js");
    if (libs["nuxt"]) frameworks.push("Nuxt");
    if (libs["remix"]) frameworks.push("Remix");
    if (libs["astro"]) frameworks.push("Astro");

    // Backend frameworks
    if (libs["express"]) frameworks.push("Express");
    if (libs["fastify"]) frameworks.push("Fastify");
    if (libs["koa"]) frameworks.push("Koa");
    if (libs["hapi"]) frameworks.push("Hapi");
    if (libs["nestjs"]) frameworks.push("NestJS");
    if (libs["@nestjs/common"]) frameworks.push("NestJS");

    // Other runtimes/tools
    if (libs["electron"]) frameworks.push("Electron");
    if (libs["react-native"]) frameworks.push("React Native");
    if (libs["gatsby"]) frameworks.push("Gatsby");
    if (libs["gridsome"]) frameworks.push("Gridsome");
    if (libs["docusaurus"]) frameworks.push("Docusaurus");
    if (libs["vite"]) frameworks.push("Vite");
    if (libs["webpack"]) frameworks.push("Webpack");
    if (libs["parcel"]) frameworks.push("Parcel");

    // Testing frameworks
    if (libs["jest"]) frameworks.push("Jest");
    if (libs["mocha"]) frameworks.push("Mocha");
    if (libs["vitest"]) frameworks.push("Vitest");
    if (libs["cypress"]) frameworks.push("Cypress");
    if (libs["playwright"]) frameworks.push("Playwright");

    // ORM/DB
    if (libs["typeorm"]) frameworks.push("TypeORM");
    if (libs["prisma"]) frameworks.push("Prisma");
    if (libs["sequelize"]) frameworks.push("Sequelize");
    if (libs["mongoose"]) frameworks.push("Mongoose");

    const languages = [];
    if (content.includes('"typescript"') || content.includes('"@types/')) {
      languages.push("TypeScript");
    }
    languages.push("JavaScript");

    return {
      languages,
      frameworks: [...new Set(frameworks)], // deduplicate
    };
  }
}
