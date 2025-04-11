module.exports = async (params) => {
  // モード判定 (新規ノート作成からの呼び出しかどうか)
  const isFromNewNote = params.variables && params.variables["fromNewNote"] === true;
  // サブDBタグ作成モードかどうかを判定（新しいフラグ）
  const isSubTagCreation = params.variables && params.variables["isSubTagCreation"] === true;
  
  // タグフォルダからすべての小分類タグを取得
  const tagFolder = "02_DB_tags";
  const tagFiles = app.vault.getMarkdownFiles()
    .filter(file => file.path.startsWith(tagFolder))
    .filter(file => !file.basename.includes("/"));  // フォルダを除外
  
  // タグをフィルタリング（アンダースコアを含むファイルをサブタグとして扱う）
  const subTags = tagFiles
    .filter(file => file.basename.includes("_"))
    .map(file => file.basename);
  
  // メインタグを取得
  const mainTags = tagFiles
    .filter(file => !file.basename.includes("_"))
    .map(file => file.basename);
  
  // サブDBタグ作成モードの場合は、直接新規タグ作成処理に進む
  if (isSubTagCreation) {
    // サブタグ作成モードの処理
    return await createNewSubTag(params, mainTags, tagFolder);
  }
  
  // 通常モード（タグリンク選択）の処理
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
    // サブタグ作成の処理を実行（別関数に切り出し）
    const newTagResult = await createNewSubTag(params, mainTags, tagFolder);
    if (newTagResult && newTagResult.newTagName) {
      createdNewTag = true;
      finalTags.push(newTagResult.newTagName);
    }
  }
  
  // 選択したタグをQuickAddとTemplaterの変数として保存
  params.variables["selectedTags"] = finalTags.join(", ");
  params.variables["tagLinks"] = finalTags.map(tag => `[[${tag}]]`).join(", ");
  
  // 新規ノート作成時にも選択タグを設定できるよう条件を修正
  // isFromNewNote がtrueの場合は現在のファイル更新はスキップ（テンプレートが適用する）
  if (finalTags.length > 0 && !isFromNewNote) {
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
            newContent = content.replace(/tags:.*?(\n|$)/m, `tags: [${finalTags.join(", ")}]\n`);
          } else {
            // tagsフィールドがない場合は追加
            newContent = content.replace(/^(---\n)(.*?)(\n---)/s, `$1$2\ntags: [${finalTags.join(", ")}]$3`);
          }
        } else {
          // フロントマターがない場合は追加
          newContent = `---\ntags: [${finalTags.join(", ")}]\n---\n\n${content}`;
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

// サブタグ作成処理を別関数に切り出し
async function createNewSubTag(params, mainTags, tagFolder) {
  try {
    // 小分類タグの名前を入力
    const newTagName = await params.quickAddApi.inputPrompt(
      "新規サブタグ名を入力",
      "タグ名"
    );
    
    if (!newTagName || newTagName.trim() === "") {
      return null;
    }
    
    // ファイル名に予めアンダースコアが含まれる場合、自動関連付けの問題を警告
    if (newTagName.includes("_")) {
      const shouldContinue = await params.quickAddApi.yesNoPrompt(
        `警告: タグ名「${newTagName}」にアンダースコア(_)が含まれています。\nアンダースコアの前の部分が大分類タグと一致すると自動関連付けされる可能性があります。\n続行しますか？`,
        "確認"
      );
      
      if (!shouldContinue) {
        return null;
      }
    }
    
    // 関連付ける大分類を選択（複数選択可）
    let selectedMainCategories = [];
    if (mainTags.length > 0) {
      selectedMainCategories = await params.quickAddApi.checkboxPrompt(
        mainTags,
        "関連付ける大分類を選択してください（複数選択可）\n※必ず1つ以上選択してください"
      );
      
      // 何も選択されなかった場合は再確認
      if (selectedMainCategories.length === 0) {
        const retry = await params.quickAddApi.yesNoPrompt(
          "大分類が選択されていません。再選択しますか？\n（いいえを選ぶと新しい大分類を作成するか聞かれます）",
          "大分類の選択"
        );
        
        if (retry) {
          // 再度大分類選択に戻る
          selectedMainCategories = await params.quickAddApi.checkboxPrompt(
            mainTags,
            "関連付ける大分類を選択してください（複数選択可）\n※必ず1つ以上選択してください"
          );
        }
      }
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
        } else {
          // 大分類名が入力されなかった場合は処理を中止
          new Notice("サブタグ作成をキャンセルしました: 大分類名が入力されていません");
          return null;
        }
      } else {
        // 大分類を作成せず、かつ選択もしなかった場合は処理を中止
        new Notice("サブタグ作成をキャンセルしました: 大分類が指定されていません");
        return null;
      }
    }
    
    // メインカテゴリリンクを正しく文字列として作成
    const mainCategoryLinks = selectedMainCategories.map(cat => `[[${cat}]]`).join(", ");
    
    // サブタグ作成に必要な変数を設定
    const subTagVariables = {
      value: newTagName,
      mainCategories: selectedMainCategories,
      mainCategoryLinks: mainCategoryLinks,
      mainCategoriesTags: selectedMainCategories.join(", ")
    };
    
    // QuickAddでサブタグを作成
    await params.quickAddApi.executeChoice("サブDBタグ作成", subTagVariables);
    
    // ファイルが作成されるのを待ってから処理
    await new Promise(resolve => setTimeout(async () => {
      try {
        // 作成されたサブタグファイルを探す
        const tagFile = app.vault.getAbstractFileByPath(`${tagFolder}/${newTagName}.md`);
        
        if (tagFile) {
          // サブタグファイルの内容を読み込む
          const content = await app.vault.read(tagFile);
          
          // 大分類情報を適切に設定
          if (selectedMainCategories.length > 0) {
            // 大分類情報を正しく設定
            let updatedContent = content;
            
            // 所属大分類を正しく設定
            updatedContent = updatedContent.replace(
              /\*\*所属大分類\*\*\: .*/g, 
              `**所属大分類**: ${mainCategoryLinks}`
            );
            
            // フロントマターのタグ情報を確認・更新
            const frontMatterTagRegex = /tags: \[(.*?)\]/;
            if (frontMatterTagRegex.test(updatedContent)) {
              const tagMatch = updatedContent.match(frontMatterTagRegex);
              const currentTags = tagMatch[1].split(', ').filter(t => t.trim() !== '');
              
              // 既存のタグにメインカテゴリを追加（重複を避ける）
              const combinedTags = [...new Set([...currentTags, ...selectedMainCategories])];
              updatedContent = updatedContent.replace(
                frontMatterTagRegex, 
                `tags: [tag, ${combinedTags.join(', ')}]`
              );
            }
            
            // 更新されたサブタグファイルの内容を書き込む
            await app.vault.modify(tagFile, updatedContent);
            
            console.log(`サブタグ「${newTagName}」を作成し、${selectedMainCategories.length}個の大分類に関連付けました`);
          }
        } else {
          console.error(`サブタグファイル ${newTagName}.md が作成されませんでした`);
        }
        resolve();
      } catch (e) {
        console.error("タグファイル更新エラー:", e);
        resolve();
      }
    }, 1500)); // ファイル作成を待つため1500msの遅延に変更
    
    return { newTagName };
  } catch (error) {
    console.error("サブタグ作成エラー:", error);
    return null;
  }
}