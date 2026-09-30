import { mapLinks } from "./links";

test("Google マップと Apple マップのリンクを作る", () => {
  expect(mapLinks({ name: "早良小学校 正門", lat: 33.5052703, long: 130.3373249 })).toEqual({
    google: "https://www.google.com/maps/search/?api=1&query=33.5052703,130.3373249",
    apple:
      "https://maps.apple.com/?q=%E6%97%A9%E8%89%AF%E5%B0%8F%E5%AD%A6%E6%A0%A1%20%E6%AD%A3%E9%96%80&ll=33.5052703,130.3373249",
  });
});
