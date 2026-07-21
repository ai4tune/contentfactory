import http from "node:http";

const port = Number(process.env.MOCK_AI_PORT || 4320);

const server = http.createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    return json(response, 200, { ok: true });
  }

  if (request.method !== "POST" || !request.url?.endsWith("/chat/completions")) {
    return json(response, 404, { error: "not found" });
  }

  const body = await readJson(request);
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const system = String(messages.find((message) => message.role === "system")?.content ?? "");
  const user = String(messages.find((message) => message.role === "user")?.content ?? "");
  const content = JSON.stringify(mockCompletion(system, user));

  return json(response, 200, {
    id: "acceptance-mock",
    choices: [{ message: { role: "assistant", content } }],
  });
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`mock-ai-ready:${port}\n`);
});

function mockCompletion(system, user) {
  if (system.includes("账号定位顾问")) {
    return {
      accountPosition: "面向装修家庭的建材决策顾问",
      targetAudience: ["第一次装修的家庭"],
      contentPillars: ["选购避坑", "安装知识", "真实案例"],
      keywordSeeds: ["SPC 地板", "装修避坑"],
      benchmarkAccounts: [],
      contentAngles: ["用清单降低决策成本"],
      brandVoice: ["专业", "克制", "清晰"],
      preferredPhrases: ["先确认使用条件"],
      bannedPhrases: ["绝对零风险"],
      recommendedTopics: ["SPC 地板选购不能只看价格"],
      analysisEvidence: ["目标客户需要降低装修决策风险"],
      questionsToConfirm: ["实际产品参数与售后边界"],
      nextActions: ["选择真实资料生成首批内容"],
    };
  }

  if (system.includes("内容选题编辑")) {
    return {
      suggestions: [
        {
          title: "SPC 地板选购为什么不能只看价格？",
          angle: "装修决策避坑",
          rationale: "资料给出了空间、基层、安装与售后四个判断维度",
          sourceIds: [readSourceId(user)],
        },
      ],
    };
  }

  if (system.includes("内容策略编辑")) {
    return {
      targetAudience: "第一次装修、需要选择地板的家庭",
      contentGoal: "帮助读者建立完整选购清单并发起专业咨询",
      coreMessage: "SPC 地板决策应同时考虑空间、基层、安装和售后，不能只比较单价。",
      keyPoints: ["先确认使用空间", "检查基层与安装条件", "明确售后边界"],
      outline: ["价格误区", "四项判断清单", "咨询前准备"],
      callToAction: "整理空间、预算和安装条件后再咨询专业人员。",
      citations: [{
        sourceId: readSourceId(user),
        excerpt: "SPC 地板选购不能只比较单价，还要确认使用空间、基层条件、安装方式和售后边界。",
        purpose: "支撑核心选购判断",
      }],
      openQuestions: ["具体产品参数需要客户资料进一步确认"],
    };
  }

  if (system.includes("独立审核员")) {
    return {
      conclusion: "发现一项可自动优化的表达，以及两项需要人工确认的问题。",
      riskLevel: "medium",
      issues: [
        {
          category: "style",
          severity: "low",
          title: "表达可以更具体",
          description: "将宽泛表述改为更具体的单价比较误区。",
          originalText: "价格误区",
          suggestedText: "单价比较误区",
          autoFixable: true,
          requiresConfirmation: false,
        },
        {
          category: "fact",
          severity: "medium",
          title: "效果结论需要确认",
          description: "完整决策效果需要结合客户实际资料确认。",
          originalText: "用四项清单完成装修决策。",
          suggestedText: "用四项清单辅助装修决策。",
          autoFixable: false,
          requiresConfirmation: true,
        },
        {
          category: "platform",
          severity: "low",
          title: "标题发布前复核",
          description: "发布前确认标题符合当前平台规范。",
          originalText: "标题：SPC 地板选购不能只看价格",
          suggestedText: "标题：选 SPC 地板，先看这四项条件",
          autoFixable: false,
          requiresConfirmation: true,
        },
      ],
    };
  }

  if (system.includes("公众号文章编辑")) {
    return { content: "公众号文章\n\n标题：SPC 地板选购不能只看价格\n摘要：用四项清单完成装修决策。\n\n一、价格误区\n二、空间与基层\n三、安装和售后\n\n结论：带着条件清单再咨询。" };
  }
  if (system.includes("小红书笔记编辑")) {
    return { content: "小红书笔记\n标题1：选 SPC 地板别只看价格\n标题2：装修小白的四项清单\n前三行钩子：低价不等于省钱。\n正文：空间、基层、安装、售后逐项确认。\n#装修避坑 #SPC地板" };
  }
  if (system.includes("朋友圈文案编辑")) {
    return { content: "朋友圈文案\n最近遇到不少朋友只拿单价比较地板。真正影响结果的，还有空间、基层、安装和售后。准备装修的朋友，可以先把这四项条件列出来，我们再一起看。" };
  }
  if (system.includes("短视频脚本编辑")) {
    return { content: "短视频脚本\n前三秒：选 SPC 地板，只看价格就容易踩坑。\n画面：四项清单依次出现。\n口播：空间、基层、安装、售后，都要确认。\n结尾：收藏清单，咨询前逐项核对。" };
  }

  return { content: "acceptance mock response" };
}

function readSourceId(user) {
  return user.match(/\[(local:[^\]]+|feishu:[^\]]+|base:[^\]]+|upload:[^\]]+)\]/)?.[1]
    ?? user.match(/\[([^\]]+)\]/)?.[1]
    ?? "local:acceptance";
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => {
      try { resolve(JSON.parse(body || "{}")); } catch (error) { reject(error); }
    });
    request.on("error", reject);
  });
}

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
