import { BaseAnalyzer } from "./baseAnalyzer.js";

/**
 * Analyzes Rust projects by inspecting Cargo.toml.
 * Detects frameworks and dependencies.
 */
export class RustAnalyzer extends BaseAnalyzer {
  async analyze(path, content) {
    if (path !== "Cargo.toml") return null;

    const frameworks = [];

    // Web frameworks
    if (content.includes("actix-web")) frameworks.push("Actix-web");
    if (content.includes("rocket")) frameworks.push("Rocket");
    if (content.includes("axum")) frameworks.push("Axum");
    if (content.includes("warp")) frameworks.push("Warp");
    if (content.includes("tide")) frameworks.push("Tide");
    if (content.includes("tokio")) frameworks.push("Tokio");

    // Testing
    if (content.includes("criterion")) frameworks.push("Criterion");

    // Database
    if (content.includes("sqlx")) frameworks.push("sqlx");
    if (content.includes("diesel")) frameworks.push("Diesel");

    // GraphQL
    if (content.includes("juniper")) frameworks.push("Juniper");
    if (content.includes("async-graphql")) frameworks.push("async-graphql");

    // CLI
    if (content.includes("clap")) frameworks.push("clap");

    return {
      languages: ["Rust"],
      frameworks: [...new Set(frameworks)],
    };
  }
}
