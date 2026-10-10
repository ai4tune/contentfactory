import http from "node:http";

const port = Number(process.env.MOCK_AI_PORT || 4320);
let imageCounter = 0;
let draftCounter = 0;
const agentAttempts = new Map();

const server = http.createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    return json(response, 200, { ok: true });
  }

  if (request.method === "GET" && request.url === "/image-count") {
    return json(response, 200, { count: imageCounter });
  }
  if (request.method === "GET" && request.url === "/draft-count") return json(response, 200, { count: draftCounter });

  if (request.method === "GET" && request.url?.startsWith("/generated/")) {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zs7sAAAAASUVORK5CYII=",
      "base64",
    );
    response.writeHead(200, { "Content-Type": "image/png", "Content-Length": png.length });
    return response.end(png);
  }

  if (request.method === "POST" && request.url?.endsWith("/images/generations")) {
    await readJson(request);
    imageCounter += 1;
    return json(response, 200, {
      created: Date.now(),
      data: [{
        url: `http://127.0.0.1:${port}/generated/xhs-${imageCounter}.png`,
        revised_prompt: `acceptance-image-${imageCounter}`,
      }],
    });
  }

  if (request.method !== "POST" || !request.url?.endsWith("/chat/completions")) {
    return json(response, 404, { error: "not found" });
  }

  const body = await readJson(request);
  if (body.model !== "acceptance-mock") {
    return json(response, 400, { error: { message: `invalid model: ${String(body.model)}` } });
  }
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const system = String(messages.find((message) => message.role === "system")?.content ?? "");
  const user = String(messages.find((message) => message.role === "user")?.content ?? "");
  if (Array.isArray(body.tools) && system.includes("你是小掌柜")) {
    const latestIndex = messages.findLastIndex((message) => message.role === "user");
    const latest = String(messages[latestIndex]?.content ?? "");
    const calls = messages.slice(latestIndex).flatMap((message) => message.tool_calls ?? []).map((call) => call.function.name);
    if (!calls.length && body.tool_choice !== "required") return json(response, 400, { error: { message: "the first agent step must require a real tool call" } });
    const attempts = (agentAttempts.get(latest) ?? 0) + 1;
    agentAttempts.set(latest, attempts);
    if (latest.includes("验收对话故障") && attempts === 1) return json(response, 502, { error: { message: "simulated agent failure" } });
    if (latest.includes("验收保存后故障") && calls.includes("create_draft") && !system.includes('"name":"create_draft"')) return json(response, 502, { error: { message: "simulated failure after saving draft" } });
    if (latest.includes("验收慢任务")) await new Promise((resolve) => setTimeout(resolve, 1200));
    let name, input;
    if (latest.includes("验收循环")) { name = "search_content"; input = { query: `loop-${calls.length}` }; }
    else if (latest.includes("验收越权读取")) { name = "read_content"; input = { projectId: "other-account-project" }; }
    else if (latest.includes("验收缺资料")) { name = "request_input"; input = { question: "请选择要使用的本地资料。" }; }
    else if (latest.includes("验收续聊") && !calls.includes("read_content")) {
      const refs = JSON.parse(system.match(/本对话已保存的真实草稿引用：(\[[^\n]*\])/)?.[1] ?? "[]");
      name = "read_content"; input = { projectId: refs[0]?.projectId ?? "missing-result" };
    }
    else if (latest.includes("验收续聊") && !calls.includes("read_knowledge")) {
      const refs = JSON.parse(system.match(/本对话此前提供的可读资料：(\[[^\n]*\])/)?.[1] ?? "[]");
      name = "read_knowledge"; input = { sourceId: refs[0]?.id ?? "missing-source" };
    }
    else if (!calls.includes("get_business_context")) { name = "get_business_context"; input = {}; }
    else if (latest.includes("验收查旧内容") && !calls.includes("search_content")) { name = "search_content"; input = { query: "" }; }
    else if (latest.includes("验收历史对话") && !calls.includes("search_conversation")) { name = "search_conversation"; input = { query: "鲜花" }; }
    else if (latest.includes("验收写作") && !calls.includes("load_skill")) { name = "load_skill"; input = { name: "writing" }; }
    else if (latest.includes("验收写作") && !calls.includes("create_draft") && !system.includes('"name":"create_draft"')) {
      name = "create_draft";
      const sources = JSON.parse(system.match(/本次选中的本地文件：(\[[^\n]*\])/)?.[1] ?? "[]");
      input = { topic: "介绍我们的鲜花花束服务", channel: "wechat_article", instructions: "验收发布交付", sourceIds: sources.map((item) => item.id) };
    }
    const previousDraft = JSON.parse(system.match(/本对话已保存的真实草稿引用：(\[[^\n]*\])/)?.[1] ?? "[]")[0];
    if (latest.includes("验收忽略工具约束")) name = undefined;
    const answer = latest.includes("验收续聊") ? `已读取你的草稿：https://www.example.com/drafts/${previousDraft.projectId}` : "已按当前账号资料处理，结果已保存。草稿仍待人工核对，尚未发布。";
    return json(response, 200, { id: `agent-${attempts}`, model: body.model, object: "chat.completion", created: 1,
      choices: [{ index: 0, finish_reason: name ? "tool_calls" : latest.includes("验收截断") ? "length" : "stop", message: { role: "assistant", content: name ? latest.includes("验收循环") ? "还在处理" : "" : answer,
        ...(name ? { tool_calls: Array.from({ length: name === "create_draft" && latest.includes("验收并行") ? 2 : 1 }, (_, index) => ({ id: `tool-${attempts}-${index}`, type: "function", function: { name, arguments: JSON.stringify(input) } })) } : {}) } }],
      usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
    });
  }
  if (system.includes("成稿事实核验员") && user.includes("验收核对不可用")) {
    return json(response, 502, { error: { message: "simulated grounding failure" } });
  }
  if (system.includes("独立审核员") && user.includes("验收语义审核不可用")) {
    return json(response, 502, { error: { message: "simulated semantic review failure" } });
  }
  if (system.includes("经营访谈内容顾问") && user.includes("验收访谈失败")) {
    return json(response, 502, { error: { message: "simulated interview failure" } });
  }
  if (system.includes("企业内容策略规划师")) {
    const batchSize = Number(system.match(/items 本批必须恰好 (\d+) 个/)?.[1]);
    if (!batchSize || batchSize > 10) return json(response, 504, { error: "simulated gateway timeout for oversized plan" });
  }
  if (system.includes("写作风格分析师") && Number(process.env.MOCK_STYLE_DELAY_MS) > 0) {
    await new Promise((resolve) => setTimeout(resolve, Number(process.env.MOCK_STYLE_DELAY_MS)));
  }
  if (system.includes("实拍素材顾问") && Number(process.env.MOCK_PHOTO_DELAY_MS) > 0) await new Promise((resolve) => setTimeout(resolve, Number(process.env.MOCK_PHOTO_DELAY_MS)));
  if (system.includes("企业内容策略规划师") && Number(process.env.MOCK_PLAN_DELAY_MS) > 0) {
    await new Promise((resolve) => setTimeout(resolve, Number(process.env.MOCK_PLAN_DELAY_MS)));
  }
  const content = JSON.stringify(mockCompletion(system, user, String(messages.at(-1)?.content ?? user)));

  return json(response, 200, {
    id: "acceptance-mock",
    choices: [{ message: { role: "assistant", content } }],
  });
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`mock-ai-ready:${port}\n`);
});

