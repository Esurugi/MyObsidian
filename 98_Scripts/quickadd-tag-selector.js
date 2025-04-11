module.exports = async (params) => {
  // デバッグ情報を出力
  console.log("[QuickAdd-tag-selector] スクリプト開始");
  
  // モード判定 (新規ノート作成からの呼び出しかどうか)
  const isFromNewNote = params.variables && params.variables["fromNewNote"] === true;
  // サブタグ作成専用モードかどうか
  const isSubTagCreation = params.variables && params.variables["isSubTagCreation"] === true;
  
  console.log("[QuickAdd-tag-selector] 実行モード:", { isFromNewNote, isSubTagCreation });
  
  // タグフォルダからすべてのタグを取得
  const tagFolder = "02_DB_tags";
  const tagFiles = app.vault.getMarkdownFiles()
    .filter(file => file.path.startsWith(tagFolder))
    .filter(file => !file.basename.includes("/"));  // フォルダを除外
  
  // メインタグとサブタグに分類
  const mainTags = tagFiles
    .filter(file => !file.basename.includes("_"))
    .map(file => file.basename);
    
  const subTags = tagFiles
    .filter(file => file.basename.includes("_"))
    .map(file => file.basename);
  
  console.log("[QuickAdd-tag-selector] 既存タグ:", { mainTags, subTags });
  
  // サブタグ作成専用モードの場合
  if (isSubTagCreation) {
    await createSubTag(params, mainTags, tagFolder);
    return params.variables;
  }
  
  // 通常モード（新規ノート作成やタグ選択）の場合
  // タグリストに「新規タグ作成」オプションを追加
  const tagOptions = [...subTags, "+ 新規タグを作成"];
  
  // ユーザーに複数選択させる
  const selectedTags = await params.quickAddApi.checkboxPrompt(
    tagOptions,
    "リンクするタグを選択してください（複数選択可）"
  );
  
  let finalTags = selectedTags.filter(tag => tag !== "+ 新規タグを作成");
  
  // 「新規タグ作成」が選択された場合
  if (selectedTags.includes("+ 新規タグを作成")) {
    const newTagName = await createSubTag(params, mainTags, tagFolder);
    if (newTagName) {
      finalTags.push(newTagName);
    }
  }
  
  // タグが選択されたら、変数に保存
  if (finalTags.length > 0) {
    console.log("[QuickAdd-tag-selector] 選択されたタグ:", finalTags);
    
    // QuickAddとTemplaterの変数として保存
    params.variables["selectedTags"] = finalTags.join(", ");
    params.variables["tagLinks"] = finalTags.map(tag => `[[${tag}]]`).join(", ");
    
    // 新規ノート作成の場合はテンプレートに任せる
    // それ以外の場合は現在のファイルにタグを適用
    if (!isFromNewNote) {
      await applyTagsToCurrent(finalTags);
    }
  }
  
  return params.variables;
};

// サブタグ作成関数
async function createSubTag(params, mainTags, tagFolder) {
  try {
    console.log("[QuickAdd-tag-selector] サブタグ作成開始");
    
    // サブタグ名の入力
    const newTagName = await params.quickAddApi.inputPrompt(
      "新規サブタグ名を入力",
      "タグ名"
    );
    
    if (!newTagName || newTagName.trim() === "") {
      console.log("[QuickAdd-tag-selector] サブタグ名が入力されなかったためキャンセル");
      return null;
    }
    
    // 関連する大分類タグの選択
    let selectedMainCategories = [];
    if (mainTags.length > 0) {
      selectedMainCategories = await params.quickAddApi.checkboxPrompt(
        mainTags,
        "関連付ける大分類を選択してください（複数選択可）"
      );
      
      // 何も選択されなかった場合は再確認
      if (selectedMainCategories.length === 0) {
        const retry = await params.quickAddApi.yesNoPrompt(
          "大分類が選択されていません。再選択しますか？",
          "大分類選択"
        );
        
        if (retry) {
          selectedMainCategories = await params.quickAddApi.checkboxPrompt(
            mainTags,
            "関連付ける大分類を選択してください（複数選択可）"
          );
        } else {
          const createNew = await params.quickAddApi.yesNoPrompt(
            "新しい大分類を作成しますか？",
            "大分類作成"
          );
          
          if (createNew) {
            const newMainTag = await params.quickAddApi.inputPrompt(
              "新しい大分類名を入力",
              "大分類名"
            );
            
            if (newMainTag && newMainTag.trim() !== "") {
              await createMainTag(newMainTag, tagFolder);
              selectedMainCategories.push(newMainTag);
            }
          }
        }
      }
    }
    
    // 大分類が選択されなかった場合
    if (selectedMainCategories.length === 0) {
      console.log("[QuickAdd-tag-selector] 大分類が選択されなかったためデフォルト設定で続行");
    }
    
    console.log("[QuickAdd-tag-selector] サブタグ情報:", {
      name: newTagName,
      mainCategories: selectedMainCategories
    });
    
    // メインカテゴリリンクを文字列として生成
    const mainCategoryLinks = selectedMainCategories.map(cat => `[[${cat}]]`).join(", ");
    
    // ファイルの内容を直接生成
    const content = generateSubTagContent(newTagName, selectedMainCategories, mainCategoryLinks);
    const filePath = `${tagFolder}/${newTagName}.md`;
    
    // ファイルを作成
    await app.vault.create(filePath, content);
    console.log(`[QuickAdd-tag-selector] サブタグファイル作成: ${filePath}`);
    
    return newTagName;
  } catch (error) {
    console.error("[QuickAdd-tag-selector] サブタグ作成エラー:", error);
    return null;
  }
}

