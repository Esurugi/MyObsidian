module.exports = async (params) => {
  // デバッグ情報を出力
  console.log("[QuickAdd-tag-selector] スクリプト開始");
  console.log("[QuickAdd-tag-selector] 渡されたパラメータ:", params.variables);
  
  // 機能フラグ
  const isFromNewNote = params.variables && params.variables["fromNewNote"] === true;
  const isSubTagCreation = params.variables && params.variables["isSubTagCreation"] === true;

  console.log("[QuickAdd-tag-selector] 実行モード:", {isFromNewNote, isSubTagCreation});
  
  // タグフォルダのパス
  const tagFolder = "02_DB_tags";
  const app = this.app || window.app;
  
  try {
    // タグファイルの一覧を取得
    const tagFiles = app.vault.getMarkdownFiles()
      .filter(file => file.path.startsWith(tagFolder))
      .filter(file => !file.path.includes("/."));
    
    // メインタグとサブタグを分類
    const mainTags = tagFiles
      .filter(file => !file.basename.includes("_"))
      .map(file => file.basename);
    
    const subTags = tagFiles
      .filter(file => file.basename.includes("_"))
      .map(file => file.basename);
    
    console.log("[QuickAdd-tag-selector] 既存タグ:", {mainTagsCount: mainTags.length, subTagsCount: subTags.length});
    
    // サブタグ作成モードの場合
    if (isSubTagCreation) {
      await createSubTag(params, mainTags, tagFolder);
      return;
    }
    
    // 通常の新規ノート作成やタグ選択モードの場合
    // サブタグ選択リストを表示
    const options = [...subTags, "+ 新規タグを作成"];
    const selectedTags = await params.quickAddApi.checkboxPrompt(
      options,
      "リンクするタグを選択してください (複数選択可)"
    );
    
    let finalTags = selectedTags.filter(tag => tag !== "+ 新規タグを作成");
    
    // 「新規タグ作成」が選択された場合
    if (selectedTags.includes("+ 新規タグを作成")) {
      const newTag = await createSubTag(params, mainTags, tagFolder);
      if (newTag) {
        finalTags.push(newTag);
      }
    }
    
    // タグが選択されたら、新規ノートに適用するか、現在のファイルに適用する
    if (finalTags.length > 0) {
      console.log("[QuickAdd-tag-selector] 選択されたタグ:", finalTags);
      
      // 変数をセットしてテンプレートに渡す
      params.variables["selectedTags"] = finalTags.join(", ");
      params.variables["tagLinks"] = finalTags.map(tag => `[[${tag}]]`).join(", ");
      
      if (!isFromNewNote) {
        // 現在開いているファイルにタグを適用
        await applyTagsToCurrentFile(finalTags);
      }
    }
    
    return params.variables;
  } catch (error) {
    console.error("[QuickAdd-tag-selector] エラー発生:", error);
    return params.variables;
  }
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
      
      // 大分類が選択されなかった場合の処理
      if (selectedMainCategories.length === 0) {
        const retry = await params.quickAddApi.yesNoPrompt(
          "大分類が選択されていません。大分類選択に戻りますか？",
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
              // 大分類を作成
              await createMainTag(params, newMainTag);
              selectedMainCategories.push(newMainTag);
            }
          }
        }
      }
    }
    
    if (selectedMainCategories.length === 0) {
      console.log("[QuickAdd-tag-selector] 大分類が選択されなかったためキャンセル");
      return null;
    }
    
    console.log("[QuickAdd-tag-selector] サブタグ情報:", {
      tagName: newTagName,
      mainCategories: selectedMainCategories
    });
    
    // ファイルの内容を生成
    const mainCategoryLinks = selectedMainCategories.map(cat => `[[${cat}]]`).join(", ");
    const fileContent = generateSubTagContent(newTagName, selectedMainCategories, mainCategoryLinks);
    
    // ファイルパスを指定
    const filePath = `${tagFolder}/${newTagName}.md`;
    
    try {
      // サブタグファイルを直接作成
      await app.vault.create(filePath, fileContent);
      console.log("[QuickAdd-tag-selector] サブタグファイル作成成功:", filePath);
      
      // 成功したら新しいタグ名を返す
      return newTagName;
    } catch (error) {
      console.error("[QuickAdd-tag-selector] サブタグファイル作成失敗:", error);
      return null;
    }
  } catch (error) {
    console.error("[QuickAdd-tag-selector] サブタグ作成中にエラー:", error);
    return null;
  }
}

