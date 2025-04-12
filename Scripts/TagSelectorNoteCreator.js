/**
 * TagSelectorNoteCreator.js
 * タグを選択して新規ノートを作成するQuickAddスクリプト
 * 修正版：タグを階層構造として解釈せず、そのまま使用
 */

module.exports = async (params) => {
  const { app, quickAddApi } = params;
  
  try {
    // 1. ノートタイトルを取得
    const noteTitle = await quickAddApi.inputPrompt(
      "ノートのタイトルを入力してください",
      ""
    );
    
    if (!noteTitle) {
      console.log("ノートタイトルが入力されなかったため、処理を中止します");
      return;
    }
    
    // 2. タグを選択するための準備
    const tagFolder = "02_DB_tags"; // あなたのタグフォルダパス（必要に応じて変更）
    let tagsFiles = [];
    
    try {
      tagsFiles = app.vault.getMarkdownFiles()
        .filter(file => file.path.startsWith(tagFolder))
        .map(file => file.basename);
      
      console.log(`タグフォルダから ${tagsFiles.length} 個のタグを読み込みました`);
    } catch (e) {
      console.log("タグフォルダからタグを読み込めませんでした:", e);
      // タグが取得できなくてもプロセスは続行
    }
    
    // 「新規タグ作成」オプションを追加
    const selectableTags = [...tagsFiles, "+ 新規タグを作成"];
    
    // 3. ユーザーにタグを選択させる
    const selectedTags = await quickAddApi.checkboxPrompt(
      selectableTags,
      "リンクするタグを選択してください（複数選択可）"
    );
    
    if (!selectedTags || selectedTags.length === 0) {
      console.log("タグが選択されなかったため、タグなしで続行します");
    }
    
    // 4. 新規タグの処理
    let finalTags = selectedTags ? [...selectedTags] : [];
    if (finalTags.includes("+ 新規タグを作成")) {
      const newTagName = await quickAddApi.inputPrompt(
        "新規タグ名を入力してください", 
        ""
      );
      
      if (newTagName) {
        finalTags = finalTags.filter(tag => tag !== "+ 新規タグを作成");
        finalTags.push(newTagName);
        console.log(`新規タグ「${newTagName}」を追加しました`);
      } else {
        finalTags = finalTags.filter(tag => tag !== "+ 新規タグを作成");
      }
    }
    
    // 5. 実際に存在するフォルダを確認
    const potentialFolders = ["10_Projects", "20_Areas", "30_Resources", "90_Journal"];
    const existingFolders = [];
    
    // 各フォルダの存在を確認
    for (const folder of potentialFolders) {
      try {
        const exists = await app.vault.adapter.exists(folder);
        if (exists) {
          existingFolders.push(folder);
          console.log(`フォルダ「${folder}」は存在します`);
        } else {
          console.log(`フォルダ「${folder}」は存在しません`);
        }
      } catch (e) {
        console.log(`フォルダ「${folder}」の確認中にエラーが発生しました:`, e);
      }
    }
    
    // 存在するフォルダがない場合は、ルートフォルダの選択肢を追加
    if (existingFolders.length === 0) {
      existingFolders.push("/");
      console.log("有効なフォルダが見つからないため、ルートフォルダを使用します");
    }
    
    // フォルダ作成オプションを追加
    existingFolders.push("+ 新規フォルダを作成");
    
    // 6. 保存先フォルダを選択（存在するフォルダのみ）
    const targetFolder = await quickAddApi.suggester(
      existingFolders, 
      existingFolders,
      "ノートの保存先フォルダを選択してください"
    );
    
    if (!targetFolder) {
      console.log("フォルダが選択されなかったため、処理を中止します");
      return;
    }
    
    // 7. 新規フォルダの作成処理
    let finalFolder = targetFolder;
    
    if (targetFolder === "+ 新規フォルダを作成") {
      const newFolderName = await quickAddApi.inputPrompt(
        "新規フォルダ名を入力してください", 
        ""
      );
      
      if (!newFolderName) {
        console.log("フォルダ名が入力されなかったため、処理を中止します");
        return;
      }
      
      // フォルダを作成
      try {
        await app.vault.createFolder(newFolderName);
        finalFolder = newFolderName;
        console.log(`新規フォルダ「${newFolderName}」を作成しました`);
      } catch (e) {
        console.log(`フォルダ「${newFolderName}」の作成中にエラーが発生しました:`, e);
        return;
      }
    }
    
    // 8. タグ情報の準備（タグの解釈はせず、そのまま使用）
    const frontmatterTags = []; // YAMLフロントマター用（タグの標準化）
    const tagLinks = [];        // 本文中のリンク用
    const displayTags = [];     // 表示用（#付き）
    
    finalTags.forEach(tag => {
      // フロントマター用タグ - アンダースコアはそのまま使用
      frontmatterTags.push(tag);
      
      // リンク形式
      tagLinks.push(`[[${tag}]]`);
      
      // 表示用タグ（#付き）
      displayTags.push(`#${tag}`);
    });
    
    // 9. YAML フロントマター用にタグをフォーマット
    let yamlTags = "";
    if (frontmatterTags.length > 0) {
      yamlTags = frontmatterTags.join(", ");
    }
    
    // 10. 現在の日時を取得
    const now = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
    
    // 11. タグリンクセクションを生成（明示的なリンクを維持）
    let tagLinksSection = "";
    if (tagLinks.length > 0) {
      tagLinksSection = `
## 関連タグ
${tagLinks.join(" ")}
`;
    }
    
    // 12. テンプレート内容を構築
    const templateContent = `---
created: ${now}
updated: ${now}
tags: [${yamlTags}]
aliases: 
---

# ${noteTitle}

${tagLinksSection}
`;
    
    // 13. 保存先のフルパスを構築
    let fullPath;
    
    // 日付フォルダを作成する場合（90_Journalの場合）
    if (finalFolder === "90_Journal") {
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      
      // 年月フォルダのパスを作成
      const yearMonthPath = `${finalFolder}/${year}/${month}`;
      
      // フォルダが存在するか確認し、なければ作成
      try {
        const yearFolder = `${finalFolder}/${year}`;
        if (!(await app.vault.adapter.exists(yearFolder))) {
          await app.vault.createFolder(yearFolder);
        }
        
        if (!(await app.vault.adapter.exists(yearMonthPath))) {
          await app.vault.createFolder(yearMonthPath);
        }
      } catch (e) {
        console.log("フォルダ作成エラー:", e);
      }
      
      fullPath = `${yearMonthPath}/${noteTitle}.md`;
    } else {
      fullPath = `${finalFolder}/${noteTitle}.md`;
    }
    
    // 14. ノートを作成
    try {
      const newFile = await app.vault.create(fullPath, templateContent);
      console.log(`ノート「${noteTitle}」を作成しました: ${fullPath}`);
      
      // 15. 作成したノートを開く
      await app.workspace.getLeaf(false).openFile(newFile);
      
      // カーソル位置を設定（タグリンクセクションの後）
      const editor = app.workspace.activeLeaf.view.editor;
      if (editor) {
        // 本文の開始位置にカーソルを置く
        const targetLine = templateContent.split("\n").length;
        editor.setCursor({ line: targetLine, ch: 0 });
      }
      
      // 成功メッセージ
      const Notice = app.plugins.plugins.quickadd?.api?.notice || window.Notice;
      new Notice(`ノート「${noteTitle}」を作成しました [${displayTags.join(" ")}]`);
      
    } catch (error) {
      console.error("ノート作成エラー:", error);
      const Notice = app.plugins.plugins.quickadd?.api?.notice || window.Notice;
      new Notice(`エラー: ${error.message}`);
    }
  } catch (e) {
    console.error("スクリプト実行エラー:", e);
  }
};
