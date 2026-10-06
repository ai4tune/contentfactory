export function knowledgeTaskError(error: unknown) {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : "";
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (name === "TimeoutError" || name === "AbortError" || /timeout|timed out/i.test(message)) {
    return "AI 本批处理超时，已完成的批次仍保留。可以重试继续处理。";
  }
  if (/HTTP_(400|401|403|404)|Missing required env/i.test(`${code} ${message}`)) {
    return "AI 服务配置或请求被拒绝，请联系管理员检查后再重试。";
  }
  return "AI 服务暂时未能完成任务，已完成的批次仍保留。可以重试继续处理。";
}

export function canRetryKnowledgeError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  return !/HTTP_(400|401|403|404)|Missing required env/i.test(`${code} ${message}`);
}
