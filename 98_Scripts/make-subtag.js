async function generateSubTag(params) {
  // 1. 大分類タグのリストを取得
  const mainTagFiles = app.vault.getMarkdownFiles()
    .filter(file => {
      const cache = app.metadataCache.getFileCache(file);
      return cache?.frontmatter?.type === "mainTag";
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
  
  // 3. 大分類タグを複数選択
  const selectedMainTags = await params.quickAddApi.checkboxPrompt(
    mainTagFiles,
    "関連付ける大分類タグを選択してください（複数選択可）"
  );
  
  if (!selectedMainTags || selectedMainTags.length === 0) return;
  
  // 4. 選択された大分類タグをパラメータとして保存
  params.variables["subTagName"] = subTagName;
  params.variables["selectedMainTags"] = selectedMainTags;
  
  // 5. YAML配列形式で保存するためのタグ文字列を生成
  const mainTagsYaml = JSON.stringify(selectedMainTags);
  params.variables["mainTagsYaml"] = mainTagsYaml;
  
  // 6. リンク形式での大分類リスト
  const mainTagLinks = selectedMainTags.map(tag => `[[${tag}]]`).join(", ");
  params.variables["mainTagLinks"] = mainTagLinks;
}

// この行が重要！Templaterはこの形式のエクスポートを期待しています
module.exports = generateSubTag;