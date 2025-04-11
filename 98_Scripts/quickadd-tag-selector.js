module.exports = async (params) => {
  // タグフォルダからすべての小分類タグを取得
  const tagFolder = "02_DB_tags";
  const tagsFiles = app.vault.getMarkdownFiles()
    .filter(file => file.path.startsWith(tagFolder))
    .filter(file => file.frontmatter && file.frontmatter.type === "subTag")  // 小分類タグのみ
    .map(file => file.basename);
  
  // タグリストに「新規タグ作成」オプションを追加
  tagsFiles.push("+ 新規タグを作成");
  
  // ユーザーに複数選択させる
  const selectedTags = await params.quickAddApi.checkboxPrompt(
    tagsFiles,
    "リンクするタグを選択してください（複数選択可）"
  );
  
  // 新規タグの作成処理
  if (selectedTags.includes("+ 新規タグを作成")) {
    // 小分類タグの名前を入力
    const newTagName = await params.quickAddApi.inputPrompt(
      "新規タグ名を入力",
      "タグ名"
    );
    
    if (newTagName) {
      // 既存の大分類タグを取得
      const mainCategories = app.vault.getMarkdownFiles()
        .filter(file => file.path.startsWith(tagFolder) && file.frontmatter && file.frontmatter.type === "mainTag")
        .map(file => file.basename);
      
      // 関連付ける大分類を選択（複数選択可）
      let selectedMainCategories = [];
      if (mainCategories.length > 0) {
        selectedMainCategories = await params.quickAddApi.checkboxPrompt(
          mainCategories,
          "関連付ける大分類を選択してください（複数選択可）"
        );
      }
      
      // 選択された大分類がない場合は、新しい大分類を作成するか聞く
      if (selectedMainCategories.length === 0) {
        const createMainTag = await params.quickAddApi.yesNoPrompt(
          "関連付ける大分類がありません。新しい大分類を作成しますか？",
          "大分類タグの作成"
        );
        
        if (createMainTag) {
          const newMainCategory = await params.quickAddApi.inputPrompt(
            "新しい大分類名を入力",
            "大分類名"
          );
          
          if (newMainCategory) {
            // 大分類タグ作成用のQuickAddコマンドを呼び出す
            await params.quickAddApi.executeChoice("メインDBタグ作成", {
              value: newMainCategory
            });
            
            selectedMainCategories.push(newMainCategory);
          }
        }
      }
      
      // 小分類タグを作成し、選択された大分類を変数として渡す
      await params.quickAddApi.executeChoice("サブDBタグ作成", {
        value: newTagName,
        variables: {
          selectedMainCategories: JSON.stringify(selectedMainCategories)
        }
      });
      
      // 選択タグリストに新規タグを追加
      selectedTags.push(newTagName);
    }
  }
  
  // 「+ 新規タグを作成」オプションをリストから削除
  const tagLinks = selectedTags.filter(tag => tag !== "+ 新規タグを作成");
  
  // 選択したタグをQuickAddの変数として保存
  params.variables["selectedTags"] = tagLinks.join(", ");
  params.variables["tagLinks"] = tagLinks.map(tag => `[[${tag}]]`).join(", ");
};