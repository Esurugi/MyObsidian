module.exports = async (params) => {
  // タグフォルダからすべての小分類タグを取得
  const tagFolder = "02_DB_tags";
  const subTagFiles = app.vault.getMarkdownFiles()
    .filter(file => file.path.startsWith(tagFolder))
    .map(file => file.basename);
  
  // タグリストに「新規タグ作成」オプションを追加
  subTagFiles.push("+ 新規タグを作成");
  
  // ユーザーに複数選択させる
  const selectedTags = await params.quickAddApi.checkboxPrompt(
    subTagFiles,
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
      // 既存の大分類タグを取得（アンダースコアを含まないファイル）
      const mainCategories = app.vault.getMarkdownFiles()
        .filter(file => file.path.startsWith(tagFolder) && !file.basename.includes("_"))
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
      
      // QuickAddでサブタグを作成（変数を渡す）
      // ダブルプロンプトを避けるために変数で先に名前を設定
      await params.quickAddApi.executeChoice("サブDBタグ作成", {
        value: newTagName
      });
      
      // ファイルが作成されたら、大分類情報を追加
      setTimeout(async () => {
        try {
          // 作成されたファイルを探す
          const tagFile = app.vault.getAbstractFileByPath(`${tagFolder}/${newTagName}.md`);
          
          if (tagFile) {
            // ファイルの内容を読み込む
            const content = await app.vault.read(tagFile);
            
            // 大分類情報がある場合、それを置き換える
            if (selectedMainCategories.length > 0) {
              const mainCategoryLinks = selectedMainCategories.map(cat => `[[${cat}]]`).join(", ");
              const newContent = content.replace(/\*\*所属大分類\*\*\: 未設定/g, `**所属大分類**: ${mainCategoryLinks}`);
              
              // 更新された内容を書き込む
              await app.vault.modify(tagFile, newContent);
            }
          }
        } catch (e) {
          console.error("タグファイル更新エラー:", e);
        }
      }, 500); // 少し遅延させてファイル作成を待つ
      
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