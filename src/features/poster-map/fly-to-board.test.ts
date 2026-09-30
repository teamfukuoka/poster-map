import { type FlyMap, flyToBoard } from "./fly-to-board";
import type { MapBoard } from "./types";

const board = (id: string): MapBoard => ({
  id,
  number: id,
  name: `掲示板${id}`,
  address: "中央区天神",
  ward: "中央区",
  lat: 33.59,
  long: 130.4,
  status: "not_yet",
});

function fakeMap({ zoom, metersFromTarget }: { zoom: number; metersFromTarget: number }) {
  const moveend: (() => void)[] = [];
  const map = {
    getZoom: () => zoom,
    getCenter: () => ({ distanceTo: () => metersFromTarget }),
    once: jest.fn((_type: string, fn: () => void) => {
      moveend.push(fn);
    }),
    flyTo: jest.fn(),
  };
  const fireMoveEnd = () => {
    for (const fn of moveend.splice(0)) fn();
  };
  return { map: map as unknown as FlyMap & typeof map, fireMoveEnd };
}

test("移動し終わったら onArrive を呼ぶ（登録してから flyTo する）", () => {
  const { map, fireMoveEnd } = fakeMap({ zoom: 12, metersFromTarget: 5000 });
  const onArrive = jest.fn();
  const b = board("1");
  flyToBoard(map, b, 18, () => true, onArrive);
  expect(map.flyTo).toHaveBeenCalledWith([33.59, 130.4], 18, { duration: 1 });
  expect(map.once.mock.invocationCallOrder[0]).toBeLessThan(map.flyTo.mock.invocationCallOrder[0]);
  expect(onArrive).not.toHaveBeenCalled();
  fireMoveEnd();
  expect(onArrive).toHaveBeenCalledWith(b);
});

test("移動の間に別の掲示板が選ばれていたら呼ばない", () => {
  const { map, fireMoveEnd } = fakeMap({ zoom: 12, metersFromTarget: 5000 });
  const onArrive = jest.fn();
  flyToBoard(map, board("1"), 18, () => false, onArrive);
  fireMoveEnd();
  expect(onArrive).not.toHaveBeenCalled();
});

test("すでにその位置とズームにいるときは、動かさずにすぐ呼ぶ", () => {
  const { map } = fakeMap({ zoom: 18, metersFromTarget: 0 });
  const onArrive = jest.fn();
  const b = board("1");
  flyToBoard(map, b, 18, () => true, onArrive);
  expect(onArrive).toHaveBeenCalledWith(b);
  expect(map.flyTo).not.toHaveBeenCalled();
  expect(map.once).not.toHaveBeenCalled();
});

test("位置が同じでもズームが違えば移動する", () => {
  const { map } = fakeMap({ zoom: 15, metersFromTarget: 0 });
  const onArrive = jest.fn();
  flyToBoard(map, board("1"), 18, () => true, onArrive);
  expect(map.flyTo).toHaveBeenCalled();
  expect(onArrive).not.toHaveBeenCalled();
});
