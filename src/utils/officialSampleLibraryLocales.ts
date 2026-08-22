import type { AppLocale, ContentType } from '@/types';

export interface LocalizedBlockSpec {
  title: string;
  content: string;
  contentType?: ContentType;
  tags?: string[];
}

export interface LocalizedStarterCopy {
  spaceName: string;
  groups: [string, string, string, string];
  noteNames: [string, string, string, string, string, string, string];
  welcomeBlocks: LocalizedBlockSpec[];
  projectBlocks: LocalizedBlockSpec[];
  cookbookTitles: [string, string, string, string, string];
  markdownGuide: string;
  weeklyReview: string;
  spacesFeature: string;
  blocksFeature: string;
}

type TranslatedLocale = Exclude<AppLocale, 'en'>;

const sharedSnippet = `const tinyNote = {
  localFirst: true,
  formats: ['blocks', 'markdown', 'writer'],
  superpower: 'knowledge you can reuse'
};

console.log(tinyNote.superpower);`;

const sharedApiFixture = `{
  "project": "Starter Kit",
  "status": "in_progress",
  "owners": ["Ada", "Grace"],
  "milestones": 3,
  "offlineReady": true
}`;

const sharedQuery = `SELECT owner, COUNT(*) AS open_tasks
FROM tasks
WHERE completed_at IS NULL
GROUP BY owner
ORDER BY open_tasks DESC;`;

const sharedCommand = `npm install
npm run dev`;

function codeBlock(title: string, content: string, contentType: ContentType, tags: string[]): LocalizedBlockSpec {
  return { title, content, contentType, tags };
}

