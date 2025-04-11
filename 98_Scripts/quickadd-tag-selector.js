module.exports = async (params) => {
  // モード判定 (新規ノート作成からの呼び出しかどうか)
  const isFromNewNote = params.variables && params.variables["fromNewNote"] === true;
  
  // タグフォルダからすべての小分類タグを取得
  const tagFolder = "02_DB_tags";
  const subTagFiles = app.vault.getMarkdownFiles()
    .filter(file => file.path.startsWith(tagFolder))
    .filter(file => !file.basename.includes("/"))  // フォルダを除外
    .map(file => file.basename);
  
  // タグをフィルタリング（アンダースコアを含むファイルをサブタグとして扱う）
  const subTags = subTagFiles.filter(tag => tag.includes("_"));
  
  // タグリストに「新規タグ作成」オプションを追加
  const tagOptions = [...subTags];
  tagOptions.push("+ 新規タグを作成");
  
  // ユーザーに複数選択させる
  const selectedTagsPrompt = "リンクするタグを選択してください（複数選択可）";
  const selectedTags = await params.quickAddApi.checkboxPrompt(
    tagOptions,
    selectedTagsPrompt
  );
  
  const finalTags = [...selectedTags].filter(tag => tag !== "+ 新規タグを作成");
  let createdNewTag = false;
  
  // 新規タグの作成処理
  if (selectedTags.includes("+ 新規タグを作成")) {
    // 小分類タグの名前を入力
    const newTagName = await params.quickAddApi.inputPrompt(
      "新規タグ名を入力",
      "タグ名"
    );
    
    if (newTagName && newTagName.trim() !== "") {
      createdNewTag = true;
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
          
          if (newMainCategory && newMainCategory.trim() !== "") {
            // 大分類タグ作成用のQuickAddコマンドを呼び出す
            await params.quickAddApi.executeChoice("メインDBタグ作成", {
              value: newMainCategory
            });
            
            selectedMainCategories.push(newMainCategory);
          }
        }
      }
      
      // 変数を設定してサブタグを作成
      // 文字列全体を一つのリンクにするよう修正
      const mainCategoryLinks = selectedMainCategories.map(cat => `[[${cat}]]`).join(", ");
      
      // フロントマター用のタグ文字列を作成（カンマ区切り）
      const mainCategoriesTags = selectedMainCategories.join(", ");
      
      const subTagVariables = {
        value: newTagName,
        mainCategories: selectedMainCategories,
        mainCategoryLinks: mainCategoryLinks,
        mainCategoriesTags: mainCategoriesTags
      };
      
      // QuickAddでサブタグを作成（変数を渡す）
      await params.quickAddApi.executeChoice("サブDBタグ作成", subTagVariables);
      
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
              // 大分類情報を正しく設定
              const newContent = content.replace(/\*\*所属大分類\*\*\: 未設定/g, `**所属大分類**: ${mainCategoryLinks}`);
              
              // フロントマターのtagsを修正（大分類タグを追加）
              let updatedContent = newContent;
              if (selectedMainCategories.length > 0) {
                // tagsフィールドが既に存在する場合
                const tagsRegex = /tags: \[(.*?)\]/;
                if (tagsRegex.test(updatedContent)) {
                  // 既存のタグに大分類タグを追加
                  updatedContent = updatedContent.replace(tagsRegex, (match, tagContent) => {
                    const existingTags = tagContent.split(', ');
                    // 重複を避けるための処理
                    const combinedTags = [...new Set([...existingTags, ...selectedMainCategories])];
                    return `tags: [${combinedTags.join(', ')}]`;
                  });
                }
              }
              
              // 更新された内容を書き込む
              await app.vault.modify(tagFile, updatedContent);
              
              // 各大分類のファイルを更新して、新しい小分類を関連付ける
              for (const mainCategory of selectedMainCategories) {
                const mainTagFile = app.vault.getAbstractFileByPath(`${tagFolder}/${mainCategory}.md`);
                if (mainTagFile) {
                  console.log(`大分類ファイル ${mainCategory} を更新します`);
                }
              }
            }
          }
        } catch (e) {
          console.error("タグファイル更新エラー:", e);
        }
      }, 500); // 少し遅延させてファイル作成を待つ
      
      // 選択タグリストに新規タグを追加
      finalTags.push(newTagName);
    }
  }
  
  // 選択したタグをQuickAddの変数として保存
  params.variables["selectedTags"] = finalTags.join(", ");
  params.variables["tagLinks"] = finalTags.map(tag => `[[${tag}]]`).join(", ");
  
  // 新規ノート作成からの呼び出しでない場合、または新規ノート作成からの呼び出しで新規タグが作成された場合
  // 現在のファイルにタグ情報を適用
  if (finalTags.length > 0 && (!isFromNewNote || createdNewTag)) {
    try {
      const currentFile = app.workspace.getActiveFile();
      if (currentFile) {
        const content = await app.vault.read(currentFile);
        const tagLinks = finalTags.map(tag => `[[${tag}]]`).join(", ");
        
        // ファイルにフロントマターがあるか確認し、タグを追加
        let newContent;
        if (/^---\n(.*?)\n---/s.test(content)) {
          // フロントマターがある場合、tagsフィールドを追加または更新
          if (/tags:.*?(\n|$)/m.test(content)) {
            // tagsフィールドが既にある場合は更新
            newContent = content.replace(/tags:.*?(\n|$)/m, `tags: ${finalTags.join(", ")}\n`);
          } else {
            // tagsフィールドがない場合は追加
            newContent = content.replace(/^(---\n)(.*?)(\n---)/s, `$1$2\ntags: ${finalTags.join(", ")}$3`);
          }
        } else {
          // フロントマターがない場合は追加
          newContent = `---\ntags: ${finalTags.join(", ")}\n---\n\n${content}`;
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
      }
    } catch (e) {
      console.error("ファイル更新エラー:", e);
    }
  }
  
  return params.variables;
};