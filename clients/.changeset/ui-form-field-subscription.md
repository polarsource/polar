---
'@polar-sh/ui': patch
---

`useFormField` subscribes to its field's state with `useFormState`, so `FormMessage` keeps updating when the consuming component is compiled with the React Compiler.
