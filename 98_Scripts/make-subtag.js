module.exports = async (params) => {
  // タグ名を入力
  const tagName = await params.quickAddApi.inputPrompt(
    "タグ名を入力してください", 
    "タグ名"
  );
  
  if (!tagName) return;
  
  // 大分類タグ一覧を取得（フロントマターでtype: mainTagのファイル）
  const tagFolder = "02_DB_tags";
  const mainTagFiles = app.vault.getMarkdownFiles()
    .filter(file => file.path.startsWith(tagFolder))
    .filter(file => {
      const cache = app.metadataCache.getFileCache(file);
      return cache?.frontmatter?.type === "mainTag";
    })
    .map(file => file.basename);
  
  // ユーザーに大分類タグを選択させる
  const selectedMainTags = await params.quickAddApi.checkboxPrompt(
    mainTagFiles,
    "所属させる大分類タグを選択してください（複数選択可）"
  );
  
  // 選択した大分類タグをフォーマット
  const formattedTags = selectedMainTags.map(tag => `- [[${tag}]]`).join('\n');
  
  // テンプレート変数を設定
  params.variables["selectedMainTags"] = formattedTags;
  params.variables["tagName"] = tagName;
};