import { test } from "node:test";
import assert from "node:assert/strict";
import { JavaScriptAnalyzer } from "../src/code-analysis/analyzers/javascriptAnalyzer.js";
import { PythonAnalyzer } from "../src/code-analysis/analyzers/pythonAnalyzer.js";
import { RubyAnalyzer } from "../src/code-analysis/analyzers/rubyAnalyzer.js";
import { JavaAnalyzer } from "../src/code-analysis/analyzers/javaAnalyzer.js";
import { GoAnalyzer } from "../src/code-analysis/analyzers/goAnalyzer.js";
import { RustAnalyzer } from "../src/code-analysis/analyzers/rustAnalyzer.js";

test("JavaScript analyzer detects React projects", async () => {
  const analyzer = new JavaScriptAnalyzer();
  const pkg = JSON.stringify({
    name: "my-app",
    dependencies: { react: "^18.0.0", "react-dom": "^18.0.0" },
    devDependencies: { typescript: "^5.0.0" },
  });
  const result = await analyzer.analyze("package.json", pkg);
  assert.deepEqual(result.languages, ["TypeScript", "JavaScript"]);
  assert.ok(result.frameworks.includes("React"));
});

test("JavaScript analyzer detects Express projects", async () => {
  const analyzer = new JavaScriptAnalyzer();
  const pkg = JSON.stringify({
    name: "api",
    dependencies: { express: "^4.18.0" },
  });
  const result = await analyzer.analyze("package.json", pkg);
  assert.deepEqual(result.languages, ["JavaScript"]);
  assert.ok(result.frameworks.includes("Express"));
});

test("JavaScript analyzer detects Next.js + Vue mixup", async () => {
  const analyzer = new JavaScriptAnalyzer();
  const pkg = JSON.stringify({
    name: "app",
    dependencies: { next: "^13.0.0", vue: "^3.0.0" },
    devDependencies: { jest: "^29.0.0" },
  });
  const result = await analyzer.analyze("package.json", pkg);
  assert.ok(result.frameworks.includes("Next.js"));
  assert.ok(result.frameworks.includes("Vue"));
  assert.ok(result.frameworks.includes("Jest"));
});

test("JavaScript analyzer ignores non-package.json files", async () => {
  const analyzer = new JavaScriptAnalyzer();
  const result = await analyzer.analyze("src/index.js", "console.log('hello')");
  assert.equal(result, null);
});

test("Python analyzer detects Django from requirements.txt", async () => {
  const analyzer = new PythonAnalyzer();
  const requirements = `django==4.2.0
djangorestframework==3.14.0
celery==5.3.0
`;
  const result = await analyzer.analyze("requirements.txt", requirements);
  assert.deepEqual(result.languages, ["Python"]);
  assert.ok(result.frameworks.includes("Django"));
});

test("Python analyzer detects FastAPI from requirements.txt", async () => {
  const analyzer = new PythonAnalyzer();
  const requirements = `fastapi==0.104.0
uvicorn==0.24.0
pytest==7.4.0
`;
  const result = await analyzer.analyze("requirements.txt", requirements);
  assert.ok(result.frameworks.includes("FastAPI"));
  assert.ok(result.frameworks.includes("pytest"));
});

test("Python analyzer detects data science stack", async () => {
  const analyzer = new PythonAnalyzer();
  const requirements = `numpy>=1.20
pandas>=1.3
scikit-learn>=1.0
tensorflow>=2.10
`;
  const result = await analyzer.analyze("requirements.txt", requirements);
  assert.ok(result.frameworks.includes("NumPy"));
  assert.ok(result.frameworks.includes("Pandas"));
  assert.ok(result.frameworks.includes("TensorFlow"));
});

test("Python analyzer detects frameworks from pyproject.toml", async () => {
  const analyzer = new PythonAnalyzer();
  const pyproject = `[project]
name = "myapp"
dependencies = [
  "fastapi",
  "sqlalchemy",
]
`;
  const result = await analyzer.analyze("pyproject.toml", pyproject);
  assert.deepEqual(result.languages, ["Python"]);
  assert.ok(result.frameworks.includes("FastAPI"));
});

test("Ruby analyzer detects Rails projects", async () => {
  const analyzer = new RubyAnalyzer();
  const gemfile = `source "https://rubygems.org"
gem "rails", "~> 7.0"
gem "pg"
gem "devise"
gem "rspec-rails"
`;
  const result = await analyzer.analyze("Gemfile", gemfile);
  assert.deepEqual(result.languages, ["Ruby"]);
  assert.ok(result.frameworks.includes("Rails"));
  assert.ok(result.frameworks.includes("Devise"));
  assert.ok(result.frameworks.includes("RSpec"));
});

