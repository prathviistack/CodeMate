import { BaseAnalyzer } from "./baseAnalyzer.js";

/**
 * Analyzes Go projects by inspecting go.mod.
 * Detects frameworks and dependencies.
 */
export class GoAnalyzer extends BaseAnalyzer {
  async analyze(path, content) {
    if (path !== "go.mod") return null;

    const frameworks = [];

    // Web frameworks
    if (content.includes("github.com/gin-gonic/gin")) frameworks.push("Gin");
    if (content.includes("github.com/gorilla/mux")) frameworks.push("Gorilla Mux");
    if (content.includes("github.com/labstack/echo")) frameworks.push("Echo");
    if (content.includes("github.com/go-chi/chi")) frameworks.push("Chi");
    if (content.includes("net/http")) frameworks.push("net/http");

    // Testing
    if (content.includes("github.com/stretchr/testify")) frameworks.push("Testify");
    if (content.includes("github.com/onsi/ginkgo")) frameworks.push("Ginkgo");

    // Database
    if (content.includes("gorm.io/gorm")) frameworks.push("GORM");
    if (content.includes("sqlc")) frameworks.push("sqlc");

    // GraphQL
    if (content.includes("github.com/graphql-go/graphql")) frameworks.push("GraphQL-Go");
    if (content.includes("github.com/99designs/gqlgen")) frameworks.push("gqlgen");

    return {
      languages: ["Go"],
      frameworks: [...new Set(frameworks)],
    };
  }
}
