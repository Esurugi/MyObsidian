---
aliases: [<% tp.file.title %>タグ]
type: subTag
created: <% tp.file.creation_date() %>
updated: <% tp.file.last_modified_date() %>
tags: [tag]
---

# <% tp.file.title %> タグ（小分類）

**所属大分類**: 未設定

## 関連ノート一覧

```dataview
TABLE 
  file.ctime as "作成日", 
  file.mtime as "更新日"
FROM [[<% tp.file.title %>]] 
WHERE file.name != "<% tp.file.title %>"
SORT file.mtime DESC
```

## メモ