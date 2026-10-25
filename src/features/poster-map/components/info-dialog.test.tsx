import { render, screen } from "@testing-library/react";
import type { MapBoard } from "../types";
import { InfoDialog } from "./info-dialog";

const board = {
  id: "b1",
  number: "東-1",
  name: "公民館前",
  address: "東区1-1",
  ward: "東区",
  lat: 33.6,
  long: 130.4,
  status: "error_wrong_poster",
} as MapBoard;

test("参加していない人には、他候補のポスターを「要確認」とだけ出す", () => {
  render(<InfoDialog board={board} canJoin onJoin={jest.fn()} onClose={jest.fn()} />);
  expect(screen.getByText("現在の状況：要確認")).toBeInTheDocument();
  expect(screen.queryByText(/他候補/)).not.toBeInTheDocument();
});
