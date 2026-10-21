import { BaseAnalyzer } from "./baseAnalyzer.js";

/**
 * Analyzes Java projects by inspecting pom.xml and build.gradle.
 * Detects frameworks and dependencies.
 */
export class JavaAnalyzer extends BaseAnalyzer {
  async analyze(path, content) {
    if (path === "pom.xml") {
      return this.analyzePom(content);
    }
    if (path === "build.gradle" || path === "build.gradle.kts") {
      return this.analyzeGradle(content);
    }
    return null;
  }

  analyzePom(content) {
    const frameworks = [];

    // Web frameworks
    if (content.includes("spring-boot")) frameworks.push("Spring Boot");
    if (content.includes("spring-web")) frameworks.push("Spring");
    if (content.includes("jakarta.faces") || content.includes("jsf")) frameworks.push("JSF");
    if (content.includes("struts")) frameworks.push("Struts");
    if (content.includes("play-framework")) frameworks.push("Play Framework");
    if (content.includes("vaadin")) frameworks.push("Vaadin");

    // Testing
    if (content.includes("junit")) frameworks.push("JUnit");
    if (content.includes("testng")) frameworks.push("TestNG");

    // ORM/DB
    if (content.includes("hibernate")) frameworks.push("Hibernate");
    if (content.includes("jpa")) frameworks.push("JPA");

    // Build tools (often indicated by presence in pom)
    if (content.includes("maven")) frameworks.push("Maven");

    return {
      languages: ["Java"],
      frameworks: [...new Set(frameworks)],
    };
  }

  analyzeGradle(content) {
    const frameworks = [];

    // Web frameworks
    if (content.includes("spring-boot")) frameworks.push("Spring Boot");
    if (content.includes("spring")) frameworks.push("Spring");
    if (content.includes("play-framework")) frameworks.push("Play Framework");

    // Testing
    if (content.includes("junit")) frameworks.push("JUnit");
    if (content.includes("testng")) frameworks.push("TestNG");

    // ORM/DB
    if (content.includes("hibernate")) frameworks.push("Hibernate");

    return {
      languages: ["Java"],
      frameworks: [...new Set(frameworks)],
    };
  }
}
