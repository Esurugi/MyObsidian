// 98_Scripts/apply-tags-to-current.js
// 現在のアクティブノートにタグを追加するスクリプト

module.exports = async (params) => {
  console.log("[ApplyTagsToCurrent] スクリプト開始");
  
  // アクティブファイルの取得
  const activeFile = app.workspace.getActiveFile();
  if (!activeFile) {
    new Notice("アクティブなファイルが見つかりません");
    console.log("[ApplyTagsToCurrent] アクティブなファイルが見つかりません");
    return;
  }
  
  console.log(`[ApplyTagsToCurrent] アクティブファイル: ${activeFile.path}`);
  
  // タグフォルダからすべてのタグを取得
  const tagFolder = "02_DB_tags";
  const tagFiles = app.vault.getMarkdownFiles()
    .filter(file => file.path.startsWith(tagFolder))
    .filter(file => !file.basename.includes("/"))  // フォルダを除外
    .map(file => file.basename);
  
  // 重要な順にソートする（メインタグ→サブタグ）
  const mainTags = tagFiles
    .filter(file => !file.basename.includes("_"))
    .sort();
    
  const subTags = tagFiles
    .filter(file => file.basename.includes("_"))
    .sort();
  
  const sortedTags = [...mainTags, ...subTags];
  
  console.log(`[ApplyTagsToCurrent] 利用可能なタグ: ${sortedTags.length}個`);

  // ユーザーにタグを選択させる
  new Notice("このノートに適用するタグを選択してください（複数選択可）");
  const selectedTags = await params.quickAddApi.checkboxPrompt(
    sortedTags,
    []  // 空の配列を渡す（デフォルト選択なし）
  );
  
  if (!selectedTags || selectedTags.length === 0) {
    new Notice("タグが選択されませんでした");
    console.log("[ApplyTagsToCurrent] タグが選択されませんでした");
    return;
  }
  
  console.log(`[ApplyTagsToCurrent] 選択されたタグ: ${selectedTags.join(", ")}`);
  
  try {
    // ファイルの内容を取得
    const content = await app.vault.read(activeFile);
    
    // タグリンクとフロントマタータグの準備
    const tagLinks = selectedTags.map(tag => `[[${tag}]]`).join(", ");
    const frontmatterTags = selectedTags.map(tag => `"${tag}"`).join(", ");
    
    // 新しい内容を作成
    let newContent;
    
    // フロントマターがあるかチェック
    if (/^---\n(.*?)\n---/s.test(content)) {
      // フロントマターがある場合
      if (/tags:.*?(\n|$)/m.test(content)) {
        // tagsフィールドがある場合は更新
        newContent = content.replace(/tags:.*?(\n|$)/m, `tags: [${frontmatterTags}]\n`);
      } else {
        // tagsフィールドがない場合は追加
        newContent = content.replace(/^(---\n)(.*?)(\n---)/s, `$1$2\ntags: [${frontmatterTags}]$3`);
      }
    } else {
      // フロントマターがない場合は追加
      newContent = `---\ntags: [${frontmatterTags}]\n---\n\n${content}`;
    }
    
    // 「関連タグ:」の行を追加または更新
    if (/関連タグ:.*?(\n|$)/m.test(newContent)) {
      // すでに「関連タグ:」の行がある場合は更新
      newContent = newContent.replace(/関連タグ:.*?(\n|$)/m, `関連タグ: ${tagLinks}\n`);
    } else {
      // タイトル行があるか確認
      if (/^# .*?(\n|$)/m.test(newContent)) {
        // タイトル行がある場合はその後に追加
        newContent = newContent.replace(/^(# .*?)(\n|$)/m, `$1\n\n関連タグ: ${tagLinks}\n`);
      } else {
        // タイトル行がない場合はフロントマターの後に追加
        newContent = newContent.replace(/^(---\n.*?\n---\n)/s, `$1\n関連タグ: ${tagLinks}\n\n`);
      }
    }
    
    // ファイルを更新
    await app.vault.modify(activeFile, newContent);
    
    new Notice(`${selectedTags.length}個のタグを適用しました`);
    console.log(`[ApplyTagsToCurrent] ${selectedTags.length}個のタグを適用しました`);
    
  } catch (error) {
    console.error("[ApplyTagsToCurrent] エラー:", error);
    new Notice(`エラーが発生しました: ${error.message}`);
  }
};