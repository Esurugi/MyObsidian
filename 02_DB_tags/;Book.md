---
aliases: [;Bookタグ]
type: mainTag
created: 2025-03-19 20:10
updated: 2025-03-19 20:10
---

# ;Book タグ（大分類）

このタグは;Bookに関連する項目の大分類です。

## 所属する小分類タグ

```dataview
TABLE 
  file.ctime as "作成日", 
  file.mtime as "更新日"
FROM #tag
WHERE contains(file.name, ";Book_") OR contains(file.outlinks, "[[;Book]]")
SORT file.name ASC
```

## 直接リンクしているノート

```dataview
TABLE 
  file.ctime as "作成日", 
  file.mtime as "更新日"
FROM [[;Book]] 
WHERE file.name != ";Book" AND !contains(file.name, "_")
SORT file.mtime DESC
```

## メモ