// サブタグファイルの内容を生成する関数
function generateSubTagContent(tagName, mainCategories, mainCategoryLinks) {
  const now = new Date().toISOString().replace('T', ' ').split('.')[0];
  
  return `---
aliases: ["${tagName}", "${tagName}タグ"]
type: subTag
created: ${now}
updated: ${now}
tags: [tag, ${mainCategories.join(", ")}]
---

# ${tagName} タグ（小分類）

**所属大分類**: ${mainCategoryLinks}

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

// メインタグ作成関数
async function createMainTag(params, tagName) {
  try {
    console.log("[QuickAdd-tag-selector] メインタグ作成開始:", tagName);
    
    // Templaterを使用せずに直接ファイル内容を生成
    const now = new Date().toISOString().replace('T', ' ').split('.')[0];
    const fileContent = `---
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
    
    // ファイルパスを指定
    const filePath = `02_DB_tags/${tagName}.md`;
    
    // ファイル作成
    await app.vault.create(filePath, fileContent);
    console.log("[QuickAdd-tag-selector] メインタグファイル作成成功:", filePath);
    
    return true;
  } catch (error) {
    console.error("[QuickAdd-tag-selector] メインタグファイル作成失敗:", error);
    return false;
  }
}

// 現在のファイルにタグを適用する関数
async function applyTagsToCurrentFile(tags) {
  try {
    const currentFile = app.workspace.getActiveFile();
    if (!currentFile) {
      console.log("[QuickAdd-tag-selector] 現在アクティブなファイルがありません");
      return;
    }
    
    console.log("[QuickAdd-tag-selector] 現在のファイルにタグを適用:", currentFile.path);
    
    // ファイル内容を取得
    const content = await app.vault.read(currentFile);
    const tagLinks = tags.map(tag => `[[${tag}]]`).join(", ");
    
    let newContent;
    
    // フロントマターがあるかチェック
    if (/^---\n(.*?)\n---/s.test(content)) {
      // フロントマターがある場合
      if (/tags:.*?(\n|$)/m.test(content)) {
        // tagsフィールドがある場合は更新
        newContent = content.replace(/tags:.*?(\n|$)/m, `tags: [${tags.join(", ")}]\n`);
      } else {
        // tagsフィールドがない場合は追加
        newContent = content.replace(/^(---\n)(.*?)(\n---)/s, `$1$2\ntags: [${tags.join(", ")}]$3`);
      }
    } else {
      // フロントマターがない場合は追加
      newContent = `---\ntags: [${tags.join(", ")}]\n---\n\n${content}`;
    }
    
    // 関連タグ行があるかチェック
    if (/関連タグ:.*?(\n|$)/m.test(newContent)) {
      // 関連タグ行がある場合は更新
      newContent = newContent.replace(/関連タグ:.*?(\n|$)/m, `関連タグ: ${tagLinks}\n`);
    } else {
      // タイトル行があるかチェック
      if (/^# .*?(\n|$)/m.test(newContent)) {
        // タイトル行がある場合はその後に追加
        newContent = newContent.replace(/^(# .*?)(\n|$)/m, `$1\n\n関連タグ: ${tagLinks}\n`);
      } else {
        // タイトル行がない場合はフロントマター後に追加
        newContent = newContent.replace(/^(---\n.*?\n---\n)/s, `$1\n関連タグ: ${tagLinks}\n\n`);
      }
    }
    
    // ファイル内容を更新
    await app.vault.modify(currentFile, newContent);
    console.log("[QuickAdd-tag-selector] ファイル更新完了:", currentFile.path);
    
    return true;
  } catch (error) {
    console.error("[QuickAdd-tag-selector] ファイル更新中にエラー:", error);
    return false;
  }
}