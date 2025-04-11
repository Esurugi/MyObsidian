// 98_Scripts/make-subtag.js
module.exports = async (params) => {
  // 1. 大分類タグのリストを取得（テンプレートを除外）
  const mainTagFiles = app.vault.getMarkdownFiles()
    .filter(file => {
      const cache = app.metadataCache.getFileCache(file);
      return cache?.frontmatter?.type === "mainTag" && 
             !file.basename.toLowerCase().includes("template");
    })
    .map(file => file.basename);
  
  if (mainTagFiles.length === 0) {
    new Notice("大分類タグが見つかりません。先に大分類タグを作成してください。");
    return;
  }
  
  // 2. 小分類タグ名の入力
  const subTagName = await params.quickAddApi.inputPrompt(
    "小分類タグ名を入力してください", 
    "タグ名"
  );
  
  if (!subTagName) return;
  
  // 3. 大分類タグを複数選択（第二引数を空配列に修正）
  new Notice("関連付ける大分類タグを選択してください（複数選択可）");
  const selectedMainTags = await params.quickAddApi.checkboxPrompt(
    mainTagFiles,
    [] // 正しい使い方: 第二引数はデフォルト選択項目の配列
  );
  
  if (!selectedMainTags || selectedMainTags.length === 0) return;
  
  // デバッグ用ログ追加
  console.log("選択された大分類タグ:", selectedMainTags);
  
  // 4. ファイル内容を直接構築
  const fileContent = `---
aliases: [${subTagName}タグ]
type: subTag
created: ${moment().format("YYYY-MM-DD HH:mm:ss")}
updated: ${moment().format("YYYY-MM-DD HH:mm:ss")}
tags: [tag]
mainTags: ${JSON.stringify(selectedMainTags)}
---

# ${subTagName} タグ（小分類）

**所属大分類**: ${selectedMainTags.map(tag => `[[${tag}]]`).join(", ")}

## 関連ノート一覧

\`\`\`dataview
TABLE 
  file.ctime as "作成日", 
  file.mtime as "更新日"
FROM [[${subTagName}]] 
WHERE file.name != "${subTagName}" AND !contains(file.path, "01_Templater")
SORT file.mtime DESC
\`\`\`

## メモ`;

  // 5. ファイルを作成
  try {
    // フォルダパスを確保
    const folderPath = "02_DB_tags";
    const filePath = `${folderPath}/${subTagName}.md`;
    
    // ファイル作成
    await app.vault.create(filePath, fileContent);
    
    // 成功通知
    new Notice(`小分類タグ「${subTagName}」を作成しました！`);
    
    // 作成したファイルを開く
    const file = app.vault.getAbstractFileByPath(filePath);
    if (file) {
      app.workspace.getLeaf().openFile(file);
    }
  } catch (error) {
    console.error("ファイル作成エラー:", error);
    new Notice(`エラー: ${error.message}`);
  }
  
  // QuickAddの処理を終了（テンプレート処理は行わない）
  return false;
};