---
aliases:
  - Studyタグ
type: mainTag
created: 2025-03-19 20:10
updated: 2025-03-19 20:10
---

# Study タグ（大分類）

このタグはStudyに関連する項目の大分類です。

## 所属する小分類タグ

```dataview
TABLE 
  file.ctime as "作成日", 
  file.mtime as "更新日"
FROM #tag
WHERE contains(file.name, "Study_") OR contains(file.outlinks, "[[Study]]")
SORT file.name ASC
```

## 直接リンクしているノート

```dataview
TABLE 
  file.ctime as "作成日", 
  file.mtime as "更新日"
FROM [[Study]] 
WHERE file.name != "Study" AND !contains(file.name, "_")
SORT file.mtime DESC
```

## メモ