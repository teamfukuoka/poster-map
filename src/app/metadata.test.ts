/** @jest-environment node */
import { metadata as staffMetadata } from "./admin/(staff)/layout";
import { metadata as loginMetadata } from "./admin/login/page";
import { generateMetadata } from "./layout";

jest.mock("@/lib/site-name", () => ({ getSiteName: async () => "受理後の名前" }));

test("公開の画面は、シェアしたときのカードに DB のサイト名を出す", async () => {
  const metadata = await generateMetadata();
  expect(metadata.openGraph).toMatchObject({ siteName: "受理後の名前", title: "受理後の名前" });
  expect(metadata.twitter).toMatchObject({ card: "summary_large_image", title: "受理後の名前" });
  expect(metadata.robots).toEqual({ index: false, follow: false });
});

test("管理画面はカードを外す", () => {
  for (const metadata of [staffMetadata, loginMetadata]) {
    expect(metadata.openGraph).toBeNull();
    expect(metadata.twitter).toBeNull();
  }
});
