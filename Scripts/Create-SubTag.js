/**
 * Create-SubTag.js
 * 小分類タグを作成するスクリプト
 */

module.exports = async (params) => {
  const { app, quickAddApi } = params;
  
  try {
    // 1. 小分類タグ名を取得
    const subTagName = await quickAddApi.inputPrompt(
      "小分類タグ名を入力してください",
      ""
    );
    
    if (!subTagName) {
      console.log("タグ名が入力されなかったため、処理を中止します");
      return;
    }
    
    // 2. 所属する大分類タグを選択
    // 大分類タグファイル一覧を取得（type: mainTagを持つファイル）
    let mainTags = [];
    try {
      mainTags = app.vault.getMarkdownFiles()
        .filter(file => {
          const cache = app.metadataCache.getFileCache(file);
          return cache?.frontmatter?.type === "mainTag";
        })
        .map(file => file.basename);
      
      console.log(`${mainTags.length}個の大分類タグを読み込みました`);
    } catch (e) {
      console.error("大分類タグの読み込みエラー:", e);
      return;
    }
    
    if (mainTags.length === 0) {
      console.log("大分類タグが見つかりませんでした");
      return;
    }
    
    // 大分類タグを選択（複数選択可）
    const selectedMainTags = await quickAddApi.checkboxPrompt(
      mainTags,
      "このサブタグが所属する大分類タグを選択してください（複数選択可）"
    );
    
    if (!selectedMainTags || selectedMainTags.length === 0) {
      console.log("大分類タグが選択されなかったため、処理を中止します");
      return;
    }
    
    // 3. テンプレート内容を構築
    const now = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
    
    // 大分類タグをフロントマターと表示用にフォーマット
    const mainTagsYaml = selectedMainTags.map(tag => `  - ${tag}`).join('\n');
    const mainTagLinks = selectedMainTags.map(tag => `[[${tag}]]`).join(', ');
    
    const templateContent = `---
aliases: 
type: subTag
created: ${now}
updated: ${now}
tags: [tag]
mainTags:
${mainTagsYaml}
---
# ${subTagName} タグ（小分類）

**所属大分類**: ${mainTagLinks}

## 関連ノート一覧

\`\`\`dataview
TABLE 
  file.ctime as "作成日", 
  file.mtime as "更新日"
FROM [[${subTagName}]] 
WHERE file.name != "${subTagName}" AND !contains(file.path, "01_Templater")
SORT file.mtime DESC
\`\`\`

## メモ`;
    
    // 4. 保存先フォルダとファイルパスを設定
    const tagFolder = "02_DB_tags"; // タグフォルダパス
    const filePath = `${tagFolder}/${subTagName}.md`;
    
    // 5. タグファイルを作成
    try {
      // フォルダが存在するか確認
      const folderExists = await app.vault.adapter.exists(tagFolder);
      if (!folderExists) {
        await app.vault.createFolder(tagFolder);
        console.log(`フォルダ「${tagFolder}」を作成しました`);
      }
      
      // ファイルを作成
      const newFile = await app.vault.create(filePath, templateContent);
      console.log(`小分類タグ「${subTagName}」を作成しました: ${filePath}`);
      
      // 作成したファイルを開く
      await app.workspace.getLeaf(false).openFile(newFile);
      
      // 成功メッセージ
      const Notice = app.plugins.plugins.quickadd?.api?.notice || window.Notice;
      new Notice(`小分類タグ「${subTagName}」を作成しました`);
      
    } catch (error) {
      console.error("タグファイル作成エラー:", error);
      const Notice = app.plugins.plugins.quickadd?.api?.notice || window.Notice;
      new Notice(`エラー: ${error.message}`);
    }
  } catch (e) {
    console.error("スクリプト実行エラー:", e);
  }
};