export const LOCALIZED_STARTER_COPIES: Record<TranslatedLocale, LocalizedStarterCopy> = {
  'zh-Hans': {
    spaceName: 'TinyNote 入门样例库',
    groups: ['01 从这里开始', '02 软件特色', '03 工作流', '04 参考资料'],
    noteNames: ['欢迎使用 TinyNote', 'Markdown 使用指南', '生活各领域的独立空间', '为复用而生的块笔记', '项目启动', '安静的每周回顾', '代码与命令手册'],
    welcomeBlocks: [
      { title: '👋 欢迎——从这里开始', content: `这是你的 TinyNote 入门样例库。它与普通空间完全相同，可以自由编辑或删除。

TinyNote 提供三种互补的笔记格式：块笔记适合保存可复用片段，Markdown 笔记提供源码与预览，文章笔记适合专注长文写作。

点击当前笔记中的块，再浏览左侧目录，亲手试一遍会比阅读说明更快。`, tags: ['入门', 'tinynote'] },
      { title: '1. 用块记录可复用知识', content: `每个块都有独立的标题、内容类型、标签和时间信息。

现在试试：选中当前块，在检查器中修改内容；拖动它改变顺序；点击复制按钮；右键查看插入、复制、粘贴、创建副本和删除等操作。`, tags: ['块笔记', '教程'] },
      codeBlock('2. 用内容类型管理代码片段', sharedSnippet, 'javascript', ['代码', '高亮']),
      { title: '3. 快速找到任何内容', content: `使用笔记列表上方的搜索框筛选当前空间。

Cmd/Ctrl + F：当前空间搜索
Cmd/Ctrl + Shift + F：全局搜索
Cmd/Ctrl + P：最近笔记
Cmd/Ctrl + I：AI 对话

搜索可匹配标题、正文、标签和文档内容。`, tags: ['搜索', '快捷键'] },
      { title: '4. 无锁定的本地组织方式', content: `空间是以 .tinynotes 结尾的文件夹，分组是普通子文件夹，笔记则是 Markdown 文件。

因此你的内容可用文本编辑器阅读，可被系统搜索，适合 Git 管理，也很容易备份。可在“设置 → 数据”查看实际路径。`, contentType: 'markdown', tags: ['本地优先', '组织'] },
      { title: '5. 把 TinyNote 变成自己的工具', content: `在设置中选择主题、语言、布局、界面缩放、备份、Git 同步和 AI 模型。

接下来可以新建一个项目空间，用块笔记保存命令和事实，用 Markdown 编写技术文档，用文章笔记记录完整思考。

需要重新体验时，可随时在“设置 → 样例库”再次导入样例库。`, tags: ['设置', '下一步'] },
    ],
    projectBlocks: [
      { title: '项目简报', content: `目标：发布一个小型文档站，让新用户在五分钟内完成第一个有用结果。

成功信号：首次使用时创建了笔记；成功使用搜索；理解文件保存位置。

约束：一周原型、两名参与者、数据本地优先。`, tags: ['项目', '简报'] },
      { title: '发布检查清单', content: `- [x] 定义用户结果
- [x] 绘制信息架构
- [ ] 构建最小可用流程
- [ ] 邀请三名新用户测试
- [ ] 记录决策和待解决问题
- [ ] 安排复盘`, contentType: 'markdown', tags: ['项目', '清单'] },
      codeBlock('API 响应样例', sharedApiFixture, 'json', ['项目', '数据']),
      codeBlock('实用查询', sharedQuery, 'sql', ['项目', 'sql']),
      codeBlock('本地预览命令', sharedCommand, 'bash', ['项目', '命令']),
      { title: '参考链接', content: `TinyNote 文档：https://tinynote.wu2kong.com/
CommonMark 规范：https://spec.commonmark.org/
Git 文档：https://git-scm.com/doc`, tags: ['链接', '参考'] },
    ],
    cookbookTitles: ['Docker：持续查看日志', 'Git：紧凑历史', 'CSS：居中内容', 'Python：按键分组', 'YAML：小型 CI 任务'],
    markdownGuide: `# Markdown 使用指南

这篇可编辑笔记演示最常用的 Markdown 标记。使用右上角菜单切换编辑、预览和分栏模式。

> Markdown 用纯文本保存结构，因此在 TinyNote 之外也能阅读和迁移。

## 文本与链接

使用 **粗体** 强调、*斜体* 补充语气、~~删除线~~ 标记过期内容，并为链接添加[清晰的说明](https://commonmark.org/)。

## 列表与任务

- 每个项目表达一个想法
  - 缩进可以表示层级
- 保持句式一致

1. 收集
2. 澄清
3. 连接
4. 回顾

- [x] 选择存储文件夹
- [x] 浏览入门样例库
- [ ] 创建第一个个人空间
- [ ] 建立每周回顾习惯

## 表格与简易图表

| 笔记格式 | 适合场景 | 编辑方式 |
|:--|:--|:--|
| 块笔记 | 片段、事实、命令 | 卡片与检查器 |
| Markdown | 文档、研究、技术记录 | 源码与预览 |
| 文章 | 随笔、日记、长文草稿 | 专注编辑器 |

| 活动 | 分钟 | 图示 |
|:--|--:|:--|
| 收集 | 10 | ████ |
| 组织 | 5 | ██ |
| 创作 | 20 | ████████ |
| 回顾 | 15 | ██████ |

## 代码与流程图源码

~~~typescript
type NoteFormat = 'blocks' | 'markdown' | 'writer';
const format: NoteFormat = 'markdown';
~~~

~~~mermaid
flowchart LR
  收集 --> 澄清 --> 连接 --> 创作 --> 回顾
~~~

## 图片与参考资料

~~~markdown
![图片的简短说明](https://example.com/image.png)
~~~

GitHub Flavored Markdown 在 CommonMark 基础上增加了表格、任务列表和删除线。可查看 [CommonMark 规范](https://spec.commonmark.org/)与 [GitHub 写作指南](https://docs.github.com/en/get-started/writing-on-github)。

---

复制这篇笔记，删除不需要的章节，就能得到自己的项目文档模板。
`,
    weeklyReview: `# 一次安静的每周回顾

最有用的笔记系统不是记录一切的系统，而是能在合适的时候把重要内容重新带回视线的系统。

## 清理表面

先收集散落的信息：谈话中的想法、终于可用的命令、等待更多背景的决定。把值得长期保留的片段放进块笔记，方便以后加标签、排序、搜索和复制。

## 寻找变化

用三个问题检查活跃项目：上周以来发生了什么？下一个可见行动是什么？哪些内容可以删除、委托或推迟？短而诚实的回顾，胜过从不执行的完美仪式。

## 建立一个连接

找到两篇有关联的笔记，为它们添加共同标签、放入同一分组，或合并成更清晰的文档。知识在获得上下文后才真正有用。

## 给未来的自己留下线索

最后写下下周最重要的事、仍不确定的地方，以及“足够好”的标准。文章笔记鼓励完整表达，同时底层仍然是可移植的 Markdown 文件。

## 回顾模板

- 本周成果：
- 未完成事项：
- 已做决定：
- 接下来三个行动：
- 一件准备停止做的事：
`,
    spacesFeature: `# 空间：给生活的每个领域一个独立归属

TinyNote 最重要的特色之一，就是可以创建多个空间，让彼此独立的领域拥有清晰边界。

一个巨大的笔记本很快会混入互不相关的内容：工作命令出现在购物清单旁边，学习笔记被旅行计划淹没，书稿又夹在日常片段中。空间让这些内容都触手可及，却不会混在一起。

## 从几个主要领域开始

| 空间 | 适合管理的内容 |
|:--|:--|
| 生活 | 家庭记录、计划、日常流程、常用资料 |
| 工作 | 项目、会议、操作流程、可复用答复 |
| 学习 | 课程、读书笔记、概念与练习 |
| 兴趣 | 摄影、烹饪、游戏、旅行、收藏 |

进入“工作”空间时，侧边栏和空间内搜索只呈现工作知识；切换到“学习”，同一个软件就成为专注的学习环境。

## 主题成长后，创建更具体的空间

- **书籍写作**：研究资料、人物设定、章节草稿、修改清单。
- **摄影**：拍摄地点、相机参数、修图配方、灵感链接。
- **家庭实验室**：服务器命令、网络图、维护记录。
- **导航标签管理**：分类书签、常用工具、链接合集。
- **密码管理流程**：非敏感的账户元数据、恢复流程和安全检查清单。

> TinyNote 保存的是可读的 Markdown 文件，并不是加密密码保险库。真实密码、恢复码和其他秘密应放在可信的专用密码管理器中；TinyNote 适合保存不含秘密的流程与参考资料。

## 如何判断是否需要新空间

当一个主题拥有自己的词汇、工作流或回顾节奏时，可以创建新空间；如果它仍属于同一个工作语境，则放在空间内的分组中。

记住这个规则：**空间分隔不同世界，分组整理同一世界中的资料，笔记承载真正的知识。**
`,
    blocksFeature: `# 块笔记：为了复用和拷贝而设计

块笔记适合保存以后还会再次使用的知识。每个实用内容都是带标题、类型和标签的独立卡片，可以搜索、移动，并一键复制。

## 块为什么实用

一个好的块只完成一个清晰任务。标题让它容易找到，内容类型提供代码高亮，标签把同类内容连接起来，正文则应该无需整理就能直接拷贝使用。

| 场景 | 块的例子 | 实际价值 |
|:--|:--|:--|
| 代码片段 | 日期解析、请求重试、布局居中 | 不必翻旧项目即可复制经过验证的代码 |
| 销售话术 | 开场提问、异议处理、跟进消息 | 保持表达一致，同时方便针对客户调整 |
| 常用命令 | 部署预览、查看日志、修复 Git 分支 | 减少记忆负担和输入错误 |
| 书签收藏 | 设计工具、研究来源、内部看板 | 用标题、标签和上下文管理链接 |
| 常用模板 | 会议总结、Bug 报告、发布清单 | 从可靠结构开始重复工作 |

## 一套实用流程

1. 每次只收集一个可复用项目，而不是整个主题。
2. 用结果命名，例如“Docker：持续查看服务日志”。
3. 选择 JSON、SQL、Markdown、Shell 等内容类型。
4. 用场景和用途添加标签，避免建立过多目录。
5. 从列表或卡片视图直接复制使用。
6. 实际使用发现更好写法时，回到原块持续改进。

## 销售与客服话术库

把开场问题、客户筛选、产品说明、常见异议和跟进消息分别保存成块。复制最接近的一条，调整细节，再把验证有效的改进更新回原块。不要把客户敏感信息保存在可复用块中，示例必须保持通用并移除个人信息。

## 带上下文的书签

普通书签只告诉你页面在哪里；块还能说明它为什么重要、什么时候使用、服务于哪个项目。TinyNote 可以识别块中的链接：只有一个链接时直接打开，多个链接时显示列表。

判断块大小的方法是问自己：“明天复制它，是否几乎不用修改就能使用？”如果答案是否定的，就拆分内容、改清标题，或把较长的解释改成 Markdown 或文章笔记。
`,
  },
  'zh-Hant': {
    spaceName: 'TinyNote 入門範例庫',
    groups: ['01 從這裡開始', '02 軟體特色', '03 工作流程', '04 參考資料'],
    noteNames: ['歡迎使用 TinyNote', 'Markdown 使用指南', '生活各領域的獨立空間', '為重複使用而生的區塊筆記', '專案啟動', '安靜的每週回顧', '程式碼與命令手冊'],
    welcomeBlocks: [
      { title: '👋 歡迎——從這裡開始', content: `這是你的 TinyNote 入門範例庫。它與普通空間完全相同，可以自由編輯或刪除。

TinyNote 提供三種互補格式：區塊筆記適合可重用片段，Markdown 筆記提供原始碼與預覽，文章筆記適合專注長文寫作。

點擊目前筆記中的區塊，再瀏覽左側目錄，親手操作會比閱讀說明更快。`, tags: ['入門', 'tinynote'] },
      { title: '1. 用區塊記錄可重用知識', content: `每個區塊都有獨立的標題、內容類型、標籤和時間資訊。選取這個區塊，在檢查器中修改內容；拖曳改變順序；使用複製按鈕；按右鍵查看插入、複製、貼上、建立副本和刪除等操作。`, tags: ['區塊筆記', '教學'] },
      codeBlock('2. 用內容類型管理程式碼片段', sharedSnippet, 'javascript', ['程式碼', '高亮']),
      { title: '3. 快速找到任何內容', content: `Cmd/Ctrl + F 搜尋目前空間，Cmd/Ctrl + Shift + F 全域搜尋，Cmd/Ctrl + P 開啟最近筆記，Cmd/Ctrl + I 開啟 AI 對話。搜尋可比對標題、正文、標籤和文件內容。`, tags: ['搜尋', '快捷鍵'] },
      { title: '4. 無鎖定的本機組織方式', content: `空間是以 .tinynotes 結尾的資料夾，分組是普通子資料夾，筆記則是 Markdown 檔案。因此內容可由文字編輯器讀取、系統搜尋、Git 管理並輕鬆備份。可在「設定 → 資料」查看路徑。`, contentType: 'markdown', tags: ['本機優先', '組織'] },
      { title: '5. 把 TinyNote 變成自己的工具', content: `在設定中選擇主題、語言、版面、縮放、備份、Git 同步和 AI 模型。接著建立專案空間，以區塊保存命令，以 Markdown 編寫文件，以文章筆記記錄完整思考。`, tags: ['設定', '下一步'] },
    ],
    projectBlocks: [
      { title: '專案簡報', content: `目標：發佈一個小型文件網站，讓新使用者在五分鐘內完成第一個有用結果。成功信號包括建立首篇筆記、成功搜尋並理解檔案位置。限制：一週原型、兩名參與者、資料本機優先。`, tags: ['專案', '簡報'] },
      { title: '發佈檢查清單', content: `- [x] 定義使用者成果
- [x] 繪製資訊架構
- [ ] 建立最小可用流程
- [ ] 邀請三名新使用者測試
- [ ] 記錄決策與問題
- [ ] 安排回顧`, contentType: 'markdown', tags: ['專案', '清單'] },
      codeBlock('API 回應範例', sharedApiFixture, 'json', ['專案', '資料']),
      codeBlock('實用查詢', sharedQuery, 'sql', ['專案', 'sql']),
      codeBlock('本機預覽命令', sharedCommand, 'bash', ['專案', '命令']),
      { title: '參考連結', content: `TinyNote 文件：https://tinynote.wu2kong.com/
CommonMark 規範：https://spec.commonmark.org/
Git 文件：https://git-scm.com/doc`, tags: ['連結', '參考'] },
    ],
    cookbookTitles: ['Docker：持續查看日誌', 'Git：精簡歷史', 'CSS：置中內容', 'Python：依鍵分組', 'YAML：小型 CI 任務'],
    markdownGuide: `# Markdown 使用指南

這篇可編輯筆記示範常用 Markdown 標記。使用右上角選單切換編輯、預覽和分割模式。

> Markdown 以純文字保存結構，因此在 TinyNote 之外也能閱讀和移轉。

## 文字、連結、清單與任務

使用 **粗體**、*斜體*、~~刪除線~~ 和[有說明的連結](https://commonmark.org/)。

- 每個項目表達一個想法
  - 縮排表示層級
- [x] 選擇儲存資料夾
- [x] 瀏覽入門範例庫
- [ ] 建立個人空間

## 表格與簡易圖表

| 筆記格式 | 適合場景 | 編輯方式 |
|:--|:--|:--|
| 區塊 | 片段、事實、命令 | 卡片與檢查器 |
| Markdown | 文件、研究、技術記錄 | 原始碼與預覽 |
| 文章 | 隨筆、日記、長文 | 專注編輯器 |

| 活動 | 分鐘 | 圖示 |
|:--|--:|:--|
| 收集 | 10 | ████ |
| 組織 | 5 | ██ |
| 創作 | 20 | ████████ |

## 程式碼與流程圖原始碼

~~~typescript
type NoteFormat = 'blocks' | 'markdown' | 'writer';
const format: NoteFormat = 'markdown';
~~~

~~~mermaid
flowchart LR
  收集 --> 釐清 --> 連結 --> 創作 --> 回顧
~~~

## 圖片與參考資料

~~~markdown
![圖片的簡短說明](https://example.com/image.png)
~~~

GitHub Flavored Markdown 在 CommonMark 基礎上加入表格、任務清單和刪除線。可查看 [CommonMark 規範](https://spec.commonmark.org/)與 [GitHub 寫作指南](https://docs.github.com/en/get-started/writing-on-github)。
`,
    weeklyReview: `# 一次安靜的每週回顧

最有用的筆記系統不是記錄一切，而是能在適當時候把重要內容帶回視線。

## 清理表面

收集散落的想法、有效的命令和等待背景的決定。把值得保留的片段放進區塊筆記，以便標記、排序、搜尋和複製。

## 尋找變化

問自己：上週以來有何變化？下一個可見行動是什麼？哪些內容可以刪除、委託或延後？短而誠實的回顧勝過從不執行的完美儀式。

## 建立連結並留下線索

找出兩篇相關筆記，加上共同標籤或合併成更清楚的文件。最後寫下下週的重要事項、不確定之處和「足夠好」的標準。

## 回顧範本

- 本週成果：
- 未完成事項：
- 已做決定：
- 接下來三個行動：
- 一件準備停止做的事：
`,
    spacesFeature: `# 空間：給生活的每個領域一個獨立歸屬

TinyNote 的重要特色之一，是可以建立多個空間，讓彼此獨立的領域擁有清楚邊界。生活、工作、學習與興趣可以分開管理；當主題成長後，也能建立書籍寫作、攝影、家庭實驗室或導航書籤等更具體的空間。

| 空間 | 適合管理的內容 |
|:--|:--|
| 生活 | 家庭記錄、計畫、例行流程 |
| 工作 | 專案、會議、程序、可重用答覆 |
| 學習 | 課程、閱讀筆記、概念與練習 |
| 興趣 | 攝影、烹飪、遊戲、旅行 |

進入「工作」空間時，側邊欄和空間內搜尋只呈現工作知識；切換到「學習」，同一個軟體就成為專注的學習環境。

## 更具體的應用空間

- **書籍寫作**：研究、人物設定、章節草稿、修改清單。
- **導航標籤管理**：分類書籤、常用工具和連結集合。
- **密碼管理流程**：非敏感的帳戶資料、恢復流程和安全清單。

> TinyNote 儲存可讀的 Markdown 檔案，並非加密密碼保險庫。真實密碼、恢復碼和其他秘密應放在可信的專用密碼管理器中。

當主題有自己的詞彙、工作流程或回顧節奏時建立新空間；仍共享同一情境的內容則使用分組。**空間分隔世界，分組整理資料，筆記承載知識。**
`,
    blocksFeature: `# 區塊筆記：為重複使用和複製而設計

區塊筆記適合保存未來還會再次使用的知識。每項內容都是帶標題、類型和標籤的獨立卡片，可以搜尋、移動並一鍵複製。

| 場景 | 區塊範例 | 價值 |
|:--|:--|:--|
| 程式碼片段 | 日期解析、請求重試、版面置中 | 直接複製已驗證的程式碼 |
| 銷售話術 | 開場提問、異議處理、跟進訊息 | 維持一致並方便調整 |
| 常用命令 | 部署預覽、查看日誌、修復 Git | 減少記憶負擔和輸入錯誤 |
| 書籤收藏 | 設計工具、研究來源、內部面板 | 用標題、標籤和情境管理連結 |
| 範本 | 會議摘要、Bug 報告、發佈清單 | 從可靠結構開始重複工作 |

## 實用流程

1. 每次只保存一個可重用項目。
2. 用結果命名，例如「Docker：持續查看服務日誌」。
3. 選擇適合的內容類型並加入情境標籤。
4. 從清單或卡片直接複製使用。
5. 根據實際使用持續改進原始區塊。

銷售與客服可將開場問題、產品說明、常見異議和跟進訊息分開保存。不要在可重用區塊中存放客戶敏感資訊。

普通書籤只告訴你網址；區塊還能說明為何重要、何時使用。TinyNote 能辨識區塊中的連結並快速開啟。

一個好區塊應該能在明天被直接複製，幾乎不用修改。如果不能，就拆分內容、改善標題，或改用 Markdown／文章筆記。
`,
  },
  ja: {
    spaceName: 'TinyNote スターターキット',
    groups: ['01 はじめに', '02 ソフトウェアの特長', '03 ワークフロー', '04 リファレンス'],
    noteNames: ['TinyNote へようこそ', 'Markdown ガイド', '暮らしの各領域に独立したスペース', '再利用のためのブロックノート', 'プロジェクト立ち上げ', '静かな週次レビュー', 'コードとコマンド集'],
    welcomeBlocks: [
      { title: '👋 ようこそ — ここから始めましょう', content: `これは TinyNote のスターターキットです。通常のスペースと同じように、自由に編集または削除できます。

ブロックノートは再利用する断片、Markdown ノートはソースとプレビュー、記事ノートは長文の集中執筆に向いています。左側のフォルダーを開き、実際に操作してみてください。`, tags: ['入門', 'tinynote'] },
      { title: '1. 再利用する知識をブロックで保存', content: `各ブロックにはタイトル、種類、タグ、日時があります。このブロックを選び、内容を編集し、ドラッグで並べ替え、コピーや右クリックメニューも試してください。`, tags: ['ブロック', 'チュートリアル'] },
      codeBlock('2. コンテンツ種類でスニペットを管理', sharedSnippet, 'javascript', ['コード', 'ハイライト']),
      { title: '3. すばやく検索', content: `Cmd/Ctrl + F は現在のスペース、Cmd/Ctrl + Shift + F は全体検索、Cmd/Ctrl + P は最近のノート、Cmd/Ctrl + I は AI チャットです。タイトル、本文、タグ、文書内容を検索できます。`, tags: ['検索', 'ショートカット'] },
      { title: '4. ロックインされない整理', content: `スペースは .tinynotes フォルダー、グループは通常のサブフォルダー、ノートは Markdown ファイルです。テキストエディター、システム検索、Git、バックアップをそのまま利用できます。`, contentType: 'markdown', tags: ['ローカル優先', '整理'] },
      { title: '5. TinyNote を自分の道具に', content: `設定でテーマ、言語、レイアウト、ズーム、バックアップ、Git 同期、AI モデルを選べます。プロジェクト用スペースを作り、用途ごとに三つのノート形式を使い分けてみましょう。`, tags: ['設定', '次のステップ'] },
    ],
    projectBlocks: [
      { title: 'プロジェクト概要', content: `目標：新規ユーザーが五分以内に最初の成果を得られる小さなドキュメントサイトを公開する。指標は初回ノート作成、検索成功、保存場所の理解。条件は一週間、二名、ローカル優先です。`, tags: ['プロジェクト', '概要'] },
      { title: '公開チェックリスト', content: `- [x] ユーザー成果を定義
- [x] 情報設計を描く
- [ ] 最小の有用フローを作る
- [ ] 初めてのユーザー三名でテスト
- [ ] 決定と疑問を記録
- [ ] 振り返りを予定`, contentType: 'markdown', tags: ['プロジェクト', 'チェックリスト'] },
      codeBlock('API レスポンス例', sharedApiFixture, 'json', ['プロジェクト', 'データ']),
      codeBlock('便利なクエリ', sharedQuery, 'sql', ['プロジェクト', 'sql']),
      codeBlock('ローカルプレビューコマンド', sharedCommand, 'bash', ['プロジェクト', 'コマンド']),
      { title: '参考リンク', content: `TinyNote ドキュメント：https://tinynote.wu2kong.com/
CommonMark 仕様：https://spec.commonmark.org/
Git ドキュメント：https://git-scm.com/doc`, tags: ['リンク', '参考'] },
    ],
    cookbookTitles: ['Docker：ログを追跡', 'Git：簡潔な履歴', 'CSS：中央配置', 'Python：キーで分類', 'YAML：小さな CI ジョブ'],
    markdownGuide: `# Markdown ガイド

よく使う Markdown 記法を示す編集可能なノートです。右上で編集、プレビュー、分割表示を切り替えます。

> Markdown は構造をプレーンテキストで保存するため、TinyNote の外でも読めます。

## テキスト、リンク、リスト

**太字**、*斜体*、~~取り消し線~~、[説明付きリンク](https://commonmark.org/)を利用できます。

- 一項目に一つの考え
  - インデントで階層化
- [x] 保存フォルダーを選択
- [x] スターターキットを確認
- [ ] 個人スペースを作成

## 表と簡単なチャート

| 形式 | 向いている用途 | 編集方法 |
|:--|:--|:--|
| ブロック | スニペット、事実、コマンド | カードとインスペクター |
| Markdown | 文書、調査、技術ノート | ソースとプレビュー |
| 記事 | エッセイ、日記、長文 | 集中エディター |

| 活動 | 分 | 表示 |
|:--|--:|:--|
| 収集 | 10 | ████ |
| 整理 | 5 | ██ |
| 作成 | 20 | ████████ |

## コードと図のソース

~~~typescript
type NoteFormat = 'blocks' | 'markdown' | 'writer';
const format: NoteFormat = 'markdown';
~~~

~~~mermaid
flowchart LR
  収集 --> 明確化 --> 接続 --> 作成 --> 振り返り
~~~

画像は説明的な代替テキストを付けます：

~~~markdown
![画像の短い説明](https://example.com/image.png)
~~~

[CommonMark 仕様](https://spec.commonmark.org/)と [GitHub の記述ガイド](https://docs.github.com/en/get-started/writing-on-github)も参照してください。
`,
    weeklyReview: `# 静かな週次レビュー

役立つノートシステムとは、すべてを記録するものではなく、必要な情報を適切な時に再び見せてくれるものです。

## 表面を片付ける

会話のアイデア、動作したコマンド、保留中の決定を集めます。残したい断片はブロックノートへ移し、タグ、並べ替え、検索、コピーをしやすくします。

## 変化を見る

前回から何が変わったか、次に見える行動は何か、何を削除・委任・延期できるかを確認します。短く率直なレビューは、実行されない完璧な儀式より有効です。

## つながりと手がかりを残す

関連する二つのノートに共通タグを付けるか、一つの明確な文書にまとめます。最後に来週重要なこと、不確かなこと、「十分良い」の基準を記します。

## レビューテンプレート

- 成果：
- 未完了：
- 決定事項：
- 次の三つの行動：
- やめること：
`,
    spacesFeature: `# スペース：暮らしの各領域に専用の場所を

TinyNote の重要な特長は、複数のスペースを作り、互いに独立した領域を分けて管理できることです。生活、仕事、学習、趣味を分けるだけでなく、テーマが大きくなったら本の執筆、写真、ホームラボ、ブックマーク管理など専用スペースも作れます。

| スペース | 保存する内容 |
|:--|:--|
| 生活 | 家庭の記録、予定、習慣、資料 |
| 仕事 | プロジェクト、会議、手順、定型回答 |
| 学習 | 講座、読書ノート、概念、練習 |
| 趣味 | 写真、料理、ゲーム、旅行、収集 |

仕事スペースに入ると、サイドバーと検索は仕事の知識に集中します。学習に切り替えれば、同じアプリが学習環境になります。

## 具体的なスペース

- **本の執筆**：調査、登場人物、章の草稿、推敲リスト。
- **ナビゲーションハブ**：分類したブックマーク、よく使うツール、リンク集。
- **パスワード運用**：秘密ではないアカウント情報、復旧手順、セキュリティチェック。

> TinyNote は読み取り可能な Markdown を保存し、暗号化されたパスワード保管庫ではありません。実際のパスワードや復旧コードは信頼できる専用パスワードマネージャーに保存してください。

独自の用語、手順、見直し周期を持つテーマは新しいスペースにし、同じ文脈を共有する内容はグループにします。**スペースは世界を分け、グループは資料を整理し、ノートは知識を記録します。**
`,
    blocksFeature: `# ブロックノート：コピーして再利用するために

ブロックノートは、再び使う知識のための形式です。役立つ項目をタイトル、種類、タグ付きの独立カードにして、検索、移動、ワンクリックコピーができます。

| 場面 | ブロック例 | 効果 |
|:--|:--|:--|
| コードスニペット | 日付解析、再試行、中央配置 | 検証済みコードをすぐコピー |
| セールストーク | 質問、反論対応、フォロー | 表現を統一しつつ調整しやすい |
| よく使うコマンド | ログ確認、デプロイ、Git 修復 | 記憶負担と入力ミスを削減 |
| ブックマーク | ツール、調査資料、ダッシュボード | タイトル、タグ、文脈で整理 |
| テンプレート | 会議記録、バグ報告、公開リスト | 信頼できる構造から開始 |

## 実用的な流れ

1. 一つの再利用項目だけを保存します。
2. 「Docker：サービスログを追跡」のように結果で命名します。
3. 内容種類と文脈タグを選びます。
4. 一覧やカードから直接コピーします。
5. 実際の使用から得た改善を元ブロックへ戻します。

営業やサポートでは、導入質問、製品説明、よくある反論、フォロー文を別ブロックにします。顧客の機密情報は保存せず、例から個人情報を除いてください。

通常のブックマークは場所だけですが、ブロックなら重要な理由や使う場面も記録できます。TinyNote はブロック内のリンクを検出して素早く開けます。

良いブロックの基準は「明日コピーして、ほぼ修正なしで使えるか」です。できなければ分割するか、長い説明を Markdown または記事ノートにします。
`,
  },
  ko: {
    spaceName: 'TinyNote 스타터 키트',
    groups: ['01 시작하기', '02 소프트웨어 특징', '03 워크플로', '04 참고 자료'],
    noteNames: ['TinyNote 시작하기', 'Markdown 사용 안내', '삶의 각 영역을 위한 독립 공간', '재사용을 위한 블록 노트', '프로젝트 시작', '조용한 주간 회고', '코드와 명령 모음'],
    welcomeBlocks: [
      { title: '👋 환영합니다 — 여기서 시작하세요', content: `이 공간은 TinyNote 스타터 키트입니다. 일반 공간과 똑같이 자유롭게 편집하거나 삭제할 수 있습니다.

블록 노트는 재사용할 조각, Markdown 노트는 소스와 미리보기, 문서 노트는 긴 글에 적합합니다. 왼쪽 폴더를 둘러보고 직접 조작해 보세요.`, tags: ['시작', 'tinynote'] },
      { title: '1. 재사용할 지식을 블록으로 저장', content: `각 블록에는 제목, 콘텐츠 유형, 태그와 시간이 있습니다. 이 블록을 선택해 내용을 편집하고, 드래그로 순서를 바꾸고, 복사 버튼과 오른쪽 클릭 메뉴를 사용해 보세요.`, tags: ['블록', '튜토리얼'] },
      codeBlock('2. 콘텐츠 유형으로 스니펫 관리', sharedSnippet, 'javascript', ['코드', '강조']),
      { title: '3. 빠르게 검색하기', content: `Cmd/Ctrl + F는 현재 공간 검색, Cmd/Ctrl + Shift + F는 전체 검색, Cmd/Ctrl + P는 최근 노트, Cmd/Ctrl + I는 AI 채팅입니다. 제목, 본문, 태그와 문서 내용을 검색합니다.`, tags: ['검색', '단축키'] },
      { title: '4. 종속되지 않는 로컬 구성', content: `공간은 .tinynotes 폴더, 그룹은 일반 하위 폴더, 노트는 Markdown 파일입니다. 텍스트 편집기, 시스템 검색, Git과 백업을 그대로 이용할 수 있습니다.`, contentType: 'markdown', tags: ['로컬 우선', '구성'] },
      { title: '5. TinyNote를 나만의 도구로', content: `설정에서 테마, 언어, 레이아웃, 확대/축소, 백업, Git 동기화와 AI 모델을 선택하세요. 프로젝트 공간을 만든 뒤 용도에 맞게 세 가지 노트 형식을 사용해 보세요.`, tags: ['설정', '다음 단계'] },
    ],
    projectBlocks: [
      { title: '프로젝트 개요', content: `목표: 신규 사용자가 5분 안에 첫 유용한 결과를 얻도록 돕는 작은 문서 사이트를 출시합니다. 지표는 첫 노트 작성, 검색 성공, 저장 위치 이해입니다. 제약은 1주, 참여자 2명, 로컬 우선 데이터입니다.`, tags: ['프로젝트', '개요'] },
      { title: '출시 체크리스트', content: `- [x] 사용자 결과 정의
- [x] 정보 구조 설계
- [ ] 가장 작은 유용한 흐름 구축
- [ ] 신규 사용자 세 명과 테스트
- [ ] 결정과 질문 기록
- [ ] 회고 일정 잡기`, contentType: 'markdown', tags: ['프로젝트', '체크리스트'] },
      codeBlock('API 응답 예시', sharedApiFixture, 'json', ['프로젝트', '데이터']),
      codeBlock('유용한 쿼리', sharedQuery, 'sql', ['프로젝트', 'sql']),
      codeBlock('로컬 미리보기 명령', sharedCommand, 'bash', ['프로젝트', '명령']),
      { title: '참고 링크', content: `TinyNote 문서: https://tinynote.wu2kong.com/
CommonMark 명세: https://spec.commonmark.org/
Git 문서: https://git-scm.com/doc`, tags: ['링크', '참고'] },
    ],
    cookbookTitles: ['Docker: 로그 따라가기', 'Git: 간결한 기록', 'CSS: 콘텐츠 가운데 배치', 'Python: 키로 그룹화', 'YAML: 작은 CI 작업'],
    markdownGuide: `# Markdown 사용 안내

자주 사용하는 Markdown 문법을 보여 주는 편집 가능한 노트입니다. 오른쪽 위에서 편집, 미리보기, 분할 모드를 전환하세요.

> Markdown은 구조를 일반 텍스트로 저장하므로 TinyNote 밖에서도 읽을 수 있습니다.

## 텍스트, 링크, 목록

**굵게**, *기울임*, ~~취소선~~과 [설명 있는 링크](https://commonmark.org/)를 사용할 수 있습니다.

- 항목마다 한 가지 생각
  - 들여쓰기로 계층 표현
- [x] 저장 폴더 선택
- [x] 스타터 키트 살펴보기
- [ ] 개인 공간 만들기

## 표와 간단한 차트

| 형식 | 적합한 용도 | 편집 방식 |
|:--|:--|:--|
| 블록 | 스니펫, 사실, 명령 | 카드와 검사기 |
| Markdown | 문서, 조사, 기술 노트 | 소스와 미리보기 |
| 문서 | 에세이, 일기, 긴 글 | 집중 편집기 |

| 활동 | 분 | 시각화 |
|:--|--:|:--|
| 수집 | 10 | ████ |
| 정리 | 5 | ██ |
| 작성 | 20 | ████████ |

## 코드와 다이어그램 소스

~~~typescript
type NoteFormat = 'blocks' | 'markdown' | 'writer';
const format: NoteFormat = 'markdown';
~~~

~~~mermaid
flowchart LR
  수집 --> 명확화 --> 연결 --> 작성 --> 검토
~~~

~~~markdown
![이미지에 대한 짧은 설명](https://example.com/image.png)
~~~

[CommonMark 명세](https://spec.commonmark.org/)와 [GitHub 작성 안내](https://docs.github.com/en/get-started/writing-on-github)를 참고하세요.
`,
    weeklyReview: `# 조용한 주간 회고

가장 유용한 노트 시스템은 모든 것을 기록하는 시스템이 아니라 필요한 정보를 알맞은 때에 다시 보여 주는 시스템입니다.

## 표면 정리

대화의 아이디어, 작동한 명령, 보류된 결정을 모읍니다. 오래 남길 조각은 블록 노트로 옮겨 태그, 정렬, 검색, 복사를 쉽게 만드세요.

## 변화 찾기

지난 회고 뒤 무엇이 바뀌었는지, 다음에 보이는 행동은 무엇인지, 무엇을 삭제·위임·연기할지 묻습니다. 짧고 솔직한 회고가 실행하지 않는 완벽한 의식보다 낫습니다.

## 연결하고 흔적 남기기

관련된 두 노트에 공통 태그를 붙이거나 더 명확한 문서로 합칩니다. 마지막으로 다음 주의 중요한 일, 불확실한 점, “충분히 좋음”의 기준을 적으세요.

## 회고 템플릿

- 성과:
- 미완료 항목:
- 결정 사항:
- 다음 세 가지 행동:
- 그만할 한 가지:
`,
    spacesFeature: `# 공간: 삶의 각 영역에 독립된 자리 만들기

TinyNote의 중요한 특징은 여러 공간을 만들어 서로 독립된 영역을 분리할 수 있다는 점입니다. 생활, 업무, 학습, 취미를 나눌 수 있고 주제가 커지면 책 집필, 사진, 홈 랩, 북마크 관리 같은 구체적인 공간도 만들 수 있습니다.

| 공간 | 관리할 내용 |
|:--|:--|
| 생활 | 가정 기록, 계획, 습관, 유용한 자료 |
| 업무 | 프로젝트, 회의, 절차, 재사용 답변 |
| 학습 | 강의, 독서 노트, 개념, 연습 |
| 취미 | 사진, 요리, 게임, 여행, 수집 |

업무 공간에서는 사이드바와 검색이 업무 지식에 집중하고, 학습 공간으로 전환하면 같은 앱이 학습 환경이 됩니다.

## 구체적인 공간 예시

- **책 집필**: 조사, 인물 설정, 장 초안, 수정 체크리스트.
- **내비게이션 허브**: 분류한 북마크, 자주 쓰는 도구, 링크 모음.
- **비밀번호 운영**: 비밀이 아닌 계정 메타데이터, 복구 절차, 보안 체크리스트.

> TinyNote는 읽을 수 있는 Markdown 파일을 저장하며 암호화된 비밀번호 금고가 아닙니다. 실제 비밀번호, 복구 코드와 비밀은 신뢰할 수 있는 전용 비밀번호 관리자에 보관하세요.

주제에 고유한 용어, 작업 흐름, 검토 주기가 있으면 새 공간을 만들고 같은 맥락을 공유하면 그룹을 사용하세요. **공간은 세계를 나누고, 그룹은 자료를 정리하며, 노트는 지식을 담습니다.**
`,
    blocksFeature: `# 블록 노트: 복사와 재사용을 위해

블록 노트는 다시 사용할 지식을 위한 형식입니다. 유용한 항목마다 제목, 유형, 태그가 있는 독립 카드를 만들고 검색, 이동, 한 번의 클릭으로 복사할 수 있습니다.

| 상황 | 블록 예시 | 효과 |
|:--|:--|:--|
| 코드 스니펫 | 날짜 파싱, 재시도, 가운데 배치 | 검증한 코드를 바로 복사 |
| 영업 문구 | 탐색 질문, 이의 대응, 후속 메시지 | 표현을 일관되게 유지하고 조정 |
| 자주 쓰는 명령 | 로그 확인, 배포, Git 복구 | 기억 부담과 입력 오류 감소 |
| 북마크 | 디자인 도구, 조사 자료, 대시보드 | 제목, 태그, 맥락으로 관리 |
| 템플릿 | 회의 요약, 버그 보고, 출시 목록 | 신뢰할 수 있는 구조에서 시작 |

## 실용적인 흐름

1. 한 번에 재사용 가능한 항목 하나만 저장합니다.
2. “Docker: 서비스 로그 따라가기”처럼 결과로 이름을 붙입니다.
3. 콘텐츠 유형과 맥락 태그를 선택합니다.
4. 목록이나 카드에서 직접 복사합니다.
5. 실제 사용에서 배운 개선점을 원본 블록에 반영합니다.

영업과 지원에서는 시작 질문, 제품 설명, 자주 나오는 이의, 후속 메시지를 별도 블록으로 관리하세요. 고객의 민감한 데이터는 재사용 블록에 저장하지 마세요.

일반 북마크는 위치만 알려 주지만 블록은 중요한 이유와 사용 시점도 설명합니다. TinyNote는 블록의 링크를 감지해 빠르게 열 수 있습니다.

좋은 블록의 기준은 “내일 복사해 거의 수정 없이 쓸 수 있는가?”입니다. 아니라면 분리하거나 긴 설명을 Markdown 또는 문서 노트로 바꾸세요.
`,
  },
  de: {
    spaceName: 'TinyNote Starter-Kit',
    groups: ['01 Erste Schritte', '02 Software-Highlights', '03 Arbeitsabläufe', '04 Referenz'],
    noteNames: ['Willkommen bei TinyNote', 'Markdown-Leitfaden', 'Eigene Bereiche für jeden Lebensbereich', 'Blocknotizen zum Wiederverwenden', 'Projektstart', 'Ein ruhiger Wochenrückblick', 'Code- und Befehlssammlung'],
    welcomeBlocks: [
      { title: '👋 Willkommen – hier anfangen', content: `Dies ist dein TinyNote Starter-Kit. Es ist ein normaler Bereich, den du frei bearbeiten oder löschen kannst.

Blocknotizen eignen sich für wiederverwendbare Fragmente, Markdown-Notizen verbinden Quelltext und Vorschau, Artikelnotizen unterstützen konzentriertes Schreiben. Öffne die Ordner links und probiere alles direkt aus.`, tags: ['einstieg', 'tinynote'] },
      { title: '1. Wiederverwendbares Wissen als Blöcke', content: `Jeder Block hat Titel, Inhaltstyp, Tags und Zeitangaben. Wähle diesen Block aus, bearbeite ihn, ändere die Reihenfolge per Drag-and-drop und teste Kopieren sowie das Kontextmenü.`, tags: ['blöcke', 'anleitung'] },
      codeBlock('2. Snippets mit Inhaltstypen verwalten', sharedSnippet, 'javascript', ['code', 'hervorhebung']),
      { title: '3. Alles schnell finden', content: `Cmd/Strg + F durchsucht den aktuellen Bereich, Cmd/Strg + Umschalt + F alle Bereiche, Cmd/Strg + P öffnet letzte Notizen und Cmd/Strg + I den AI-Chat. Durchsucht werden Titel, Inhalt, Tags und Dokumenttext.`, tags: ['suche', 'tastenkürzel'] },
      { title: '4. Organisation ohne Lock-in', content: `Bereiche sind .tinynotes-Ordner, Gruppen normale Unterordner und Notizen Markdown-Dateien. Dadurch bleiben Texteditoren, Systemsuche, Git und Backups nutzbar.`, contentType: 'markdown', tags: ['local-first', 'organisation'] },
      { title: '5. TinyNote anpassen', content: `In den Einstellungen wählst du Theme, Sprache, Layout, Zoom, Backups, Git-Synchronisierung und AI-Modelle. Erstelle danach einen Projektbereich und nutze für jedes Ziel das passende Notizformat.`, tags: ['einstellungen', 'nächste-schritte'] },
    ],
    projectBlocks: [
      { title: 'Projektübersicht', content: `Ziel: Eine kleine Dokumentationsseite veröffentlichen, auf der neue Nutzer in weniger als fünf Minuten ihr erstes nützliches Ergebnis erreichen. Signale sind eine erste Notiz, erfolgreiche Suche und Verständnis des Speicherorts. Rahmen: eine Woche, zwei Personen, lokale Daten.`, tags: ['projekt', 'übersicht'] },
      { title: 'Start-Checkliste', content: `- [x] Nutzerergebnis definieren
- [x] Informationsarchitektur skizzieren
- [ ] Kleinsten nützlichen Ablauf bauen
- [ ] Mit drei neuen Nutzern testen
- [ ] Entscheidungen und Fragen dokumentieren
- [ ] Rückblick planen`, contentType: 'markdown', tags: ['projekt', 'checkliste'] },
      codeBlock('API-Antwortbeispiel', sharedApiFixture, 'json', ['projekt', 'daten']),
      codeBlock('Nützliche Abfrage', sharedQuery, 'sql', ['projekt', 'sql']),
      codeBlock('Lokaler Vorschau-Befehl', sharedCommand, 'bash', ['projekt', 'befehl']),
      { title: 'Referenzlinks', content: `TinyNote-Dokumentation: https://tinynote.wu2kong.com/
CommonMark-Spezifikation: https://spec.commonmark.org/
Git-Dokumentation: https://git-scm.com/doc`, tags: ['links', 'referenz'] },
    ],
    cookbookTitles: ['Docker: Logs verfolgen', 'Git: Kompakter Verlauf', 'CSS: Inhalt zentrieren', 'Python: Nach Schlüssel gruppieren', 'YAML: Kleiner CI-Job'],
    markdownGuide: `# Markdown-Leitfaden

Diese bearbeitbare Notiz zeigt häufige Markdown-Syntax. Oben rechts wechselst du zwischen Bearbeitung, Vorschau und geteilter Ansicht.

> Markdown speichert Struktur als Klartext und bleibt daher außerhalb von TinyNote lesbar.

## Text, Links und Listen

Nutze **Fettdruck**, *Kursivschrift*, ~~Durchstreichen~~ und [beschreibende Links](https://commonmark.org/).

- Ein Gedanke pro Punkt
  - Einrückung zeigt Hierarchie
- [x] Speicherordner wählen
- [x] Starter-Kit erkunden
- [ ] Persönlichen Bereich erstellen

## Tabelle und einfaches Diagramm

| Format | Geeignet für | Bearbeitung |
|:--|:--|:--|
| Blöcke | Snippets, Fakten, Befehle | Karten und Inspektor |
| Markdown | Doku, Recherche, Technik | Quelltext und Vorschau |
| Artikel | Essays, Journal, Langtext | Fokus-Editor |

| Aktivität | Minuten | Anzeige |
|:--|--:|:--|
| Erfassen | 10 | ████ |
| Ordnen | 5 | ██ |
| Erstellen | 20 | ████████ |

## Code und Diagrammquelle

~~~typescript
type NoteFormat = 'blocks' | 'markdown' | 'writer';
const format: NoteFormat = 'markdown';
~~~

~~~mermaid
flowchart LR
  Erfassen --> Klären --> Verbinden --> Erstellen --> Prüfen
~~~

~~~markdown
![Kurze Bildbeschreibung](https://example.com/image.png)
~~~

Siehe auch [CommonMark](https://spec.commonmark.org/) und den [GitHub-Schreibleitfaden](https://docs.github.com/en/get-started/writing-on-github).
`,
    weeklyReview: `# Ein ruhiger Wochenrückblick

Das nützlichste Notizsystem erfasst nicht alles. Es bringt die richtigen Dinge zuverlässig wieder in den Blick.

## Oberfläche klären

Sammle lose Ideen, funktionierende Befehle und offene Entscheidungen. Dauerhafte Fragmente gehören in Blocknotizen, wo sie leicht markiert, sortiert, gesucht und kopiert werden können.

## Bewegung erkennen

Was hat sich verändert? Was ist die nächste sichtbare Handlung? Was kann gelöscht, delegiert oder verschoben werden? Ein kurzer ehrlicher Rückblick ist besser als ein perfektes Ritual, das nie stattfindet.

## Verbinden und eine Spur hinterlassen

Verbinde zwei verwandte Notizen mit einem gemeinsamen Tag oder einem klareren Dokument. Notiere anschließend, was nächste Woche zählt, was unklar bleibt und wie „gut genug“ aussieht.

## Vorlage

- Erfolge:
- Offene Punkte:
- Entscheidungen:
- Nächste drei Schritte:
- Eine Sache, die ich beende:
`,
    spacesFeature: `# Bereiche: Ein eigenes Zuhause für jeden Lebensbereich

Eine wichtige Stärke von TinyNote ist die Möglichkeit, mehrere Bereiche für voneinander unabhängige Themen anzulegen. Trenne Leben, Arbeit, Lernen und Interessen – oder erstelle gezielte Bereiche für ein Buchprojekt, Fotografie, ein Home-Lab oder eine Bookmark-Sammlung.

| Bereich | Typische Inhalte |
|:--|:--|
| Leben | Haushalt, Pläne, Routinen, nützliche Unterlagen |
| Arbeit | Projekte, Meetings, Abläufe, wiederverwendbare Antworten |
| Lernen | Kurse, Lesenotizen, Konzepte, Übungen |
| Interessen | Fotografie, Kochen, Spiele, Reisen |

Im Arbeitsbereich zeigen Seitenleiste und lokale Suche nur Arbeitswissen. Beim Wechsel zu Lernen wird dieselbe App zur konzentrierten Lernumgebung.

## Konkrete Anwendungsbereiche

- **Buch schreiben**: Recherche, Figuren, Kapitelentwürfe, Überarbeitungslisten.
- **Navigations-Hub**: sortierte Bookmarks, häufige Werkzeuge und Linksammlungen.
- **Passwort-Abläufe**: nicht geheime Kontodaten, Wiederherstellungsabläufe und Sicherheitslisten.

> TinyNote speichert lesbare Markdown-Dateien und ist kein verschlüsselter Passwort-Tresor. Echte Passwörter, Wiederherstellungscodes und andere Geheimnisse gehören in einen vertrauenswürdigen Passwortmanager.

Erstelle einen neuen Bereich, wenn ein Thema eigene Begriffe, Abläufe oder einen eigenen Prüfrhythmus hat. Nutze Gruppen, wenn Inhalte denselben Arbeitskontext teilen. **Bereiche trennen Welten, Gruppen ordnen Material, Notizen speichern Wissen.**
`,
    blocksFeature: `# Blocknotizen: Für Kopieren und Wiederverwenden gemacht

Blocknotizen sind für Wissen gedacht, das du erneut verwenden möchtest. Jeder nützliche Inhalt wird zu einer eigenen Karte mit Titel, Typ und Tags, die sich suchen, verschieben und mit einem Klick kopieren lässt.

| Einsatz | Beispiel | Nutzen |
|:--|:--|:--|
| Code-Snippets | Datum parsen, Request wiederholen, Layout zentrieren | Geprüften Code sofort kopieren |
| Verkaufstexte | Einstiegsfrage, Einwandbehandlung, Follow-up | Einheitliche Sprache, leicht anpassbar |
| Befehle | Logs prüfen, Vorschau deployen, Git reparieren | Weniger Merklast und Tippfehler |
| Bookmarks | Tools, Quellen, Dashboards | Links mit Titel, Tags und Kontext |
| Vorlagen | Meeting-Zusammenfassung, Bugbericht, Release-Liste | Wiederholungen mit verlässlicher Struktur starten |

## Praktischer Ablauf

1. Erfasse genau einen wiederverwendbaren Gegenstand.
2. Benenne ihn nach dem Ergebnis, etwa „Docker: Service-Logs verfolgen“.
3. Wähle Inhaltstyp und Kontext-Tags.
4. Kopiere ihn direkt aus Listen- oder Kartenansicht.
5. Verbessere den Originalblock anhand echter Nutzung.

Für Verkauf und Support eignen sich getrennte Blöcke für Einstiegsfragen, Produkterklärungen, Einwände und Follow-ups. Speichere keine sensiblen Kundendaten in wiederverwendbaren Blöcken.

Ein normales Bookmark zeigt nur den Ort. Ein Block erklärt auch, warum der Link wichtig ist und wann er gebraucht wird. TinyNote erkennt Links in Blöcken und öffnet sie schnell.

Frage bei jedem Block: „Kann ich ihn morgen fast ohne Änderung kopieren und verwenden?“ Falls nicht, teile ihn auf oder verschiebe die längere Erklärung in eine Markdown- oder Artikelnotiz.
`,
  },
  fr: {
    spaceName: 'Kit de démarrage TinyNote',
    groups: ['01 Bien démarrer', '02 Points forts du logiciel', '03 Flux de travail', '04 Références'],
    noteNames: ['Bienvenue dans TinyNote', 'Guide Markdown', 'Un espace pour chaque domaine de la vie', 'Des notes par blocs faites pour être réutilisées', 'Lancement de projet', 'Une revue hebdomadaire calme', 'Recueil de code et commandes'],
    welcomeBlocks: [
      { title: '👋 Bienvenue — commencez ici', content: `Voici votre kit de démarrage TinyNote. C’est un espace normal que vous pouvez modifier ou supprimer librement.

Les notes par blocs servent aux fragments réutilisables, Markdown associe source et aperçu, et les notes article favorisent l’écriture longue. Explorez les dossiers à gauche et essayez directement.`, tags: ['débuter', 'tinynote'] },
      { title: '1. Conserver le savoir réutilisable en blocs', content: `Chaque bloc possède un titre, un type, des tags et des dates. Sélectionnez ce bloc, modifiez-le, déplacez-le par glisser-déposer, puis essayez la copie et le menu contextuel.`, tags: ['blocs', 'tutoriel'] },
      codeBlock('2. Classer les extraits par type', sharedSnippet, 'javascript', ['code', 'coloration']),
      { title: '3. Tout retrouver rapidement', content: `Cmd/Ctrl + F recherche dans l’espace actuel, Cmd/Ctrl + Maj + F partout, Cmd/Ctrl + P ouvre les notes récentes et Cmd/Ctrl + I le chat IA. Titres, contenu, tags et documents sont indexés.`, tags: ['recherche', 'raccourcis'] },
      { title: '4. Organiser sans enfermement', content: `Les espaces sont des dossiers .tinynotes, les groupes des sous-dossiers ordinaires et les notes des fichiers Markdown. Vos outils texte, la recherche système, Git et les sauvegardes restent disponibles.`, contentType: 'markdown', tags: ['local-first', 'organisation'] },
      { title: '5. Adapter TinyNote', content: `Les réglages permettent de choisir thème, langue, disposition, zoom, sauvegardes, synchronisation Git et modèles IA. Créez ensuite un espace de projet et choisissez le bon format pour chaque usage.`, tags: ['réglages', 'suite'] },
    ],
    projectBlocks: [
      { title: 'Résumé du projet', content: `Objectif : publier un petit site de documentation permettant aux nouveaux utilisateurs d’obtenir un premier résultat utile en moins de cinq minutes. Signaux : première note créée, recherche réussie, emplacement des fichiers compris. Contraintes : une semaine, deux personnes, données locales.`, tags: ['projet', 'résumé'] },
      { title: 'Liste de lancement', content: `- [x] Définir le résultat utilisateur
- [x] Esquisser l’architecture de l’information
- [ ] Construire le plus petit parcours utile
- [ ] Tester avec trois nouveaux utilisateurs
- [ ] Documenter décisions et questions
- [ ] Planifier une rétrospective`, contentType: 'markdown', tags: ['projet', 'liste'] },
      codeBlock('Exemple de réponse API', sharedApiFixture, 'json', ['projet', 'données']),
      codeBlock('Requête utile', sharedQuery, 'sql', ['projet', 'sql']),
      codeBlock('Commande d’aperçu local', sharedCommand, 'bash', ['projet', 'commande']),
      { title: 'Liens de référence', content: `Documentation TinyNote : https://tinynote.wu2kong.com/
Spécification CommonMark : https://spec.commonmark.org/
Documentation Git : https://git-scm.com/doc`, tags: ['liens', 'référence'] },
    ],
    cookbookTitles: ['Docker : suivre les journaux', 'Git : historique compact', 'CSS : centrer le contenu', 'Python : grouper par clé', 'YAML : petite tâche CI'],
    markdownGuide: `# Guide Markdown

Cette note modifiable présente la syntaxe Markdown courante. En haut à droite, alternez entre édition, aperçu et vue partagée.

> Markdown conserve la structure en texte brut et reste lisible hors de TinyNote.

## Texte, liens et listes

Utilisez le **gras**, l’*italique*, le ~~barré~~ et des [liens descriptifs](https://commonmark.org/).

- Une idée par élément
  - L’indentation crée une hiérarchie
- [x] Choisir le dossier de stockage
- [x] Explorer le kit
- [ ] Créer un espace personnel

## Tableau et graphique simple

| Format | Idéal pour | Édition |
|:--|:--|:--|
| Blocs | Extraits, faits, commandes | Cartes et inspecteur |
| Markdown | Docs, recherche, technique | Source et aperçu |
| Article | Essais, journal, texte long | Éditeur focalisé |

| Activité | Minutes | Visuel |
|:--|--:|:--|
| Capturer | 10 | ████ |
| Organiser | 5 | ██ |
| Créer | 20 | ████████ |

## Code et source de diagramme

~~~typescript
type NoteFormat = 'blocks' | 'markdown' | 'writer';
const format: NoteFormat = 'markdown';
~~~

~~~mermaid
flowchart LR
  Capturer --> Clarifier --> Relier --> Créer --> Réviser
~~~

~~~markdown
![Courte description de l’image](https://example.com/image.png)
~~~

Consultez [CommonMark](https://spec.commonmark.org/) et le [guide de rédaction GitHub](https://docs.github.com/en/get-started/writing-on-github).
`,
    weeklyReview: `# Une revue hebdomadaire calme

Le système de notes le plus utile ne capture pas tout : il remet les bonnes choses en vue au bon moment.

## Dégager la surface

Rassemblez les idées isolées, les commandes qui fonctionnent et les décisions ouvertes. Placez les fragments durables dans des blocs pour faciliter tags, classement, recherche et copie.

## Chercher le mouvement

Qu’est-ce qui a changé ? Quelle est la prochaine action visible ? Que peut-on supprimer, déléguer ou reporter ? Une revue brève et honnête vaut mieux qu’un rituel parfait jamais réalisé.

## Relier et laisser une trace

Reliez deux notes associées par un tag commun ou un document plus clair. Notez enfin ce qui compte la semaine prochaine, ce qui reste incertain et la définition de « suffisant ».

## Modèle de revue

- Réussites :
- Boucles ouvertes :
- Décisions :
- Trois prochaines actions :
- Une chose à arrêter :
`,
    spacesFeature: `# Espaces : un foyer pour chaque domaine de la vie

L’un des grands atouts de TinyNote est de pouvoir créer plusieurs espaces pour séparer des domaines indépendants. Organisez la vie, le travail, l’apprentissage et les loisirs, puis créez des espaces ciblés pour écrire un livre, pratiquer la photographie, gérer un labo personnel ou classer des favoris.

| Espace | Contenu typique |
|:--|:--|
| Vie | Maison, projets personnels, routines, documents utiles |
| Travail | Projets, réunions, procédures, réponses réutilisables |
| Apprentissage | Cours, lectures, concepts, exercices |
| Loisirs | Photo, cuisine, jeux, voyages, collections |

Dans Travail, la barre latérale et la recherche locale se concentrent sur le travail. En passant à Apprentissage, la même application devient un environnement d’étude.

## Espaces spécialisés

- **Écriture d’un livre** : recherches, personnages, chapitres, listes de révision.
- **Hub de navigation** : favoris classés, outils fréquents et collections de liens.
- **Procédures de mots de passe** : métadonnées non secrètes, récupération et listes de sécurité.

> TinyNote stocke des fichiers Markdown lisibles et n’est pas un coffre-fort chiffré. Conservez mots de passe, codes de récupération et secrets dans un gestionnaire de mots de passe reconnu.

Créez un espace lorsqu’un sujet possède son vocabulaire, ses processus ou son rythme de révision. Utilisez un groupe quand le contexte reste commun. **Les espaces séparent les mondes, les groupes rangent les ressources et les notes contiennent le savoir.**
`,
    blocksFeature: `# Notes par blocs : conçues pour copier et réutiliser

Les blocs servent au savoir que vous comptez réutiliser. Chaque élément devient une carte titrée, typée et taguée, facile à rechercher, déplacer et copier en un clic.

| Usage | Exemple | Bénéfice |
|:--|:--|:--|
| Extraits de code | Parser une date, réessayer une requête, centrer une page | Copier du code déjà validé |
| Argumentaires commerciaux | Question d’ouverture, objection, suivi | Cohérence et adaptation rapide |
| Commandes courantes | Voir les logs, déployer, réparer Git | Moins de mémoire et d’erreurs de saisie |
| Favoris | Outils, sources, tableaux de bord | Liens enrichis de titres, tags et contexte |
| Modèles | Compte rendu, bug, liste de publication | Repartir d’une structure fiable |

## Flux pratique

1. Capturez un seul élément réutilisable.
2. Nommez-le par son résultat, par exemple « Docker : suivre les logs du service ».
3. Choisissez le type de contenu et les tags de contexte.
4. Copiez-le directement depuis la liste ou les cartes.
5. Améliorez l’original après chaque utilisation réelle.

Pour la vente et le support, séparez questions d’ouverture, explications produit, objections et messages de suivi. Ne stockez aucune donnée client sensible dans un bloc réutilisable.

Un favori ordinaire indique seulement où se trouve une page. Un bloc explique aussi pourquoi elle compte et quand l’utiliser. TinyNote détecte les liens d’un bloc et permet de les ouvrir rapidement.

Testez chaque bloc avec cette question : « Pourrai-je le copier demain et l’utiliser presque sans modification ? » Sinon, divisez-le ou transformez l’explication longue en note Markdown ou article.
`,
  },
  it: {
    spaceName: 'Kit introduttivo TinyNote',
    groups: ['01 Per iniziare', '02 Caratteristiche del software', '03 Flussi di lavoro', '04 Riferimenti'],
    noteNames: ['Benvenuto in TinyNote', 'Guida Markdown', 'Uno spazio per ogni area della vita', 'Note a blocchi create per il riuso', 'Avvio del progetto', 'Una tranquilla revisione settimanale', 'Raccolta di codice e comandi'],
    welcomeBlocks: [
      { title: '👋 Benvenuto — inizia qui', content: `Questo è il kit introduttivo TinyNote. È uno spazio normale che puoi modificare o eliminare liberamente.

Le note a blocchi sono ideali per frammenti riutilizzabili, Markdown unisce sorgente e anteprima, mentre le note articolo favoriscono la scrittura lunga. Esplora le cartelle a sinistra e prova direttamente.`, tags: ['inizio', 'tinynote'] },
      { title: '1. Conserva conoscenze riutilizzabili in blocchi', content: `Ogni blocco ha titolo, tipo, tag e date. Seleziona questo blocco, modificalo, trascinalo per riordinarlo, quindi prova il pulsante copia e il menu contestuale.`, tags: ['blocchi', 'tutorial'] },
      codeBlock('2. Organizza gli snippet per tipo', sharedSnippet, 'javascript', ['codice', 'evidenziazione']),
      { title: '3. Trova tutto rapidamente', content: `Cmd/Ctrl + F cerca nello spazio corrente, Cmd/Ctrl + Maiusc + F ovunque, Cmd/Ctrl + P apre le note recenti e Cmd/Ctrl + I la chat IA. La ricerca include titoli, testo, tag e documenti.`, tags: ['ricerca', 'scorciatoie'] },
      { title: '4. Organizza senza dipendenze', content: `Gli spazi sono cartelle .tinynotes, i gruppi normali sottocartelle e le note file Markdown. Editor di testo, ricerca di sistema, Git e backup restano sempre disponibili.`, contentType: 'markdown', tags: ['local-first', 'organizzazione'] },
      { title: '5. Personalizza TinyNote', content: `Nelle impostazioni scegli tema, lingua, layout, zoom, backup, sincronizzazione Git e modelli IA. Crea poi uno spazio di progetto e usa il formato adatto a ogni obiettivo.`, tags: ['impostazioni', 'prossimi-passi'] },
    ],
    projectBlocks: [
      { title: 'Sintesi del progetto', content: `Obiettivo: pubblicare un piccolo sito di documentazione che porti i nuovi utenti al primo risultato utile in meno di cinque minuti. Segnali: prima nota creata, ricerca riuscita, posizione dei file compresa. Vincoli: una settimana, due persone, dati locali.`, tags: ['progetto', 'sintesi'] },
      { title: 'Lista di lancio', content: `- [x] Definire il risultato utente
- [x] Disegnare l’architettura informativa
- [ ] Costruire il flusso minimo utile
- [ ] Testare con tre nuovi utenti
- [ ] Documentare decisioni e domande
- [ ] Pianificare una retrospettiva`, contentType: 'markdown', tags: ['progetto', 'lista'] },
      codeBlock('Esempio di risposta API', sharedApiFixture, 'json', ['progetto', 'dati']),
      codeBlock('Query utile', sharedQuery, 'sql', ['progetto', 'sql']),
      codeBlock('Comando anteprima locale', sharedCommand, 'bash', ['progetto', 'comando']),
      { title: 'Link di riferimento', content: `Documentazione TinyNote: https://tinynote.wu2kong.com/
Specifica CommonMark: https://spec.commonmark.org/
Documentazione Git: https://git-scm.com/doc`, tags: ['link', 'riferimenti'] },
    ],
    cookbookTitles: ['Docker: segui i log', 'Git: cronologia compatta', 'CSS: centra il contenuto', 'Python: raggruppa per chiave', 'YAML: piccolo job CI'],
    markdownGuide: `# Guida Markdown

Questa nota modificabile mostra la sintassi Markdown più comune. In alto a destra puoi passare tra modifica, anteprima e vista divisa.

> Markdown conserva la struttura in testo semplice e rimane leggibile fuori da TinyNote.

## Testo, link ed elenchi

Usa **grassetto**, *corsivo*, ~~barrato~~ e [link descrittivi](https://commonmark.org/).

- Un’idea per elemento
  - Il rientro crea gerarchia
- [x] Scegliere la cartella di archiviazione
- [x] Esplorare il kit
- [ ] Creare uno spazio personale

## Tabella e grafico semplice

| Formato | Ideale per | Modifica |
|:--|:--|:--|
| Blocchi | Snippet, fatti, comandi | Schede e ispettore |
| Markdown | Documenti, ricerca, tecnica | Sorgente e anteprima |
| Articolo | Saggi, diario, testo lungo | Editor focalizzato |

| Attività | Minuti | Visuale |
|:--|--:|:--|
| Catturare | 10 | ████ |
| Organizzare | 5 | ██ |
| Creare | 20 | ████████ |

## Codice e sorgente del diagramma

~~~typescript
type NoteFormat = 'blocks' | 'markdown' | 'writer';
const format: NoteFormat = 'markdown';
~~~

~~~mermaid
flowchart LR
  Catturare --> Chiarire --> Collegare --> Creare --> Rivedere
~~~

~~~markdown
![Breve descrizione dell’immagine](https://example.com/image.png)
~~~

Consulta [CommonMark](https://spec.commonmark.org/) e la [guida alla scrittura di GitHub](https://docs.github.com/en/get-started/writing-on-github).
`,
    weeklyReview: `# Una tranquilla revisione settimanale

Il sistema di note più utile non cattura tutto: riporta in vista le cose giuste al momento giusto.

## Liberare la superficie

Raccogli idee sparse, comandi funzionanti e decisioni aperte. Sposta i frammenti durevoli nei blocchi per facilitare tag, ordine, ricerca e copia.

## Cercare il movimento

Cosa è cambiato? Qual è la prossima azione visibile? Cosa può essere eliminato, delegato o rimandato? Una revisione breve e onesta è migliore di un rituale perfetto mai eseguito.

## Collegare e lasciare una traccia

Collega due note correlate con un tag comune o un documento più chiaro. Scrivi infine cosa conta la prossima settimana, cosa resta incerto e come appare “abbastanza buono”.

## Modello di revisione

- Risultati:
- Questioni aperte:
- Decisioni:
- Prossime tre azioni:
- Una cosa da interrompere:
`,
    spacesFeature: `# Spazi: una casa per ogni area della vita

Una caratteristica importante di TinyNote è la possibilità di creare più spazi per domini indipendenti. Puoi separare vita, lavoro, studio e interessi, oppure creare spazi specifici per scrivere un libro, coltivare un hobby, gestire un home lab o organizzare i preferiti.

| Spazio | Contenuti tipici |
|:--|:--|
| Vita | Casa, piani, routine, documenti utili |
| Lavoro | Progetti, riunioni, procedure, risposte riutilizzabili |
| Studio | Corsi, appunti di lettura, concetti, esercizi |
| Interessi | Fotografia, cucina, giochi, viaggi, collezioni |

Nello spazio Lavoro, barra laterale e ricerca locale mostrano conoscenze di lavoro. Passando a Studio, la stessa app diventa un ambiente dedicato all’apprendimento.

## Spazi più specifici

- **Scrittura di un libro**: ricerca, personaggi, capitoli e liste di revisione.
- **Hub di navigazione**: preferiti classificati, strumenti frequenti e raccolte di link.
- **Procedure password**: metadati non segreti, recupero e liste di sicurezza.

> TinyNote salva file Markdown leggibili e non è un archivio password cifrato. Conserva password reali, codici di recupero e segreti in un gestore di password affidabile.

Crea un nuovo spazio quando un tema ha vocabolario, flussi o ritmo di revisione propri. Usa un gruppo quando il contesto rimane condiviso. **Gli spazi separano i mondi, i gruppi ordinano il materiale, le note custodiscono la conoscenza.**
`,
    blocksFeature: `# Note a blocchi: create per copia e riuso

I blocchi sono pensati per conoscenze che userai di nuovo. Ogni elemento diventa una scheda con titolo, tipo e tag, facile da cercare, spostare e copiare con un clic.

| Scenario | Esempio | Vantaggio |
|:--|:--|:--|
| Codice | Analisi data, nuovo tentativo, layout centrato | Copiare codice già verificato |
| Script di vendita | Domanda iniziale, obiezione, follow-up | Coerenza e adattamento rapido |
| Comandi frequenti | Log, deploy, riparazione Git | Meno memoria e meno errori |
| Preferiti | Strumenti, fonti, dashboard | Link con titolo, tag e contesto |
| Modelli | Riepilogo riunione, bug, checklist release | Partire da una struttura affidabile |

## Flusso pratico

1. Acquisisci un solo elemento riutilizzabile.
2. Dagli un nome basato sul risultato, come «Docker: segui i log del servizio».
3. Scegli tipo di contenuto e tag di contesto.
4. Copialo direttamente dalla lista o dalle schede.
5. Migliora l’originale dopo l’uso reale.

Per vendite e assistenza, separa domande iniziali, spiegazioni del prodotto, obiezioni e messaggi di follow-up. Non salvare dati sensibili dei clienti in blocchi riutilizzabili.

Un preferito normale indica solo dove si trova una pagina; un blocco spiega anche perché conta e quando usarla. TinyNote rileva i link nel blocco e li apre rapidamente.

Chiediti: «Potrò copiarlo domani e usarlo quasi senza modifiche?» In caso contrario, dividilo o trasforma la spiegazione lunga in una nota Markdown o articolo.
`,
  },
  ru: {
    spaceName: 'Стартовый набор TinyNote',
    groups: ['01 С чего начать', '02 Особенности программы', '03 Рабочие процессы', '04 Справочник'],
    noteNames: ['Добро пожаловать в TinyNote', 'Руководство по Markdown', 'Отдельное пространство для каждой сферы жизни', 'Блочные заметки для повторного использования', 'Запуск проекта', 'Спокойный еженедельный обзор', 'Сборник кода и команд'],
    welcomeBlocks: [
      { title: '👋 Добро пожаловать — начните здесь', content: `Это стартовый набор TinyNote. Это обычное пространство, которое можно свободно редактировать или удалить.

Блочные заметки подходят для повторно используемых фрагментов, Markdown сочетает исходник и просмотр, а статьи помогают сосредоточиться на длинном тексте. Откройте папки слева и попробуйте всё сами.`, tags: ['начало', 'tinynote'] },
      { title: '1. Храните повторно используемые знания в блоках', content: `У каждого блока есть заголовок, тип, теги и даты. Выберите этот блок, измените его, перетащите для сортировки, затем попробуйте копирование и контекстное меню.`, tags: ['блоки', 'обучение'] },
      codeBlock('2. Организуйте фрагменты по типу', sharedSnippet, 'javascript', ['код', 'подсветка']),
      { title: '3. Быстро находите всё', content: `Cmd/Ctrl + F ищет в текущем пространстве, Cmd/Ctrl + Shift + F — везде, Cmd/Ctrl + P открывает недавние заметки, Cmd/Ctrl + I — чат ИИ. Поиск охватывает заголовки, текст, теги и документы.`, tags: ['поиск', 'клавиши'] },
      { title: '4. Организация без привязки', content: `Пространства — папки .tinynotes, группы — обычные подпапки, заметки — файлы Markdown. Поэтому доступны текстовые редакторы, системный поиск, Git и резервные копии.`, contentType: 'markdown', tags: ['local-first', 'организация'] },
      { title: '5. Настройте TinyNote под себя', content: `В настройках выберите тему, язык, макет, масштаб, резервное копирование, синхронизацию Git и модели ИИ. Затем создайте пространство проекта и используйте подходящий формат заметки для каждой цели.`, tags: ['настройки', 'дальше'] },
    ],
    projectBlocks: [
      { title: 'Описание проекта', content: `Цель: запустить небольшой сайт документации, где новый пользователь получит первый полезный результат менее чем за пять минут. Признаки успеха: первая заметка, успешный поиск и понимание места хранения. Ограничения: неделя, два участника, локальные данные.`, tags: ['проект', 'описание'] },
      { title: 'Список запуска', content: `- [x] Определить результат пользователя
- [x] Набросать архитектуру информации
- [ ] Создать минимальный полезный сценарий
- [ ] Проверить с тремя новыми пользователями
- [ ] Записать решения и вопросы
- [ ] Запланировать ретроспективу`, contentType: 'markdown', tags: ['проект', 'список'] },
      codeBlock('Пример ответа API', sharedApiFixture, 'json', ['проект', 'данные']),
      codeBlock('Полезный запрос', sharedQuery, 'sql', ['проект', 'sql']),
      codeBlock('Команда локального просмотра', sharedCommand, 'bash', ['проект', 'команда']),
      { title: 'Ссылки', content: `Документация TinyNote: https://tinynote.wu2kong.com/
Спецификация CommonMark: https://spec.commonmark.org/
Документация Git: https://git-scm.com/doc`, tags: ['ссылки', 'справка'] },
    ],
    cookbookTitles: ['Docker: следить за журналом', 'Git: компактная история', 'CSS: выравнивание по центру', 'Python: группировка по ключу', 'YAML: небольшая задача CI'],
    markdownGuide: `# Руководство по Markdown

Эта редактируемая заметка показывает распространённый синтаксис Markdown. Справа вверху можно переключать редактирование, просмотр и разделённый режим.

> Markdown хранит структуру как обычный текст и читается вне TinyNote.

## Текст, ссылки и списки

Используйте **жирный**, *курсив*, ~~зачёркивание~~ и [понятные ссылки](https://commonmark.org/).

- Одна мысль на пункт
  - Отступ создаёт иерархию
- [x] Выбрать папку хранения
- [x] Изучить стартовый набор
- [ ] Создать личное пространство

## Таблица и простая диаграмма

| Формат | Лучше всего для | Редактирование |
|:--|:--|:--|
| Блоки | Фрагменты, факты, команды | Карточки и инспектор |
| Markdown | Документы, исследования, техника | Исходник и просмотр |
| Статья | Эссе, дневник, длинный текст | Фокус-редактор |

| Действие | Минуты | Вид |
|:--|--:|:--|
| Сбор | 10 | ████ |
| Организация | 5 | ██ |
| Создание | 20 | ████████ |

## Код и исходник диаграммы

~~~typescript
type NoteFormat = 'blocks' | 'markdown' | 'writer';
const format: NoteFormat = 'markdown';
~~~

~~~mermaid
flowchart LR
  Сбор --> Уточнение --> Связь --> Создание --> Обзор
~~~

~~~markdown
![Краткое описание изображения](https://example.com/image.png)
~~~

Смотрите [CommonMark](https://spec.commonmark.org/) и [руководство GitHub](https://docs.github.com/en/get-started/writing-on-github).
`,
    weeklyReview: `# Спокойный еженедельный обзор

Самая полезная система заметок не сохраняет всё подряд. Она вовремя возвращает в поле зрения нужные вещи.

## Очистить поверхность

Соберите отдельные идеи, сработавшие команды и открытые решения. Долговечные фрагменты перенесите в блоки, где их легко помечать, сортировать, искать и копировать.

## Увидеть движение

Что изменилось? Какое следующее действие видно? Что можно удалить, поручить или отложить? Короткий честный обзор лучше идеального ритуала, который никогда не выполняется.

## Связать и оставить след

Свяжите две близкие заметки общим тегом или ясным документом. Запишите, что важно на следующей неделе, что остаётся неясным и как выглядит «достаточно хорошо».

## Шаблон обзора

- Результаты:
- Открытые вопросы:
- Решения:
- Следующие три действия:
- Что перестать делать:
`,
    spacesFeature: `# Пространства: отдельное место для каждой сферы жизни

Важная особенность TinyNote — возможность создавать несколько пространств для независимых сфер. Разделите жизнь, работу, учёбу и интересы либо создайте отдельные пространства для написания книги, хобби, домашней лаборатории или управления закладками.

| Пространство | Типичное содержимое |
|:--|:--|
| Жизнь | Дом, планы, привычки, полезные документы |
| Работа | Проекты, встречи, процедуры, готовые ответы |
| Учёба | Курсы, книги, понятия, упражнения |
| Интересы | Фото, кулинария, игры, путешествия, коллекции |

В пространстве «Работа» боковая панель и локальный поиск показывают рабочие знания. После перехода в «Учёбу» то же приложение становится средой обучения.

## Специализированные пространства

- **Написание книги**: исследования, персонажи, главы, списки правок.
- **Навигационный центр**: закладки по категориям, частые инструменты и коллекции ссылок.
- **Процедуры паролей**: несекретные данные аккаунтов, восстановление и списки безопасности.

> TinyNote хранит читаемые файлы Markdown и не является зашифрованным хранилищем паролей. Настоящие пароли, коды восстановления и секреты храните в надёжном менеджере паролей.

Создавайте пространство, когда у темы есть свои термины, процессы или ритм обзора. Используйте группу, если контекст остаётся общим. **Пространства разделяют миры, группы упорядочивают материалы, заметки хранят знания.**
`,
    blocksFeature: `# Блочные заметки: для копирования и повторного использования

Блоки предназначены для знаний, которые пригодятся снова. Каждый элемент становится отдельной карточкой с заголовком, типом и тегами, которую легко найти, переместить и скопировать одним нажатием.

| Сценарий | Пример | Польза |
|:--|:--|:--|
| Код | Разбор даты, повтор запроса, центрирование | Копирование проверенного кода |
| Скрипты продаж | Первый вопрос, ответ на возражение, follow-up | Единая речь и быстрая адаптация |
| Команды | Просмотр логов, деплой, ремонт Git | Меньше нагрузки на память и ошибок |
| Закладки | Инструменты, источники, панели | Ссылки с заголовком, тегами и контекстом |
| Шаблоны | Итоги встречи, баг, список релиза | Надёжная структура для повторной работы |

## Практический процесс

1. Сохраняйте один повторно используемый элемент.
2. Называйте по результату, например «Docker: следить за логами сервиса».
3. Выбирайте тип содержимого и контекстные теги.
4. Копируйте прямо из списка или карточек.
5. Улучшайте исходный блок после реального применения.

Для продаж и поддержки храните отдельно начальные вопросы, объяснения продукта, ответы на возражения и сообщения для продолжения. Не сохраняйте чувствительные данные клиентов в повторно используемых блоках.

Обычная закладка сообщает только адрес. Блок также объясняет, почему ссылка важна и когда её использовать. TinyNote распознаёт ссылки в блоке и быстро открывает их.

Проверка хорошего блока: «Смогу ли я завтра скопировать его и применить почти без изменений?» Если нет, разделите его или перенесите длинное объяснение в Markdown либо статью.
`,
  },
};
