import { escapeHtml } from "./html";

test("HTML の特殊文字をすべてエスケープする", () => {
  expect(escapeHtml(`<img src=x onerror="alert('x')">&`)).toBe(
    "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;",
  );
});

test("普通の文字列はそのまま", () => {
  expect(escapeHtml("中央区天神1丁目")).toBe("中央区天神1丁目");
});
