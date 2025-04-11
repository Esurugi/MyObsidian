---
aliases: [Studyタグ]
type: mainTag
created: 2025-04-11 18:42
updated: 2025-04-11 18:46
---

# Study タグ（大分類）

このタグはStudyに関連する項目の大分類です。

## 所属する小分類タグ

```dataview
TABLE 
  file.ctime as "作成日", 
  file.mtime as "更新日"
FROM #tag
WHERE contains(file.frontmatter.mainTags, "Study")
SORT file.name ASC
```

## 直接リンクしているノート

```dataview
TABLE 
  file.ctime as "作成日", 
  file.mtime as "更新日"
FROM [[Study]] 
WHERE file.name != "Study" AND !contains(file.frontmatter.type, "subTag")
SORT file.mtime DESC
```

## メモ