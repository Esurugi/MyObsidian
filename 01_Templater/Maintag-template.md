---
aliases: [<% tp.file.title %>タグ]
type: mainTag
created: <% tp.file.creation_date() %>
updated: <% tp.file.last_modified_date() %>
---

# <% tp.file.title %> タグ（大分類）

このタグは<% tp.file.title %>に関連する項目の大分類です。

## 所属する小分類タグ

<% "```dataview" %>
TABLE 
  file.ctime as "作成日", 
  file.mtime as "更新日"
FROM #tag
WHERE contains(file.frontmatter.mainTags, "<% tp.file.title %>")
SORT file.name ASC
<% "```" %>

## メモ