module.exports = async (params) => {
  const isFromNewNote = params.variables && params.variables["fromNewNote"] === true;
  
  // タグフォルダからすべてのタグを取得
  const tagFolder = "02_DB_tags";
  const tagFiles = app.vault.getMarkdownFiles()
    .filter(file => file.path.startsWith(tagFolder))
    .filter(file => !file.basename.includes("/"));
  
  // サブタグとメインタグの分類
  const subTags = tagFiles
    .filter(file => file.basename.includes("_"))
    .map(file => file.basename);
  
  const mainTags = tagFiles
    .filter(file => !file.basename.includes("_"))
    .map(file => file.basename);
  
  // タグ選択オプションを構成
  const tagOptions = [...subTags, "+ 新規タグを作成"];
  
  // ユーザーにタグを選択させる
  const selectedTags = await params.quickAddApi.checkboxPrompt(
    tagOptions,
    "リンクするタグを選択してください（複数選択可）"
  );
  
  const selectedSubTags = selectedTags.filter(tag => tag !== "+ 新規タグを作成");
  let newTagCreated = false;
  
  // 新規タグ作成処理
  if (selectedTags.includes("+ 新規タグを作成")) {
    // 新規タグ名の入力
    const newTagName = await params.quickAddApi.inputPrompt(
      "新規タグ名を入力",
      "タグ名"
    );
    
    if (newTagName && newTagName.trim() !== "") {
      // 関連付けるメインタグの選択
      const selectedMainTags = await params.quickAddApi.checkboxPrompt(
        mainTags,
        "関連付ける大分類タグを選択してください（複数選択可）"
      );
      
      if (selectedMainTags.length > 0) {
        // メインタグのリンク形式を作成
        const mainTagLinks = selectedMainTags.map(tag => `[[${tag}]]`).join(", ");
        
        // サブタグ作成用の変数を設定
        const subTagVars = {
          "value": newTagName,
          "mainCategories": selectedMainTags,
          "mainCategoryLinks": mainTagLinks
        };
        
        // サブタグを作成
        await params.quickAddApi.executeChoice("サブDBタグ作成", subTagVars);
        
        // サブタグファイルを確実に更新するための遅延処理
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // サブタグファイルを取得して更新
        const subTagPath = `${tagFolder}/${newTagName}.md`;
        const subTagFile = app.vault.getAbstractFileByPath(subTagPath);
        
        if (subTagFile) {
          let content = await app.vault.read(subTagFile);
          
          // フロントマターにタグを設定
          content = content.replace(/tags:\s*\[(.*?)\]/s, `tags: [tag, ${selectedMainTags.join(", ")}]`);
          
          // 所属大分類の行を設定
          content = content.replace(/\*\*所属大分類\*\*:.*/, `**所属大分類**: ${mainTagLinks}`);
          
          await app.vault.modify(subTagFile, content);
          console.log(`サブタグ ${newTagName} を更新しました`);
          
          // 作成したタグを選択リストに追加
          selectedSubTags.push(newTagName);
          newTagCreated = true;
        }
      }
    }
  }
  
  // 選択されたタグのリンク形式を作成
  const tagLinks = selectedSubTags.map(tag => `[[${tag}]]`).join(", ");
  
  // 変数に保存
  params.variables["selectedTags"] = selectedSubTags.join(", ");
  params.variables["tagLinks"] = tagLinks;
  
  console.log("設定された変数:", params.variables);
  
  // 新規ノート作成の場合、変数を返して処理終了（テンプレートが処理）
  if (isFromNewNote) {
    return params.variables;
  }
  
  // 既存のノートにタグを適用する処理（新規ノート以外）
  if (selectedSubTags.length > 0) {
    const currentFile = app.workspace.getActiveFile();
    if (currentFile) {
      let content = await app.vault.read(currentFile);
      
      // フロントマターを更新
      if (content.startsWith("---")) {
        const frontMatterEndPos = content.indexOf("---", 3);
        if (frontMatterEndPos > 0) {
          const frontMatter = content.substring(0, frontMatterEndPos);
          
          // tagsフィールド更新
          if (frontMatter.includes("tags:")) {
            content = content.replace(/tags:\s*\[(.*?)\]/s, `tags: [${selectedSubTags.join(", ")}]`);
          } else {
            content = content.replace("---", `---\ntags: [${selectedSubTags.join(", ")}]`);
          }
        }
      } else {
        // フロントマターがない場合は追加
        content = `---\ntags: [${selectedSubTags.join(", ")}]\n---\n\n${content}`;
      }
      
      // 関連タグの行を更新
      if (content.includes("関連タグ:")) {
        content = content.replace(/関連タグ:.*/, `関連タグ: ${tagLinks}`);
      } else {
        // タイトル行の後に追加
        content = content.replace(/^# .*$/m, `$&\n\n関連タグ: ${tagLinks}`);
      }
      
      await app.vault.modify(currentFile, content);
      console.log("ファイルを更新しました:", currentFile.path);
    }
  }
  
  return params.variables;
};