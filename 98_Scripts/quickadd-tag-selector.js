module.exports = async (params) => {
    // タグフォルダからすべての小分類タグを取得
    const tagFolder = "02_DB_tags";
    const tagsFiles = app.vault.getMarkdownFiles()
      .filter(file => file.path.startsWith(tagFolder))
      .filter(file => file.basename.includes("_"))  // 小分類タグのみ（アンダースコアを含む）
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
      const newTagName = await params.quickAddApi.inputPrompt(
        "新規タグ名を入力（例: Memo_project）",
        "タグ名"
      );
      
      if (newTagName) {
        // 新規タグ名から大分類を抽出
        const mainCategory = newTagName.split("_")[0];
        
        // 大分類が存在するか確認
        const mainTagExists = app.vault.getMarkdownFiles()
          .some(file => file.basename === mainCategory && file.path.startsWith(tagFolder));
        
        // 大分類が存在しない場合は大分類も作成
        if (!mainTagExists) {
          const createMainTag = await params.quickAddApi.yesNoPrompt(
            `大分類「${mainCategory}」が存在しません。作成しますか？`,
            "メインDBタグの作成"
          );
          
          if (createMainTag) {
            // 大分類タグ作成用のQuickAddコマンドを呼び出す
            await params.quickAddApi.executeChoice("メインDBタグ作成", {
              value: mainCategory
            });
          }
        }
        
        // 小分類タグ作成用のQuickAddコマンドを呼び出す
        await params.quickAddApi.executeChoice("サブDBタグ作成", {
          value: newTagName
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