function mockCompletion(system, user, latestUser) {
  if (system.includes("实拍素材顾问")) {
    const input = JSON.parse(user);
    return { photoSuggestions: [{ purpose: "说明花束服务", subject: "本次实际制作的花束", how: "用自然光拍摄主体", placement: "业务介绍段落旁", fallback: "没有实拍时先用文字介绍，不用AI图冒充实拍", sourceIds: [input.sources[0].id] }] };
  }
  if (system.includes("编辑") && system.includes('"photoSuggestions"') && user.includes("验收发布交付")) {
    draftCounter += 1;
    const sourceId = user.includes("验收非法实拍来源") ? "foreign-account-source" : user.match(/"sourceId":\s*"([^"]+)"/)?.[1];
    return { title: "认识我们的花束服务", titleOptions: ["用鲜花介绍我们的业务", "先聊聊花束制作"], summary: "这是一段不复制进正文的摘要。", tags: ["花束", "花艺"],
      content: "## 花束服务\n\n我们制作**鲜花花束**，提供花艺服务。\n\n欢迎提出你想了解的问题。",
      photoSuggestions: [{ purpose: "介绍本次真实业务", subject: "本次实际制作的花束", how: "用自然光拍摄主体，背景简洁", placement: "业务介绍段落旁", fallback: "没有实拍先用文字介绍，不用AI图冒充实拍", sourceIds: [sourceId] }] };
  }
  if (system.includes("成稿事实核验员")) {
    const payload = JSON.parse(user);
    const draft = payload.content;
    if (draft.includes("验收核对格式错误")) return { verdict: "supported", issues: "invalid" };
    if (draft.includes("果香") && !payload.sources.some((source) => source.text.includes("已确认提供果香咖啡"))) return { verdict: "unsupported", issues: [{ originalText: "果香", reason: "资料没有提供产品风味" }] };
    return { verdict: "supported", issues: [] };
  }
  if (system.includes("经营访谈内容顾问")) {
    const answers = JSON.parse(user);
    if (user.includes("验收访谈空方向")) return { accountPosition: "", contentPillars: [] };
    return {
      accountPosition: `围绕${answers.goal}介绍${answers.offer}`,
      targetAudience: [answers.audience || "附近顾客（待验证）"],
      contentPillars: user.includes("验收访谈对象方向") ? [{ title: "产品介绍", description: "介绍本次真实服务" }, { title: "到店场景" }]
        : user.includes("验收访谈文本方向") ? "产品介绍\n到店场景\n日常经营" : ["产品介绍", "到店场景", "日常经营"],
      contentAngles: ["从本次目标出发"], recommendedTopics: ["先认识这家店", "本周主推产品", "什么情况下适合来"],
      questionsToConfirm: answers.audience ? [] : ["哪些顾客真的会因为内容到店？"],
    };
  }
  if (system.includes("企业知识库整理助手")) {
    const sources = JSON.parse(user.split("\n").slice(1).join("\n"));
    return {
      summary: `已为 ${sources.length} 份资料生成目录方案。`,
      assignments: sources.map((source, index) => ({
        sourceId: source.id,
        folderId: index === 0 ? "offers" : "pending",
        reason: index === 0 ? "主要内容是产品和服务。" : "需要人工确认。",
      })),
    };
  }
  if (system.includes("企业知识档案编译器")) {
    const sourceId = user.match(/^\[([^\]]+)]/m)?.[1]
      ?? user.match(/"sourceIds":\["([^"]+)"/)?.[1]
      ?? "local:flooring.md";
    return {
      name: "验收企业知识档案",
      businessSummary: "为装修家庭提供地板选购、安装与售后决策支持。",
      targetCustomers: ["第一次装修的家庭"],
      offers: [{
        name: "地板选购顾问服务",
        description: "结合空间、基层、安装与售后条件给出选购建议。",
        differentiators: ["基于真实使用条件判断"],
        sourceIds: [sourceId],
      }],
      strengths: ["能把复杂选购条件整理成清单"],
      businessGoals: ["建立信任并获得有效咨询"],
      preferredTopics: ["选购避坑", "安装知识"],
      forbiddenClaims: ["绝对零风险"],
      facts: [
        { category: "服务", statement: "提供地板选购顾问服务。", confidence: "confirmed", sourceIds: [sourceId] },
        { category: "业绩", statement: "已经服务一万名客户。", confidence: "confirmed", sourceIds: [] },
      ],
      gaps: ["具体收费标准仍需确认"],
    };
  }

  if (system.includes("企业内容运营复盘顾问")) {
    const payload = JSON.parse(user);
    const publications = payload.publications ?? [];
    const evidence = (publication) => [{
      contentPlanItemId: publication.contentPlanItemId,
      publicationId: publication.publicationId,
      label: `${publication.title}：阅读 ${publication.views}，点赞 ${publication.likes}，线索 ${publication.leads}`,
    }];
    return {
      continue: publications[0] ? [{
        title: "继续使用具体问题切入",
        rationale: "这条内容已有真实阅读和互动反馈，可以继续验证同类角度。",
        evidence: evidence(publications[0]),
      }] : [],
      reduce: [],
      adjust: publications[1] ? [{
        title: "调整转化动作",
        rationale: "已有互动但线索仍需继续观察，下一周应测试更清晰的行动提示。",
        evidence: evidence(publications[1]),
      }] : [],
      dataGaps: ["尚未记录成交结果，不能判断商业转化。"],
    };
  }

  if (system.includes("企业内容策略规划师")) {
    const regenerated = user.includes("人工确认保留的选题");
    const incompletePillars = user.includes("验收缺失内容支柱");
    const batchRange = user.match(/【本批次】只生成第 (\d+)～(\d+) 个新选题/);
    const start = batchRange ? Number(batchRange[1]) : 1;
    const count = batchRange ? Number(batchRange[2]) - start + 1 : 30;
    const prefix = regenerated ? "重新生成选题" : "首月选题";
    return {
      title: "验收账号 30 天内容计划",
      pillars: incompletePillars ? ["选购避坑", { name: "安装知识" }] : [
        { name: "选购避坑", description: "帮助客户建立正确的判断标准" },
        { name: "安装知识", description: "解释真实使用和交付条件" },
        { name: "真实案例", description: "用已确认案例建立信任" },
      ],
      items: Array.from({ length: count }, (_, index) => ({
        title: `${prefix} ${start + index}`,
        angle: `从客户第 ${start + index} 个常见问题切入`,
        pillarIndex: (start + index - 1) % 3,
        objective: ["reach", "trust", "conversion"][(start + index - 1) % 3],
        rationale: `对应目标客户的第 ${start + index} 个决策问题`,
        evidence: [{
          type: start + index === 1 ? "enterprise_knowledge" : "customer_pain",
          ...(start + index === 1 ? { refId: "local:flooring.md" } : {}),
          label: start + index === 1 ? "地板选购资料" : `待验证的客户问题 ${start + index}`,
        }],
      })),
    };
  }

  if (system.includes("写作风格分析师")) {
    if (user.includes("本地流程演示")) {
      const sourceId = user.match(/\[([^\]]+)\][^\n]*\n角色:/)?.[1];
      const excerpt = "先把问题说清楚，再给出可执行的建议。";
      return { name: "本地流程演示 · 文章风格", persona: "以品牌介绍者的视角清楚表达", readerRelationship: "向读者说明真实信息", values: ["真实", "清楚"], tone: ["自然", "清晰"], preferredPhrases: [], bannedPhrases: [], channelOverrides: {},
        rules: [{ id: "demo-rule", category: "narrative", priority: "soft", instruction: "先说明问题，再提供具体建议。", evidence: [{ sourceId, excerpt }] }],
        examples: [{ id: "demo-example", sourceId, title: "用户选择的原文", excerpt, purpose: "只学习表达方式" }] };
    }
    return {
      name: "验收账号默认风格",
      persona: "做过真实项目、能把技术讲明白的建材与 AI 实践者",
      readerRelationship: "像和熟悉的同行复盘刚完成的真实工作",
      values: ["事实优先", "给出具体下一步"],
      tone: ["真诚", "克制", "技术人讲人话"],
      rules: [
        {
          id: "style-rule-001",
          category: "rhythm",
          priority: "hard",
          instruction: "公众号正文使用自然段，不把完整口语拆成密集短句。",
          evidence: [{
            sourceId: "local:style guide.md",
            excerpt: "不要大量使用一句一段的短句结构。",
            note: "风格指南中的明确要求",
          }],
        },
        {
          id: "style-rule-002",
          category: "narrative",
          priority: "soft",
          instruction: "从亲历判断切入，再给出可执行步骤。",
          evidence: [{
            sourceId: "local:approved sample.md",
            excerpt: "我之前一直以为工具选对就够了，后来真正到企业里跑了一遍，才发现问题往往不在工具。",
          }],
        },
        {
          id: "style-rule-003",
          category: "language",
          priority: "hard",
          instruction: "不使用深度赋能等空泛表达。",
          evidence: [{ sourceId: "local:style guide.md", excerpt: "禁用表达：深度赋能。" }],
        },
        {
          id: "style-rule-004",
          category: "boundary",
          priority: "soft",
          instruction: "结论保留真实条件，不作绝对承诺。",
          evidence: [{ sourceId: "local:approved sample.md", excerpt: "这只是我跑完真实项目后的阶段性判断。" }],
        },
      ],
      preferredPhrases: ["后来我发现"],
      bannedPhrases: ["深度赋能"],
      channelOverrides: { moments_post: ["像本人分享最近观察，不写成总结报告。"] },
      examples: [
        {
          id: "style-example-001",
          sourceId: "local:approved sample.md",
          title: "自然讲述样例",
          excerpt: "我之前一直以为工具选对就够了，后来真正到企业里跑了一遍，才发现问题往往不在工具。",
          purpose: "展示自然转折和第一人称判断",
          channel: "wechat_article",
        },
        {
          id: "style-example-002",
          sourceId: "local:approved sample.md",
          title: "克制结论样例",
          excerpt: "这只是我跑完真实项目后的阶段性判断。",
          purpose: "展示真实边界",
          channel: "moments_post",
        },
      ],
    };
  }

  if (system.includes("小红书图文策划")) {
    return {
      items: [
        {
          kind: "cover",
          title: "选地板别只看价格",
          body: "装修决策先看这四项条件",
          prompt: "米白与深绿色的现代家居空间，地板纹理清晰，主体明确，画面不含任何文字。",
        },
        {
          kind: "card",
          layout: "explain",
          title: "低价为什么不等于省钱",
          body: "单价只是一个变量，空间、基层、安装与售后共同影响最终结果。",
          points: [],
        },
        {
          kind: "card",
          layout: "steps",
          title: "先确认空间和基层",
          body: "使用环境决定材料和安装条件，先核对实际情况再比较产品。",
          points: ["确认房间用途", "检查基层平整度"],
        },
        {
          kind: "card",
          layout: "checklist",
          title: "再核对安装与售后",
          body: "把隐性成本和责任边界提前问清楚。",
          points: ["安装方式与费用", "问题处理和售后边界"],
        },
        {
          kind: "card",
          layout: "summary",
          title: "带着四项清单再咨询",
          body: "空间、基层、安装、售后都明确后，价格比较才有意义。",
          points: ["收藏这份清单", "结合真实条件人工确认"],
        },
      ],
    };
  }

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
      analysisEvidence: user.includes("验收企业知识档案")
        ? ["已读取并引用验收企业知识档案"]
        : ["目标客户需要降低装修决策风险"],
      questionsToConfirm: ["实际产品参数与售后边界"],
      nextActions: ["选择真实资料生成首批内容"],
    };
  }

  if (system.includes("选题雷达助手")) {
    return {
      keywordGroups: [
        { group: "企业落地", keywords: ["AI 企业落地 第一步", "中小企业 AI 试点 复盘"], intent: "寻找真实落地场景与踩坑经验" },
        { group: "工具应用", keywords: ["普通人 AI 工具 工作流", "AI 提效 真实案例"], intent: "寻找具体可复制的工具用法" },
      ],
      searchTasks: [
        { platform: "小红书", query: "AI 企业落地 真实案例", why: "验证企业用户最关注的结果和阻力" },
        { platform: "小红书", query: "AI 编程 普通人 实战", why: "寻找非技术用户的真实入门问题" },
      ],
      hotSampleInsights: [],
      topicCandidates: [{
        title: "企业第一次做 AI 试点，先别急着买工具",
        platform: "小红书",
        angle: "真实落地复盘",
        sourceKeyword: "AI 企业落地 真实案例",
        priority: "高",
      }],
      validationChecklist: ["优先打开近 7 天且点赞明显高于同关键词其他结果的笔记"],
      nextActions: ["在小红书搜索并用插件筛选已加载结果"],
    };
  }

  if (system.includes("内容选题编辑")) {
    const hasStyle = user.includes("风格档案:");
    return {
      suggestions: [
        {
          title: hasStyle ? "后来我发现，SPC 地板选购不能只看价格" : "SPC 地板选购为什么不能只看价格？",
          angle: "装修决策避坑",
          rationale: "资料给出了空间、基层、安装与售后四个判断维度",
          sourceIds: [readSourceId(user)],
        },
      ],
    };
  }

  if (system.includes("知识匹配编辑")) {
    const refId = user.match(/"refId":"([^"]+)"/)?.[1] ?? "local:flooring.md";
    const sourceType = user.match(/"sourceType":"([^"]+)"/)?.[1] ?? "local";
    return {
      recommendations: [{
        refId,
        sourceType,
        reason: "该资料直接提供当前选题需要的判断标准和行动清单。",
        excerpts: ["SPC 地板选购不能只比较单价，还要确认使用空间、基层条件、安装方式和售后边界。"],
        selected: true,
      }],
    };
  }

  if (system.includes("爆款拆解助手")) {
    return {
      summary: "用反常识开场解释为什么单看价格会做错决策。",
      targetAudience: "第一次装修、缺少判断标准的家庭",
      painPoint: "只会比较单价，不知道还要核对哪些条件",
      hook: "低价不等于省钱",
      pacing: "痛点开场，清单拆解，案例收束",
      evidence: ["安装和售后成本对比", "真实装修决策场景"],
      callToAction: "收藏清单并在决策前逐项核对",
      structure: ["反常识开场", "解释常见误区", "给出四项判断清单", "行动引导", "互动提问"],
      reusablePatterns: ["反常识钩子 + 原因解释", "问题拆解 + 可收藏清单", "克制的咨询引导"],
      keywords: ["装修避坑", "SPC 地板", "价格误区", "安装条件", "售后"],
      adaptationIdeas: ["企业做内容为什么不能只追求日更？"],
      topicCandidates: ["企业内容生产的四项检查清单"],
      riskNotes: ["不要继承原文中的价格、销量和客户案例"],
    };
  }

  if (system.includes("内容策略编辑")) {
    if (user.includes("[confirmed-account:")) {
      const text = user.split("\n").find((line) => line.startsWith('{"name":') && line.includes('"business":'));
      const account = JSON.parse(text);
      return { targetAudience: "希望了解业务的人（待验证）", contentGoal: account.goal, coreMessage: account.business,
        keyPoints: [account.business], outline: ["介绍已知业务", "邀请提出问题"], callToAction: "欢迎提问", openQuestions: ["产品细节待补充"],
        citations: [{ sourceId: readSourceId(user), excerpt: text, purpose: "用户确认的业务信息" }] };
    }
    const hasStyle = user.includes("风格档案:");
    return {
      targetAudience: "第一次装修、需要选择地板的家庭",
      contentGoal: "帮助读者建立完整选购清单并发起专业咨询",
      coreMessage: `${hasStyle ? "后来我发现，" : ""}SPC 地板决策应同时考虑空间、基层、安装和售后，不能只比较单价。`,
      keyPoints: ["先确认使用空间", "检查基层与安装条件", "明确售后边界"],
      outline: [
        { heading: "价格误区", points: ["为什么不能只比较单价"] },
        { heading: "四项判断清单", points: ["空间", "基层", "安装", "售后"] },
        { heading: "咨询前准备", description: "整理真实使用条件" },
      ],
      ...(user.includes("\"hook\": \"低价不等于省钱\"") ? {
        inspirationPlan: {
          items: [
            { kind: "hook", sourceIndex: 0, sourceElement: "低价不等于省钱", decision: "adapt", plannedUse: "用企业内容日更不等于有效增长的反常识开头", rationale: "保留反常识机制，替换为当前账号和选题。" },
            { kind: "section", sourceIndex: 0, sourceElement: "反常识开场", decision: "adopt", plannedUse: "开头指出日更不等于有效内容", rationale: "适合快速建立问题意识。" },
            { kind: "section", sourceIndex: 1, sourceElement: "解释常见误区", decision: "adapt", plannedUse: "解释企业把频率当成果的三个误区", rationale: "需要结合企业场景重新组织。" },
            { kind: "section", sourceIndex: 2, sourceElement: "给出四项判断清单", decision: "adapt", plannedUse: "给出内容生产的四项检查清单", rationale: "保留可收藏机制，事实来自自己的知识。" },
            { kind: "section", sourceIndex: 3, sourceElement: "行动引导", decision: "discard", plannedUse: "", rationale: "参考文章的咨询动作不适合当前目标。" },
            { kind: "section", sourceIndex: 4, sourceElement: "互动提问", decision: "adopt", plannedUse: "询问读者当前最难坚持的内容环节", rationale: "适合当前账号的互动目标。" },
            { kind: "pacing", sourceIndex: 0, sourceElement: "痛点开场，清单拆解，案例收束", decision: "adapt", plannedUse: "先提出反常识，再用清单拆解，最后以问题收束", rationale: "不使用参考案例，只保留节奏。" },
          ],
          boundaries: ["不得照抄参考原句。", "不得继承参考中的事实、案例和数据。"],
        },
      } : {}),
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
    if (user.includes('"id": "starter_')) return { conclusion: "未发现需要修改的问题，发布前请人工确认。", riskLevel: "low", issues: [] };
    return {
      conclusion: `发现一项可自动优化的表达，以及${system.includes("Human Writing 专项检查") ? "三" : "两"}项需要人工确认的问题。`,
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
          severity: "low",
          title: "效果结论需要确认",
          description: "完整决策效果需要结合客户实际资料确认。",
          originalText: "用四项清单完成装修决策。",
          suggestedText: "用四项清单辅助装修决策。",
          autoFixable: true,
          requiresConfirmation: false,
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
        ...[{
          category: "human_writing",
          severity: "low",
          title: "段落没有新增信息",
          description: "这句话只是重复上文结论，没有加入新的观察、证据或判断。",
          originalText: "结论：带着条件清单再咨询。",
          suggestedText: "",
          autoFixable: false,
          requiresConfirmation: true,
        }],
      ],
    };
  }

  if (system.includes("公众号文章编辑")) {
    return { content: `公众号文章\n\n标题：SPC 地板选购不能只看价格\n摘要：用四项清单深度赋能装修决策。\n\n${user.includes("风格档案:") ? "后来我发现，" : ""}一、价格误区\n二、空间与基层\n三、安装和售后\n\n结论：带着条件清单再咨询。` };
  }
  if (system.includes("小红书文案编辑")) {
    return { content: "小红书笔记\n标题1：选 SPC 地板别只看价格\n标题2：装修小白的四项清单\n前三行钩子：低价不等于省钱。\n正文：空间、基层、安装、售后逐项确认。\n#装修避坑 #SPC地板" };
  }
  if (system.includes("朋友圈文案编辑")) {
    if (user.includes("验收已有风味")) return { content: "我们提供果香咖啡。" };
    if (user.includes("验收持续虚构")) return { content: "我们有果香咖啡。" };
    if (user.includes("验收自动修正")) return { content: latestUser.startsWith("上一稿事实核对") ? "我们提供咖啡饮品。" : "我们有果香咖啡。" };
    if (user.includes("验收核对不可用")) return { content: "验收核对不可用：我们提供咖啡。" };
    if (user.includes("验收核对格式错误")) return { content: "验收核对格式错误：我们提供咖啡。" };
    if (user.includes("confirmed-account:")) {
      const account = JSON.parse(user.split("【当前账号上下文】\n\n")[1].split("\n\n【")[0]);
      return { content: `我们叫${account.accountName}，主要做${account.business}。这次先介绍${account.offer}，欢迎提出你想了解的问题。` };
    }
    return { content: "朋友圈文案\n最近遇到不少朋友只拿单价比较地板。真正影响结果的，还有空间、基层、安装和售后。准备装修的朋友，可以先把这四项条件列出来，我们再一起看。" };
  }
  if (system.includes("短视频脚本编辑")) {
    return { content: "短视频脚本\n前三秒：选 SPC 地板，只看价格就容易踩坑。\n画面：四项清单依次出现。\n口播：空间、基层、安装、售后，都要确认。\n结尾：收藏清单，咨询前逐项核对。" };
  }

  return { content: "acceptance mock response" };
}

function readSourceId(user) {
  return user.match(/\[(local:[^\]]+|feishu:[^\]]+|base:[^\]]+|upload:[^\]]+|confirmed-account:[^\]]+|confirmed-knowledge:[^\]]+)\]/)?.[1]
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