test("Ruby analyzer detects Sinatra projects", async () => {
  const analyzer = new RubyAnalyzer();
  const gemfile = `source "https://rubygems.org"
gem "sinatra"
gem "sequel"
`;
  const result = await analyzer.analyze("Gemfile", gemfile);
  assert.ok(result.frameworks.includes("Sinatra"));
  assert.ok(result.frameworks.includes("Sequel"));
});

test("Java analyzer detects Spring Boot from pom.xml", async () => {
  const analyzer = new JavaAnalyzer();
  const pom = `<project>
  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-data-jpa</artifactId>
    </dependency>
  </dependencies>
</project>`;
  const result = await analyzer.analyze("pom.xml", pom);
  assert.deepEqual(result.languages, ["Java"]);
  assert.ok(result.frameworks.includes("Spring Boot"));
});

test("Java analyzer detects Hibernate", async () => {
  const analyzer = new JavaAnalyzer();
  const pom = `<project>
  <dependencies>
    <dependency>
      <groupId>org.hibernate</groupId>
      <artifactId>hibernate-core</artifactId>
    </dependency>
  </dependencies>
</project>`;
  const result = await analyzer.analyze("pom.xml", pom);
  assert.ok(result.frameworks.includes("Hibernate"));
});

test("Go analyzer detects Gin from go.mod", async () => {
  const analyzer = new GoAnalyzer();
  const gomod = `module example.com/myapp

go 1.21

require (
  github.com/gin-gonic/gin v1.9.1
  github.com/stretchr/testify v1.8.4
)
`;
  const result = await analyzer.analyze("go.mod", gomod);
  assert.deepEqual(result.languages, ["Go"]);
  assert.ok(result.frameworks.includes("Gin"));
  assert.ok(result.frameworks.includes("Testify"));
});

test("Go analyzer detects GORM", async () => {
  const analyzer = new GoAnalyzer();
  const gomod = `module example.com/myapp

require gorm.io/gorm v1.25.4
`;
  const result = await analyzer.analyze("go.mod", gomod);
  assert.ok(result.frameworks.includes("GORM"));
});

test("Rust analyzer detects Actix-web from Cargo.toml", async () => {
  const analyzer = new RustAnalyzer();
  const cargo = `[package]
name = "myapp"
version = "0.1.0"

[dependencies]
actix-web = "4.4"
tokio = { version = "1", features = ["full"] }
`;
  const result = await analyzer.analyze("Cargo.toml", cargo);
  assert.deepEqual(result.languages, ["Rust"]);
  assert.ok(result.frameworks.includes("Actix-web"));
  assert.ok(result.frameworks.includes("Tokio"));
});

test("Rust analyzer detects Rocket", async () => {
  const analyzer = new RustAnalyzer();
  const cargo = `[dependencies]
rocket = { version = "0.5.0", features = ["json"] }
diesel = { version = "2.1", features = ["postgres"] }
`;
  const result = await analyzer.analyze("Cargo.toml", cargo);
  assert.ok(result.frameworks.includes("Rocket"));
  assert.ok(result.frameworks.includes("Diesel"));
});

test("analyzers return null for non-matching files", async () => {
  const js = new JavaScriptAnalyzer();
  assert.equal(await js.analyze("README.md", "# Hello"), null);

  const py = new PythonAnalyzer();
  assert.equal(await py.analyze("setup.cfg", ""), null);

  const go = new GoAnalyzer();
  assert.equal(await go.analyze("main.go", "package main"), null);
});

test("Python analyzer handles malformed pyproject.toml", async () => {
  const analyzer = new PythonAnalyzer();
  const result = await analyzer.analyze("pyproject.toml", "not valid toml ][");
  // Should still return Python language even if parsing fails
  assert.deepEqual(result.languages, ["Python"]);
  assert.deepEqual(result.frameworks, []);
});

test("JavaScript analyzer deduplicates frameworks", async () => {
  const analyzer = new JavaScriptAnalyzer();
  const pkg = JSON.stringify({
    dependencies: { jest: "^29.0", jest: "^29.0" }, // duplicate in different places
  });
  const result = await analyzer.analyze("package.json", pkg);
  const jestCount = result.frameworks.filter((f) => f === "Jest").length;
  assert.equal(jestCount, 1);
});
