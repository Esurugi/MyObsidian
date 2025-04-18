---
aliases: []
type: subTag
created: 2025-04-18 18:16:04
updated: 2025-04-18 18:16:04
tags:
  - tag
mainTags:
  - Book
---

# Book_marketing タグ（小分類）

**所属大分類**: [[Book]]

## 関連ノート一覧

```dataview
TABLE 
  file.ctime as "作成日", 
  file.mtime as "更新日"
FROM [[Book_marketing]] 
WHERE file.name != "Book_marketing" AND !contains(file.path, "01_Templater")
SORT file.mtime DESC
```

## メモ