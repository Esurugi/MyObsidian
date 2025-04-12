---
aliases: 
type: subTag
created: <% tp.file.creation_date() %>
updated: <% tp.file.last_modified_date() %>
tags: []
mainTags: <% tp.user.make_subtag.mainTagsYaml %>
---
# <% tp.file.title %> タグ（小分類）

**所属大分類**: <% tp.user.make_subtag.mainTagLinks %>

## 関連ノート一覧

```dataview
TABLE 
  file.ctime as "作成日", 
  file.mtime as "更新日"
FROM [[<% tp.file.title %>]] 
WHERE file.name != "<% tp.file.title %>" AND !contains(file.path, "01_Templater")
SORT file.mtime DESC