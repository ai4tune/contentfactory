# 内容工厂视频素材库目录 v0.1

> 状态：素材分类、OSS 目录和入库规则基线
> 更新日期：2026-09-24
> 上位路线：`Content-Factory-Video-Production-Roadmap-2026-09-22.md`
> 当前状态：已定义结构，素材尚未上传 OSS

## 1. 这份目录解决什么

视频能力不为某一家店单独堆一套素材。它要建立一个能够跨合香珠、咖啡厅、家装店和其他本地生活行业复用的素材底座：

```text
素材文件进 OSS
      ↓
结构化元数据进素材目录
      ↓
人工可读手册说清“什么时候能用、什么时候不能用”
      ↓
视频引擎按分镜和版权规则选择具体片段
```

Markdown 文档是给人看的手册，不是系统唯一真相。系统的权威记录是数据库或版本化 manifest，手册应由同一份元数据生成，避免文档与素材实际状态分叉。

## 2. 素材库分层

### 2.1 平台通用库 `shared`

可以跨客户和行业复用，但前提是内容工厂拥有或已获得明确授权。典型内容：

- 城市和区域建立镜头；
- 街道、商场、日落、人流等环境氛围；
- 手作、包装、冲泡、打磨、安装等通用动作；
- 纹理、烟雾、蒸汽、光影等过渡和情绪镜头；
- 已授权的背景音乐、音效和片头/片尾元素。

### 2.2 客户私有库 `workspace`

只能在所属 workspace 内使用：

- 门头、店内环境和具体位置；
- 真实商品、价格、包装、员工和客户；
- 工地、施工案例、前后对比；
- 企业内部资料和未公开产品。

客户私有素材不得因为标签相似而被其他店铺的视频任务命中。

## 3. OSS 目录约定

视频媒体与现有图文资产分开。原文件、代理文件和派生物均使用不可变路径：

```text
content-factory-video/
├── shared/
│   └── <asset-id>/
│       ├── original/<original-file>
│       ├── proxy/preview.mp4
│       ├── thumbnail/poster.jpg
│       └── waveform/waveform.json
├── workspaces/<workspace-id>/
│   └── <asset-id>/
│       ├── original/<original-file>
│       ├── proxy/preview.mp4
│       └── thumbnail/poster.jpg
└── outputs/<workspace-id>/<production-id>/<job-id>/
    ├── final.mp4
    └── thumbnail.jpg
```

约束：

- bucket 保持私有，预览和下载使用短时签名 URL；
- 浏览器直传 OSS，大文件不经 Vercel Function 中转；
- 同一原文件通过 checksum 去重，但不跨 workspace 泄露去重命中信息；
- 不覆盖原路径，新版素材生成新 asset ID；
- 删除前检查引用关系，客户私有原片、代理片和派生物使用同一保留策略。

## 4. 元数据与分类

### 4.1 素材文件 `MediaAsset`

每个原始文件至少记录：

| 字段 | 用途 |
|---|---|
| `id` | 稳定素材 ID，不使用文件名作业务主键 |
| `scope` | `shared` 或 `workspace` |
| `workspaceId` | 私有素材必填，通用素材为空 |
| `kind` | `video` / `image` / `audio` |
| `storageKey` | OSS 中的不可变路径 |
| `checksum` | 文件完整性和去重 |
| `duration` / `width` / `height` / `fps` | 技术属性 |
| `sourceType` | `customer_owned` / `platform_created` / `licensed_library` |
| `rightsStatus` | `approved` / `restricted` / `unknown` / `expired` |
| `rightsNote` / `rightsExpiresAt` | 授权证据、渠道和有效期 |
| `reviewStatus` | `draft` / `active` / `disabled` |

### 4.2 可剪片段 `MediaClip`

引擎匹配的不是整个长文件，而是明确的可剪片段。一个视频文件可以有多个 `MediaClip`：

| 字段 | 示例 |
|---|---|
| `startSec` / `endSec` | `10.0` → `13.5` |
| `role` | `hook` / `establishing` / `process` / `detail` / `proof` / `cta` / `transition` |
| `industries` | `common` / `fragrance` / `cafe` / `home_improvement` |
| `scenes` | `city` / `store` / `product` / `craft` / `service` / `delivery` |
| `shotType` | `wide` / `medium` / `closeup` / `macro` |
| `orientation` | `vertical` / `horizontal` / `square` |
| `mood` | `warm` / `calm` / `energetic` / `premium` / `trustworthy` |
| `useCases` | “本地生活开场”、“工艺过程”、“质感特写” |
| `avoidCases` | “不用作门店实拍证据”、“不用于快节奏促销” |
| `suggestedDurationSec` | `1.5–3.0` |
| `qualityScore` | 人工或可解释的技术评分 |

