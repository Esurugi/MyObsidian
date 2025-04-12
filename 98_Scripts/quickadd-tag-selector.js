module.exports = async (params) => {
  // デバッグ情報を出力
  console.log("[QuickAdd-tag-selector] スクリプト開始");
  
  // 実行モード判定 - 引数から取得
  // 以下の順に優先度を設定:
  // 1. 明示的に渡された実行モードパラメータ
  // 2. クエリパラメータ (URLからの呼び出し時)
  // 3. 実行コンテキストの判定
  const mode = params.mode || "default";
  const isFromNewNote = mode === "fromNewNote" || (params.variables && params.variables["fromNewNote"] === true);
  const isSubTagCreation = mode === "createSubTag" || (params.variables && params.variables["isSubTagCreation"] === true);
  
  // ターゲットファイルが通知されているか確認
  const targetFilePath = params.variables && params.variables["targetFilePath"];
  let targetFile = null;
  if (targetFilePath) {
    targetFile = app.vault.getAbstractFileByPath(targetFilePath);
    console.log(`[ターゲットファイル指定] ${targetFilePath}`);
  }
  
  console.log("[QuickAdd-tag-selector] 実行モード:", { mode, isFromNewNote, isSubTagCreation });
  
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
  
  // サブタグ作成専用モードは無効化
  if (isSubTagCreation) {
    new Notice("この機能は無効化されています。タグ管理機能から新規タグを作成してください。");
    return params.variables || {};
  }
  
  // メインタグとサブタグを結合してソート
  const sortedTags = [...mainTags, ...subTags].sort();
  
  // 通常モード（新規ノート作成やタグ選択）の場合
  // 既存のタグのみ表示
  const tagOptions = sortedTags;
  
  // ユーザーに選択を促すメッセージを表示
  new Notice("リンクするタグを選択してください（複数選択可）");

  // ユーザーに複数選択させる（第二引数は空配列を渡す）
  const selectedTags = await params.quickAddApi.checkboxPrompt(
    tagOptions,
    []  // 空の配列を渡す
  );
  
  let finalTags = selectedTags;
  
  // タグが選択されたら、変数に保存
  if (finalTags.length > 0) {
    console.log("[QuickAdd-tag-selector] 選択されたタグ (詳細):", JSON.stringify(finalTags));
    
    // 入力パラメータをチェック
    console.log("[QuickAdd-tag-selector] 入力変数:", JSON.stringify(params.variables || {}));
    
    // 結果を返すオブジェクトを初期化
    const result = {}; // 新しい空のオブジェクトから始める
    
    // QuickAddとTemplaterの変数として保存
    result["selectedTags"] = finalTags.join(", ");
    result["tagLinks"] = finalTags.map(tag => `[[${tag}]]`).join(", ");
    
    // 結果を詳細にログ表示
    console.log("[QuickAdd-tag-selector] 返却値:", JSON.stringify(result));
    
    // ファイルへのタグ適用処理
    if (isFromNewNote) {
      // 新規ノート作成モードの場合はテンプレート変数として返すのみ
      console.log("[新規ノートモード] タグをテンプレート変数として返します");
    } else if (targetFile) {
      // ターゲットファイルが指定されている場合
      await applyTagsToFile(targetFile, finalTags);
    } else {
      // 通常の場合はアクティブファイルに適用
      await applyTagsToCurrent(finalTags);
    }
    
    return result;
  }
  
  return params.variables || {};
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
      // 選択を促すメッセージを表示
      new Notice("関連付ける大分類を選択してください（複数選択可）");
      
      // 大分類選択（第二引数は空配列を渡す）
      selectedMainCategories = await params.quickAddApi.checkboxPrompt(
        mainTags,
        []  // 空の配列を渡す
      );
      
      // 何も選択されなかった場合は再確認
      if (selectedMainCategories.length === 0) {
        const retry = await params.quickAddApi.yesNoPrompt(
          "大分類が選択されていません。再選択しますか？",
          "大分類選択"
        );
        
        if (retry) {
          new Notice("関連付ける大分類を選択してください（複数選択可）");
          selectedMainCategories = await params.quickAddApi.checkboxPrompt(
            mainTags,
            []  // 空の配列を渡す
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
    // mainTags を正しい形式で設定
const mainTagsYaml = JSON.stringify(selectedMainCategories);
const content = generateSubTagContent(newTagName, selectedMainCategories, mainCategoryLinks, mainTagsYaml);
    const filePath = `${tagFolder}/${newTagName}.md`;
    
    // ファイルを作成
    await app.vault.create(filePath, content);
    console.log(`[QuickAdd-tag-selector] サブタグファイル作成: ${filePath}`);
    
    // 各メインカテゴリのファイルにも関連情報を追加する処理を追加
    for (const mainCategory of selectedMainCategories) {
      try {
        const mainCategoryPath = `${tagFolder}/${mainCategory}.md`;
        const mainFile = app.vault.getAbstractFileByPath(mainCategoryPath);
        if (mainFile) {
          console.log(`[QuickAdd-tag-selector] メインカテゴリ ${mainCategory} に関連サブカテゴリ情報を追加`);
          // メインカテゴリファイルの内容更新などの処理を追加可能
        }
      } catch (error) {
        console.error(`[QuickAdd-tag-selector] メインカテゴリ ${mainCategory} の更新に失敗:`, error);
      }
    }
    
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

// 特定のファイルにタグを適用する関数
async function applyTagsToFile(file, tags) {
  try {
    if (!file) {
      console.log("[QuickAdd-tag-selector] ファイルが指定されていません");
      return false;
    }
    
    console.log(`[QuickAdd-tag-selector] ファイル ${file.path} にタグを適用`);
    
    // ファイルの内容を取得
    const content = await app.vault.read(file);
    const tagLinks = tags.map(tag => `[[${tag}]]`).join(", ");
    
    // YAMLフロントマター用に各タグをダブルクォートで囲む
    const frontmatterTags = tags.map(tag => `"${tag}"`).join(", ");
    
    // 新しい内容を生成
    let newContent;
    
    // フロントマターがあるかチェック
    if (/^---\n(.*?)\n---/s.test(content)) {
      // フロントマターがある場合
      if (/tags:.*?(\n|$)/m.test(content)) {
        // tagsフィールドがある場合は更新（YAMLの配列形式に修正）
        newContent = content.replace(/tags:.*?(\n|$)/m, `tags: [${frontmatterTags}]\n`);
      } else {
        // tagsフィールドがない場合は追加
        newContent = content.replace(/^(---\n)(.*?)(\n---)/s, `$1$2\ntags: [${frontmatterTags}]$3`);
      }
    } else {
      // フロントマターがない場合は追加
      newContent = `---\ntags: [${frontmatterTags}]\n---\n\n${content}`;
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
    await app.vault.modify(file, newContent);
    console.log(`[QuickAdd-tag-selector] ファイル ${file.path} を更新しました`);
    
    return true;
  } catch (error) {
    console.error("[QuickAdd-tag-selector] ファイル更新エラー:", error);
    return false;
  }
}

// 現在のアクティブファイルにタグを適用する関数
async function applyTagsToCurrent(tags) {
  try {
    const currentFile = app.workspace.getActiveFile();
    if (!currentFile) {
      console.log("[QuickAdd-tag-selector] アクティブなファイルがありません");
      return false;
    }
    
    return await applyTagsToFile(currentFile, tags);
  } catch (error) {
    console.error("[QuickAdd-tag-selector] ファイル更新エラー:", error);
    return false;
  }
}

// サブタグファイル内容の生成
function generateSubTagContent(tagName, mainCategories, mainCategoryLinks, mainTagsYaml) {
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  
  // 大分類タグがない場合は「未設定」と表示
  const categoryLinks = mainCategoryLinks || "未設定";
  
  return `---
type: subTag
created: ${now}
updated: ${now}
tags: ["tag"]
mainTags: ${mainTagsYaml}
---

# ${tagName} タグ（小分類）

**所属大分類**: ${categoryLinks}

## 関連ノート一覧

\`\`\`dataview
TABLE 
  file.ctime as "作成日", 
  file.mtime as "更新日"
FROM [[${tagName}]] 
WHERE file.name != "${tagName}" AND !contains(file.path, "01_Templater")
SORT file.mtime DESC
\`\`\`

## メモ`;
}

// メインタグファイル内容の生成
function generateMainTagContent(tagName) {
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  
  return `---
type: mainTag
created: ${now}
updated: ${now}
tags: ["tag"]
---

# ${tagName} タグ（大分類）

このタグは${tagName}に関連する項目の大分類です。

## 所属する小分類タグ

\`\`\`dataview
TABLE 
  file.ctime as "作成日", 
  file.mtime as "更新日"
FROM #tag
WHERE contains(file.frontmatter.mainTags, "${tagName}")
SORT file.name ASC
\`\`\`

## 直接リンクしているノート

\`\`\`dataview
TABLE 
  file.ctime as "作成日", 
  file.mtime as "更新日"
FROM [[${tagName}]]
WHERE file.name != "${tagName}" AND !contains(file.frontmatter.type, "subTag")
SORT file.mtime DESC
\`\`\`

## メモ`;
}