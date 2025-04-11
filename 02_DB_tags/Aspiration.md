---
aliases:
  - Aspirationタグ
type: mainTag
created: 2025-03-19 20:11
updated: 2025-03-19 20:11
---

# Aspiration タグ（大分類）

このタグはAspirationに関連する項目の大分類です。

## 所属する小分類タグ

```dataview
TABLE 
  file.ctime as "作成日", 
  file.mtime as "更新日"
FROM #tag
WHERE contains(file.frontmatter.mainTags, "Aspiration")
SORT file.name ASC
```

## 直接リンクしているノート

```dataview
TABLE 
  file.ctime as "作成日", 
  file.mtime as "更新日"
FROM [[Aspiration]] 
WHERE file.name != "Aspiration" AND !contains(file.frontmatter.type, "subTag")
SORT file.mtime DESC
```

## メモ
