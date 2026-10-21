// Secret handling at ingestion time. Anything that looks like a credential is removed
// BEFORE the content is stored, so it can never be shown in the UI or sent to an AI provider.
// Redaction only replaces text inside a line, so line numbers stay valid.

const REDACTED = "[REDACTED]";
const PRIVATE_KEY_RE = /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----/;

const TOKEN_PATTERNS = [
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, // AWS access key id
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/g, // GitHub tokens
  /\bgithub_pat_[A-Za-z0-9_]{22,}\b/g,
  /\bAIza[0-9A-Za-z_-]{35}\b/g, // Google API key
  /\bxox[abprs]-[0-9A-Za-z-]{10,}\b/g, // Slack
  /\b[sr]k_live_[0-9A-Za-z]{16,}\b/g, // Stripe live keys
  /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{32,}\b/g, // OpenAI / Anthropic style
  /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, // JWT
];

// scheme://user:password@host  ->  keep scheme and user, drop the password
const URL_CREDENTIALS_RE = /\b([a-z][a-z0-9+.-]*:\/\/)([^\s:@/]+):([^\s@/]{3,})@/gi;

// password = "longvalue"  /  api_key: 'longvalue'
const ASSIGNMENT_RE =
  /\b([A-Za-z0-9_.-]*(?:api[_-]?key|secret|passwd|password|token|auth[_-]?key|private[_-]?key|access[_-]?key)[A-Za-z0-9_.-]*)(\s*[:=]\s*)(["'])([^"'\s]{12,})\3/gi;

const PLACEHOLDER_RE = /^(your|my|<|\$\{|\{\{|%|x{4,}|\*{4,}|change|replace|example|sample|dummy|test|placeholder|todo|insert|enter)/i;

function looksLikeRealSecret(value) {
  if (PLACEHOLDER_RE.test(value)) return false;
  if (/process\.env|os\.environ|getenv|import\.meta/.test(value)) return false;
  if (/^(.)\1+$/.test(value)) return false;
  // Plain lowercase words joined by _ or - (e.g. "password_confirmation") are names, not secrets.
  const hasDigit = /\d/.test(value);
  const hasSymbol = /[^A-Za-z0-9_.-]/.test(value);
  const mixedCase = /[a-z]/.test(value) && /[A-Z]/.test(value);
  return hasDigit || hasSymbol || mixedCase;
}

/**
 * @returns {{ content: string, redactions: number, privateKey: boolean }}
 * When privateKey is true the caller must not store the file at all.
 */
export function scanAndRedact(content) {
  if (PRIVATE_KEY_RE.test(content)) return { content: "", redactions: 0, privateKey: true };

  let redactions = 0;
  let out = content;

  for (const re of TOKEN_PATTERNS) {
    out = out.replace(re, () => {
      redactions++;
      return REDACTED;
    });
  }
  out = out.replace(URL_CREDENTIALS_RE, (m, scheme, user) => {
    redactions++;
    return `${scheme}${user}:${REDACTED}@`;
  });
  out = out.replace(ASSIGNMENT_RE, (m, name, sep, quote, value) => {
    if (!looksLikeRealSecret(value)) return m;
    redactions++;
    return `${name}${sep}${quote}${REDACTED}${quote}`;
  });

  return { content: out, redactions, privateKey: false };
}
