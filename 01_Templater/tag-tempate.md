---
aliases: [<% tp.file.title %>タグ]
created: <% tp.file.creation_date() %>
updated: <% tp.file.last_modified_date() %>
---

# <% tp.file.title %> タグ

このタグは<% tp.file.title %>に関連するノートを集めています。

## 関連ノート一覧

<% "```dataview" %>
TABLE 
  file.ctime as "作成日", 
  file.mtime as "更新日"
FROM [[<% tp.file.title %>]] 
WHERE file.name != "<% tp.file.title %>"
SORT file.mtime DESC
<% "```" %>

## メモ