### 4.3 音乐附加字段

音乐和音效还需要：`genre`、`mood`、`energy`、`bpm`、`hasVocals`、`loopable`、`recommendedScenes`、`avoidScenes`、`licenseChannels`、`rightsExpiresAt`。

## 5. 通用素材分类

| 大类 | 典型素材 | 合香珠 | 咖啡厅 | 家装店 |
|---|---|---:|---:|---:|
| 本地建立镜头 | 城市天际线、道路、商圈 | ✓ | ✓ | ✓ |
| 门店氛围 | 推门、灯光、陈列、空镜 | ✓ | ✓ | ✓ |
| 手作过程 | 研磨、称量、包装、装配 | ✓ | ○ | ✓ |
| 烟雾/蒸汽 | 香烟、咖啡蒸汽、逆光飘散 | ✓ | ✓ | — |
| 产品特写 | 材质、纹理、细节、包装 | ✓ | ✓ | ✓ |
| 服务过程 | 试闻、冲泡、咨询、量房 | ✓ | ✓ | ✓ |
| 成果/信任 | 送礼、出杯、完工、客户反馈 | ✓ | ✓ | ✓ |

`✓` 表示高频适用，`○` 表示视具体内容适用，`—` 表示默认不建议。

## 6. 当前待入库清单

| 候选 ID | 素材 | 范围 | 适用场景 | 权利状态 | OSS 状态 |
|---|---|---|---|---|---|
| `tianjin-city-001` | 天津城市航拍 | shared | 天津本地生活开场，约 1.5–3 秒 | Pexels 授权待保存证据 | 待上传 |
| `incense-smoke-001` | 竖屏香烟 | shared | 合香、茶、静谧氛围；不作门店实拍证据 | Pexels 授权待保存证据 | 待上传 |
| `ambient-pad-001` | 低音量环境音垫 | shared | 合香、咖啡、展厅的舒缓叙事 | 平台本地生成 | 待上传 |

当前 `demo/` 中的参考视频只用于分析节奏、字幕和镜头结构。在来源、版权和二次使用授权未确认前，不得上传到 shared 库，也不得进入客户成片。

## 7. 入库 SOP

1. 登记来源、权利证据和可用渠道；
2. 计算 checksum，读取时长、尺寸、帧率、音轨和编码；
3. 上传原文件，生成低码率预览、封面和音频波形；
4. AI 给出初始标签和候选可剪片段；
5. 人工确认 `useCases`、`avoidCases`、起止时间和权利状态；
6. 只有 `rightsStatus=approved` 且 `reviewStatus=active` 的素材可以被自动匹配；
7. 更新结构化索引，并重新生成本文档的素材清单。

## 8. 剪辑匹配规则

引擎按以下顺序决定素材：

1. **硬过滤**：权利可用、scope 合法、workspace 匹配、方向和时长可用；
2. **场景匹配**：行业、镜头角色、场景、景别、情绪与叙事段落匹配；
3. **质量与多样性**：优先高质量素材，避免连续分镜使用同一原片或高度近似画面；
4. **可解释结果**：返回命中标签、选中理由、裁切区间和授权状态；
5. **人工确认**：正式成片前允许替换素材，未确认的产品和门店画面不得被通用素材伪装。

## 9. 首批建库范围

先不追求数量，建立 30–50 个经人工确认的可剪片段和 8–12 条背景音乐/音效，覆盖：

- 本地城市开场；
- 门店环境过渡；
- 手作、冲泡、包装、安装四类过程；
- 材质、产品、礼盒、完工四类细节；
- 舒缓、温暖、明快、可靠四种音乐氛围。

首批用合香珠、咖啡厅和家装店三个场景反向验证标签是否足够通用。只有一个行业能使用的素材不强行标成 `common`。

## 10. 验收标准

- 任意素材可以从文档找到预览、来源、版权、适用场景和禁用场景；
- 同一原片的可用时间段明确，引擎不需要在整条长视频中盲选；
- 合香珠、咖啡厅、家装店各生成一份素材匹配方案，且私有素材没有串库；
- 限制、未知或过期授权的素材无法被自动成片；
- 结构化目录变化后，Markdown 手册可以重新生成，不需要手工双写。
