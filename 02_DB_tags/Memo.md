---
aliases:
  - Memoタグ
type: mainTag
created: 2025-03-19 20:11
updated: 2025-03-19 20:11
---

# Memo タグ（大分類）

このタグはMemoに関連する項目の大分類です。

## 所属する小分類タグ

```dataview
TABLE 
  file.ctime as "作成日", 
  file.mtime as "更新日"
FROM #tag
WHERE contains(file.name, ";Memo_") OR contains(file.outlinks, "[[;Memo]]")
SORT file.name ASC
```

## 直接リンクしているノート

```dataview
TABLE 
  file.ctime as "作成日", 
  file.mtime as "更新日"
FROM [[;Memo]] 
WHERE file.name != ";Memo" AND !contains(file.name, "_")
SORT file.mtime DESC
```

## メモ