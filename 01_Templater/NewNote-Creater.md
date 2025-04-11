---
created: <% tp.file.creation_date() %>
updated: <% tp.file.last_modified_date() %>
tags: <% tp.frontmatter.selectedTags ? "[" + tp.frontmatter.selectedTags + "]" : "[]" %>
---

# <% tp.file.title %>

関連タグ: <% tp.frontmatter.tagLinks ? tp.frontmatter.tagLinks : "" %>

## メモ

<% tp.file.cursor() %>