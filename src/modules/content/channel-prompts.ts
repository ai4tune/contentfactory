import { channelLabels, type ContentChannel } from "./types";
import { writingCraftRules, writingEvidenceRules } from "./writing-rules";

const sharedRules = [
  writingEvidenceRules,
  writingCraftRules,
  "没有资料支持的内容必须明确标记为推断或待确认。",
  "继承账号定位和品牌语气，不得虚构案例、数据或用户证言。",
  "如果简报包含爆款参考，只复用受众洞察、钩子机制、结构和节奏；不得照抄原文句子，不得继承原文数据、案例、产品事实或承诺。",
  "如果简报包含 inspirationPlan，必须按其中未舍弃项的 plannedUse 顺序组织正文，并遵守 boundaries；不得跳过计划后另起一套结构。",
  '只输出 JSON，格式为 {"title":"一个最终标题","titleOptions":["备选标题"],"summary":"可选摘要","content":"最终正文 Markdown","tags":["不带#的话题"],"photoSuggestions":[{"purpose":"用途","subject":"拍什么","how":"怎么拍","placement":"放哪里","fallback":"缺图时怎么办","sourceIds":["本次资料ID"]}]}。',
  "title 与正文必须回应用户本次选题。content 只含发布正文，不带备选标题、摘要栏、写作过程、配图清单或字段标签。脚本的镜头说明属于正文，可保留。",
  "资料只有名称和主营业务时，先写一两段简短介绍，不为凑篇幅罗列可能的产品或服务、不补作者经历。未知细节直接不写，不在发布正文解释‘资料未提供’‘尚未公布’‘没有明确清单’‘还没定好’等未经确认的经营状态，也不承诺后续发布或上新安排。可以自然邀请读者提出问题。",
  "实拍建议不是已存在的照片。按主题提供 0–6 条可执行建议；不适合实拍时为空。对象须由原始资料支持，附 sourceIds；未知场地、设施、人物、活动只可写成明确的条件建议，不声称存在。照片涉及人物时建议避开可识别人脸或使用已获授权的素材。AI 图不能冒充本店实拍。",
].join("\n");

const channelInstructions: Record<ContentChannel, string> = {
  wechat_article: [
    "写一篇可深度阅读的公众号文章。",
    "titleOptions 提供 3 个备选标题，summary 单独给出摘要；content 给出引入和完整论述。小标题、证据或案例、结尾和行动引导按材料、内容目标及已确认用户风格组织，不机械套模板。",
    "优先完整论证和阅读逻辑，不要写成社交媒体短帖。",
    "历史人文题材须交代史实的时间与语境，区分史实、解释和当代判断；不虚构史料、人物对白或动机。关键年代、引文和因果判断缺乏可靠资料时保留待核验，不声称已交叉核实；古今类比说明适用边界。",
  ].join("\n"),
  xiaohongshu_note: [
    "写一篇高信息密度的小红书笔记。",
    "titleOptions 给出 3–5 个备选标题，tags 给出 3–5 个话题；content 包含前三行钩子、短段落正文、适用时的清单或步骤与自然互动句，不标注‘前三行钩子’‘正文’。",
    "避免过度营销、夸张承诺和明显 AI 腔。",
  ].join("\n"),
  moments_post: [
    "写一条适合熟人信任关系的朋友圈文案。",
    "用自然开场、简洁观点和适当的互动或咨询入口组织正文；资料提供真实观察或小故事时才使用，没有时直接介绍已知信息。",
    "保持口语化和克制，不写成长文，不使用硬销式口号。",
  ].join("\n"),
  short_video_script: [
    "写一份可直接口播拍摄的短视频脚本。",
    "结构必须包含：前 3 秒钩子、分镜/画面提示、逐段口播、节奏或停顿建议、屏幕字幕重点和结尾行动引导。",
    "口播句要自然、可以一口气说出，不要把文章改成短句后充当脚本。",
  ].join("\n"),
};

export function getChannelSystemPrompt(channel: ContentChannel) {
  return [
    `你是内容工厂的${channelLabels[channel]}编辑。`,
    channelInstructions[channel],
    sharedRules,
  ].join("\n\n");
}