// メインタグ作成関数
async function createMainTag(tagName, tagFolder) {
  try {
    console.log(`[QuickAdd-tag-selector] メインタグ作成: ${tagName}`);
    
    // ファイルの内容を直接生成
    const content = generateMainTagContent(tagName);
    const filePath = `${tagFolder}/${tagName}.md`;
    
    // ファイルを作成
    await app.vault.create(filePath, content);
    console.log(`[QuickAdd-tag-selector] メインタグファイル作成: ${filePath}`);
    
    return true;
  } catch (error) {
    console.error("[QuickAdd-tag-selector] メインタグ作成エラー:", error);
    return false;
  }
}

// 現在のファイルにタグを適用する関数
async function applyTagsToCurrent(tags) {
  try {
    const currentFile = app.workspace.getActiveFile();
    if (!currentFile) {
      console.log("[QuickAdd-tag-selector] アクティブなファイルがありません");
      return false;
    }
    
    console.log(`[QuickAdd-tag-selector] ファイル ${currentFile.path} にタグを適用`);
    
    // ファイルの内容を取得
    const content = await app.vault.read(currentFile);
    const tagLinks = tags.map(tag => `[[${tag}]]`).join(", ");
    
    // 新しい内容を生成
    let newContent;
    
    // フロントマターがあるかチェック
    if (/^---\n(.*?)\n---/s.test(content)) {
      // フロントマターがある場合
      if (/tags:.*?(\n|$)/m.test(content)) {
        // tagsフィールドがある場合は更新（配列形式に修正）
        newContent = content.replace(/tags:.*?(\n|$)/m, `tags: [${tags.join(", ")}]\n`);
      } else {
        // tagsフィールドがない場合は追加
        newContent = content.replace(/^(---\n)(.*?)(\n---)/s, `$1$2\ntags: [${tags.join(", ")}]$3`);
      }
    } else {
      // フロントマターがない場合は追加
      newContent = `---\ntags: [${tags.join(", ")}]\n---\n\n${content}`;
    }
    
    // 「関連タグ:」の行があるか確認し、追加または更新
    if (/関連タグ:.*?(\n|$)/m.test(newContent)) {
      newContent = newContent.replace(/関連タグ:.*?(\n|$)/m, `関連タグ: ${tagLinks}\n`);
    } else {
      // タイトル行があるか確認し、その後に追加
      if (/^# .*?(\n|$)/m.test(newContent)) {
        newContent = newContent.replace(/^(# .*?)(\n|$)/m, `$1\n\n関連タグ: ${tagLinks}\n`);
      } else {
        // タイトル行がない場合はフロントマターの後に追加
        newContent = newContent.replace(/^(---\n.*?\n---\n)/s, `$1\n関連タグ: ${tagLinks}\n\n`);
      }
    }
    
    // 更新された内容を書き込む
    await app.vault.modify(currentFile, newContent);
    console.log(`[QuickAdd-tag-selector] ファイル ${currentFile.path} を更新しました`);
    
    return true;
  } catch (error) {
    console.error("[QuickAdd-tag-selector] ファイル更新エラー:", error);
    return false;
  }
}

// サブタグファイル内容の生成
function generateSubTagContent(tagName, mainCategories, mainCategoryLinks) {
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  
  // 大分類タグがない場合は「未設定」と表示
  const categoryLinks = mainCategoryLinks || "未設定";
  
  // フロントマターのタグ設定
  let frontmatterTags = "tag";
  if (mainCategories && mainCategories.length > 0) {
    frontmatterTags += ", " + mainCategories.join(", ");
  }
  
  return `---
aliases: ["${tagName}", "${tagName}タグ"]
type: subTag
created: ${now}
updated: ${now}
tags: [${frontmatterTags}]
---

# ${tagName} タグ（小分類）

**所属大分類**: ${categoryLinks}

## 関連ノート一覧

\`\`\`dataview
TABLE 
  file.ctime as "作成日", 
  file.mtime as "更新日"
FROM #${tagName}
WHERE file.name != "${tagName}"
SORT file.mtime DESC
\`\`\`

## メモ`;
}

// メインタグファイル内容の生成
function generateMainTagContent(tagName) {
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  
  return `---
aliases: ["${tagName}", "${tagName}タグ"]
type: mainTag
created: ${now}
updated: ${now}
---

# ${tagName} タグ（大分類）

このタグは${tagName}に関連する項目の大分類です。

## 所属する小分類タグ

\`\`\`dataview
TABLE 
  file.ctime as "作成日", 
  file.mtime as "更新日"
FROM #tag
WHERE contains(file.name, "${tagName}_") OR contains(tags, "${tagName}") OR contains(file.outlinks, "[[${tagName}]]")
SORT file.name ASC
\`\`\`

## 直接リンクしているノート

\`\`\`dataview
TABLE 
  file.ctime as "作成日", 
  file.mtime as "更新日"
FROM #"${tagName}" OR [[${tagName}]]
WHERE file.name != "${tagName}" AND !contains(file.name, "_")
SORT file.mtime DESC
\`\`\`

## メモ`;
}