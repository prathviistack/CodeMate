import { BaseAnalyzer } from "./baseAnalyzer.js";

/**
 * Analyzes Ruby projects by inspecting Gemfile.
 * Detects frameworks and libraries.
 */
export class RubyAnalyzer extends BaseAnalyzer {
  async analyze(path, content) {
    if (path !== "Gemfile") return null;

    const frameworks = [];

    // Web frameworks
    if (content.includes("rails")) frameworks.push("Rails");
    if (content.includes("sinatra")) frameworks.push("Sinatra");
    if (content.includes("hanami")) frameworks.push("Hanami");
    if (content.includes("padrino")) frameworks.push("Padrino");
    if (content.includes("roda")) frameworks.push("Roda");

    // Testing
    if (content.includes("rspec")) frameworks.push("RSpec");
    if (content.includes("minitest")) frameworks.push("Minitest");

    // ORM/DB
    if (content.includes("activerecord")) frameworks.push("ActiveRecord");
    if (content.includes("sequel")) frameworks.push("Sequel");

    // Other common gems
    if (content.includes("devise")) frameworks.push("Devise");
    if (content.includes("pundit")) frameworks.push("Pundit");
    if (content.includes("sidekiq")) frameworks.push("Sidekiq");
    if (content.includes("graphql")) frameworks.push("GraphQL");

    return {
      languages: ["Ruby"],
      frameworks: [...new Set(frameworks)],
    };
  }
}
